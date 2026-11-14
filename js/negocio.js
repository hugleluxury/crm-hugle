// Reglas del CRM: etapas, segmentos, puntuación, alertas y resultados.
import * as db from './db.js';
import { dias, hoyISO, normTel, normEmail } from './util.js';

export const ETAPAS_POR_DEFECTO = [
  { id: 'nuevo', nombre: 'Nuevo', color: '#20B8FF', tipo: 'abierta' },
  { id: 'contactado', nombre: 'Contactado', color: '#4285F4', tipo: 'abierta' },
  { id: 'propuesta', nombre: 'Propuesta enviada', color: '#9B7BDB', tipo: 'abierta' },
  { id: 'negociacion', nombre: 'Negociación', color: '#E3A64B', tipo: 'abierta' },
  { id: 'ganado', nombre: 'Ganado', color: '#28B995', tipo: 'ganada' },
  { id: 'perdido', nombre: 'Perdido', color: '#F16B75', tipo: 'perdida' },
];

export const ORIGENES = ['WhatsApp', 'Web', 'Instagram', 'Facebook', 'TikTok', 'Anuncio', 'Recomendación', 'Llamada', 'Tienda física', 'Feria / evento', 'Otro'];
export const TIPOS_TAREA = { llamada: 'Llamada', mensaje: 'Mensaje', reunion: 'Reunión', tarea: 'Tarea' };
export const TIPOS_ACTIVIDAD = { nota: 'Nota', llamada: 'Llamada', mensaje: 'Mensaje', email: 'Email', reunion: 'Reunión', sistema: 'Sistema' };

export const SEGMENTOS = {
  campeon: { nombre: 'Campeón', clase: 'verde', ayuda: '3+ compras y la última hace menos de 60 días' },
  leal: { nombre: 'Leal', clase: 'azul', ayuda: '2+ compras recientes' },
  nuevo: { nombre: 'Cliente nuevo', clase: 'violeta', ayuda: 'Primera compra en los últimos 60 días' },
  riesgo: { nombre: 'En riesgo', clase: 'ambar', ayuda: 'Última compra hace 60–180 días' },
  dormido: { nombre: 'Dormido', clase: 'rojo', ayuda: 'Más de 180 días sin comprar' },
  lead: { nombre: 'Lead', clase: '', ayuda: 'Todavía no ha comprado' },
};

export async function etapas() {
  return (await db.ajuste('etapas')) || ETAPAS_POR_DEFECTO;
}

// Carga todo lo necesario para pintar cualquier vista (los volúmenes de un CRM local caben en memoria).
export async function cargarTodo() {
  const [contactos, tratos, tareas, actividades, ventas, listaEtapas, silencio] = await Promise.all([
    db.todos('contactos'), db.todos('tratos'), db.todos('tareas'), db.todos('actividades'), db.todos('ventas'), etapas(), db.ajuste('diasSilencio', 7),
  ]);
  const porId = new Map(contactos.map((c) => [c.id, c]));
  const vMap = agrupar(ventas);
  const aMap = agrupar(actividades);
  const tMap = agrupar(tratos);
  for (const c of contactos) {
    const vs = vMap.get(c.id) || [];
    const ac = aMap.get(c.id) || [];
    c._ventas = vs;
    c._tratos = tMap.get(c.id) || [];
    c._compras = vs.length;
    c._gastado = vs.reduce((s, v) => s + (Number(v.importe) || 0), 0);
    c._ultimaCompra = max(vs.map((v) => v.fecha));
    c._ultimaActividad = max([c.creado, ...ac.map((a) => a.fecha), ...vs.map((v) => v.fecha)]);
    c._segmento = segmento(c);
    c._puntuacion = puntuacion(c);
  }
  return { contactos, porId, tratos, tareas, actividades, ventas, etapas: listaEtapas, diasSilencio: Number(silencio) || 7 };
}

function agrupar(lista) {
  const m = new Map();
  for (const x of lista) { if (!x.contacto) continue; if (!m.has(x.contacto)) m.set(x.contacto, []); m.get(x.contacto).push(x); }
  return m;
}
const max = (fechas) => fechas.filter(Boolean).sort().at(-1) || null;

export function segmento(c) {
  if (!c._compras) return 'lead';
  const d = dias(c._ultimaCompra);
  if (d > 180) return 'dormido';
  if (d > 60) return 'riesgo';
  if (c._compras >= 3) return 'campeon';
  if (c._compras >= 2) return 'leal';
  return 'nuevo';
}

// 0–100: actividad reciente (40) + compras (30) + gasto (20) + datos completos (10).
export function puntuacion(c) {
  const d = dias(c._ultimaActividad) ?? 999;
  const rec = d <= 7 ? 40 : d <= 30 ? 30 : d <= 90 ? 18 : d <= 180 ? 8 : 0;
  const frec = Math.min(30, c._compras * 10);
  const gasto = Math.min(20, Math.round(Math.log10(1 + c._gastado) * 7));
  const datos = (c.telefono ? 4 : 0) + (c.email ? 4 : 0) + (c.empresa || c.ciudad ? 2 : 0);
  return Math.min(100, rec + frec + gasto + datos);
}

// Lo que hay que hacer hoy: el «acelerador».
export function pendientesDeHoy(d) {
  const hoy = hoyISO();
  const abiertas = new Set(d.etapas.filter((e) => e.tipo === 'abierta').map((e) => e.id));
  const tareas = d.tareas.filter((t) => !t.hecha && t.vence && t.vence <= hoy).sort((a, b) => (a.vence + (a.hora || '')).localeCompare(b.vence + (b.hora || '')));
  const conTratoAbierto = new Set(d.tratos.filter((t) => abiertas.has(t.etapa)).map((t) => t.contacto));
  const conTareaFutura = new Set(d.tareas.filter((t) => !t.hecha && t.contacto).map((t) => t.contacto));
  const silencio = d.contactos
    .filter((c) => (conTratoAbierto.has(c.id) || c._segmento === 'lead') && !c.archivado)
    .filter((c) => (dias(c._ultimaActividad) ?? 0) >= d.diasSilencio && !conTareaFutura.has(c.id))
    .sort((a, b) => b._puntuacion - a._puntuacion);
  const riesgo = d.contactos.filter((c) => c._segmento === 'riesgo' && !c.archivado).sort((a, b) => b._gastado - a._gastado);
  const tratosVencidos = d.tratos.filter((t) => abiertas.has(t.etapa) && t.cierre && t.cierre < hoy);
  return { tareas, silencio, riesgo, tratosVencidos, total: tareas.length + silencio.length + tratosVencidos.length };
}

// Resultados del periodo frente al anterior.
export function resultados(d, diasPeriodo = 30) {
  const fin = Date.now();
  const ini = fin - diasPeriodo * 864e5;
  const iniAnt = ini - diasPeriodo * 864e5;
  const en = (iso, a, b) => { const t = new Date(iso).getTime(); return t >= a && t < b; };
  const ganada = new Set(d.etapas.filter((e) => e.tipo === 'ganada').map((e) => e.id));
  const perdida = new Set(d.etapas.filter((e) => e.tipo === 'perdida').map((e) => e.id));
  const calc = (a, b) => {
    const ganados = d.tratos.filter((t) => ganada.has(t.etapa) && t.cerrado && en(t.cerrado, a, b));
    const perdidos = d.tratos.filter((t) => perdida.has(t.etapa) && t.cerrado && en(t.cerrado, a, b));
    const ventas = d.ventas.filter((v) => v.fecha && en(v.fecha, a, b));
    return {
      nuevos: d.contactos.filter((c) => c.creado && en(c.creado, a, b)).length,
      ganados: ganados.length,
      valorGanado: ganados.reduce((s, t) => s + (Number(t.valor) || 0), 0),
      perdidos: perdidos.length,
      ventas: ventas.reduce((s, v) => s + (Number(v.importe) || 0), 0),
      numVentas: ventas.length,
      tareasHechas: d.tareas.filter((t) => t.hecha && t.hechaEn && en(t.hechaEn, a, b)).length,
    };
  };
  const actual = calc(ini, fin + 1);
  const anterior = calc(iniAnt, ini);
  const cerrados = actual.ganados + actual.perdidos;
  actual.tasa = cerrados ? Math.round((actual.ganados / cerrados) * 100) : null;
  const abiertas = d.etapas.filter((e) => e.tipo === 'abierta');
  const embudo = d.etapas.map((e) => {
    const ts = d.tratos.filter((t) => t.etapa === e.id);
    return { ...e, n: ts.length, valor: ts.reduce((s, t) => s + (Number(t.valor) || 0), 0) };
  });
  const pipeline = d.tratos.filter((t) => abiertas.some((e) => e.id === t.etapa)).reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const origenes = {};
  for (const c of d.contactos) {
    const o = c.origen || 'Sin origen';
    origenes[o] ??= { contactos: 0, valor: 0 };
    origenes[o].contactos++;
    origenes[o].valor += c._gastado + c._tratos.filter((t) => ganada.has(t.etapa)).reduce((s, t) => s + (Number(t.valor) || 0), 0);
  }
  const segmentos = {};
  for (const c of d.contactos) segmentos[c._segmento] = (segmentos[c._segmento] || 0) + 1;
  return { actual, anterior, embudo, pipeline, origenes, segmentos };
}

// Busca duplicados por teléfono o email.
export function buscarDuplicado(contactos, { telefono, email }) {
  const t = normTel(telefono); const e = normEmail(email);
  return contactos.find((c) => (t && normTel(c.telefono) === t) || (e && normEmail(c.email) === e)) || null;
}

export async function registrar(contacto, tipo, texto, fecha = new Date().toISOString()) {
  return db.guardar('actividades', { contacto, tipo, texto, fecha });
}

// Mueve un trato de etapa dejando constancia en el historial.
export async function moverTrato(trato, etapaId, listaEtapas) {
  if (trato.etapa === etapaId) return;
  const destino = listaEtapas.find((e) => e.id === etapaId);
  trato.etapa = etapaId;
  trato.cerrado = destino && destino.tipo !== 'abierta' ? new Date().toISOString() : null;
  await db.guardar('tratos', trato);
  if (trato.contacto) await registrar(trato.contacto, 'sistema', `«${trato.titulo}» pasa a ${destino?.nombre || etapaId}.`);
}

export const PLANTILLAS_INICIALES = [
  { nombre: 'Seguimiento de presupuesto', canal: 'whatsapp', texto: 'Hola {{nombre}}, soy {{yo}} de {{negocio}}. ¿Pudiste revisar la propuesta que te envié? Si tienes cualquier duda, te la resuelvo encantado.' },
  { nombre: 'Recordatorio de cita', canal: 'whatsapp', texto: 'Hola {{nombre}}, te recuerdo nuestra cita del {{fecha}}. Si necesitas cambiarla, respóndeme por aquí. ¡Gracias!' },
  { nombre: 'Gracias por tu compra', canal: 'cualquiera', texto: 'Hola {{nombre}}, ¡gracias por confiar en {{negocio}}! Si necesitas algo con tu pedido, aquí estoy.' },
  { nombre: 'Reactivación', canal: 'cualquiera', texto: 'Hola {{nombre}}, hace tiempo que no hablamos. En {{negocio}} tenemos novedades que creo que te pueden interesar. ¿Te cuento?' },
];

// Datos de ejemplo para probar el CRM sin meter nada real.
export async function cargarEjemplo() {
  const ahora = Date.now();
  const haceDias = (n) => new Date(ahora - n * 864e5).toISOString();
  const enDias = (n) => new Date(ahora + n * 864e5).toISOString().slice(0, 10);
  const personas = [
    ['Lucía Martín', 'Estudio Martín', 'Web', 'Madrid', 2], ['Javier Ortega', '', 'WhatsApp', 'Valencia', 40],
    ['Marta Ruiz', 'Clínica Dental Ruiz', 'Recomendación', 'Sevilla', 5], ['Carlos Pérez', 'Talleres Pérez', 'Anuncio', 'Zaragoza', 12],
    ['Ana López', '', 'Instagram', 'Málaga', 90], ['Pablo Sánchez', 'Gimnasio Activa', 'Llamada', 'Bilbao', 1],
    ['Elena Torres', 'Floristería Torres', 'Tienda física', 'Murcia', 200], ['Diego Navarro', '', 'TikTok', 'Granada', 9],
    ['Sara Gil', 'Academia Gil', 'Web', 'Alicante', 25], ['Raúl Romero', 'Romero Abogados', 'Recomendación', 'Madrid', 3],
    ['Irene Castro', '', 'Facebook', 'Valladolid', 15], ['Hugo Molina', 'Café Molina', 'Feria / evento', 'Córdoba', 70],
  ];
  const contactos = personas.map(([nombre, empresa, origen, ciudad, d], i) => ({
    id: db.id(), nombre, empresa, origen, ciudad, telefono: `+34 6${String(10000000 + i * 7654321).slice(0, 8)}`,
    email: nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') + '@ejemplo.com',
    etiquetas: i % 3 === 0 ? ['vip'] : i % 4 === 0 ? ['empresa'] : [], creado: haceDias(d + 20), ejemplo: true,
  }));
  const C = (i) => contactos[i].id;
  const tratos = [
    [0, 'Web corporativa', 2400, 'propuesta', 10], [1, 'Mantenimiento anual', 600, 'contactado', 20], [2, 'Campaña de captación', 1800, 'negociacion', 6],
    [3, 'Pack de fotos', 450, 'nuevo', 15], [5, 'Plan trimestral', 1200, 'ganado', null], [7, 'Consultoría inicial', 300, 'nuevo', 30],
    [8, 'Curso online', 900, 'perdido', null], [9, 'Asesoría de marca', 1500, 'propuesta', -3], [10, 'Tienda online', 3200, 'contactado', 25],
  ].map(([c, titulo, valor, etapa, cierre], i) => ({
    id: db.id(), contacto: C(c), titulo, valor, etapa, cierre: cierre === null ? null : enDias(cierre), creado: haceDias(30 - i * 2),
    cerrado: ['ganado', 'perdido'].includes(etapa) ? haceDias(4 + i) : null,
  }));
  const tareas = [
    [0, 'Llamar para resolver dudas de la propuesta', 'llamada', 0], [2, 'Enviar contrato revisado', 'tarea', -1], [9, 'Reunión de arranque', 'reunion', 2],
    [3, 'Mandar ejemplos de trabajos', 'mensaje', 1], [null, 'Preparar ofertas de temporada', 'tarea', 5],
  ].map(([c, titulo, tipo, d]) => ({ id: db.id(), contacto: c === null ? null : C(c), titulo, tipo, vence: enDias(d), hecha: false, creado: haceDias(3) }));
  const ventas = [
    [5, 'Plan trimestral', 1200, 4], [4, 'Sesión de fotos', 180, 95], [4, 'Retoque', 60, 120], [6, 'Decoración evento', 640, 210],
    [11, 'Cartelería', 220, 75], [11, 'Menú impreso', 90, 140], [9, 'Asesoría express', 250, 20], [9, 'Logotipo', 400, 45], [9, 'Tarjetas', 80, 50],
  ].map(([c, concepto, importe, d]) => ({ id: db.id(), contacto: C(c), concepto, importe, fecha: haceDias(d) }));
  const actividades = [
    [0, 'nota', 'Le interesa tener la web antes de verano. Pide ver ejemplos de clínicas.', 2],
    [2, 'llamada', 'Llamada de 15 min: quiere empezar el mes que viene si cuadra el precio.', 5],
    [1, 'mensaje', 'Le envié la información por WhatsApp. Sin respuesta.', 40],
    [9, 'reunion', 'Reunión en su despacho. Muy buena sintonía.', 3],
  ].map(([c, tipo, texto, d]) => ({ id: db.id(), contacto: C(c), tipo, texto, fecha: haceDias(d) }));
  const conocimiento = [
    { pregunta: '¿Cuál es el horario?', respuesta: 'De lunes a viernes de 9:00 a 18:00.' },
    { pregunta: '¿Cómo se paga?', respuesta: 'Por transferencia o tarjeta. 50 % al empezar y 50 % al entregar.' },
    { pregunta: '¿Cuánto tarda un proyecto?', respuesta: 'Entre 2 y 4 semanas según el tamaño.' },
  ];
  await db.guardarVarios('contactos', contactos);
  await db.guardarVarios('tratos', tratos);
  await db.guardarVarios('tareas', tareas);
  await db.guardarVarios('ventas', ventas);
  await db.guardarVarios('actividades', actividades);
  if (!(await db.todos('conocimiento')).length) await db.guardarVarios('conocimiento', conocimiento);
  await db.fijar('ejemplo', true);
}

export async function borrarEjemplo() {
  const ids = new Set((await db.todos('contactos')).filter((c) => c.ejemplo).map((c) => c.id));
  for (const cid of ids) await db.borrarContacto(cid);
  for (const t of await db.todos('tareas')) if (!t.contacto && t.titulo === 'Preparar ofertas de temporada') await db.borrar('tareas', t.id);
  await db.fijar('ejemplo', false);
}
