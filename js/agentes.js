// Los 3 agentes IA del CRM (15-11-2026): Ventas, Atención al cliente y Fidelización.
// Cada uno trabaja con los datos reales del CRM y con el sector del negocio (sectores.js), y comparte el motor
// HGLmini1.2flash. Ideas tomadas de Hermes Agent (Nous Research, MIT) y adaptadas a un CRM local:
//  · Memoria persistente que el agente usa al responder («recuerda que…»).
//  · Habilidades: recetas con nombre que el usuario guarda desde una respuesta y que se activan con su frase.
//  · Rutinas programadas (parte diario, revisión semanal) que dejan el resultado en la Bandeja.
//  · Aprobación: los agentes PROPONEN acciones (crear tareas) y el usuario las aprueba; nunca envían mensajes solos.
//  · Delegación: si una petición es de otro agente, se la pasa; y en BUSINESS HUGLE la Jefa de personal les da órdenes.
import * as db from './db.js';
import { pedirJSON, lista as iaLista } from './ia.js';
import { dinero, fecha, hace, dias, hoyISO } from './util.js';
import { SEGMENTOS, pendientesDeHoy, resultados } from './negocio.js';
import { SECTORES, sectorActual } from './sectores.js';
import { clasificar, buscarConocimiento, fichaTexto, siguientePaso, mensajePorPlantilla } from './herramientas-ia.js';

export const AGENTES = {
  ventas: { nombre: 'Marco', rol: 'Agente de ventas', color: '#4285F4', icono: 'embudo', foco: 'Embudo, leads sin respuesta, presupuestos y previsión de ventas.' },
  atencion: { nombre: 'Nora', rol: 'Agente de atención al cliente', color: '#28B995', icono: 'plantillas', foco: 'Mensajes de clientes, dudas frecuentes, quejas y tareas pendientes.' },
  fidelizacion: { nombre: 'Iris', rol: 'Agente de fidelización', color: '#9B7BDB', icono: 'escudo', foco: 'Clientes en riesgo, recompra, reseñas y campañas.' },
};
export const IDS = Object.keys(AGENTES);

export async function agente(id) {
  const a = AGENTES[id];
  return { id, ...a, nombre: (await db.ajuste(`agente_${id}`)) || a.nombre };
}
export async function equipo() { return Promise.all(IDS.map(agente)); }

const sinTildes = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PLURAL = { campeon: 'campeones', leal: 'clientes leales', nuevo: 'clientes nuevos', riesgo: 'clientes en riesgo', dormido: 'clientes dormidos', lead: 'leads' };
// Título de una tarea con su contacto, sin repetir el nombre si ya va en el título
const conQuien = (t, d) => { const c = d.porId.get(t.contacto); return c && !t.titulo.includes(c.nombre) ? `${t.titulo} (${c.nombre})` : t.titulo; };
const lineas = (arr) => arr.filter(Boolean).map((x) => `• ${x}`).join('\n');
const primerNombre = (c) => c.nombre.split(' ')[0];
const manana = () => new Date(Date.now() + 864e5 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const tarea = (titulo, c, tipo = 'mensaje', vence = hoyISO()) => ({ tipo: 'tarea', titulo, contacto: c?.id || null, nombre: c?.nombre || '', tipoTarea: tipo, vence });
const yaTieneTarea = (d, c) => d.tareas.some((t) => !t.hecha && t.contacto === c.id);
const abiertas = (d) => new Set(d.etapas.filter((e) => e.tipo === 'abierta').map((e) => e.id));

function contactoEn(texto, d) {
  const t = sinTildes(texto);
  return d.contactos.find((x) => {
    const partes = sinTildes(x.nombre).split(' ');
    return t.includes(sinTildes(x.nombre)) || (partes[0].length > 3 && new RegExp(`\\b${partes[0]}\\b`).test(t)
      && (partes.length < 2 || t.includes(partes[1]) || d.contactos.filter((y) => sinTildes(y.nombre).startsWith(partes[0] + ' ')).length === 1));
  }) || null;
}

/* ───────────── Habilidades de fábrica ─────────────
   Cada una: agente, nombre, pista (regex sin tildes) y hacer(d, s, texto) → { texto, acciones } */
export const HABILIDADES = {
  // ── Ventas
  prioridades: {
    agente: 'ventas', nombre: 'Prioridades comerciales de hoy', pista: /(hoy|prioridad|que hago|que (deberia|tengo que) hacer|por donde empiezo|a quien llamo)/,
    hacer(d) {
      const p = pendientesDeHoy(d); const hoy = hoyISO();
      const out = []; const acc = [];
      for (const t of p.tareas.slice(0, 5)) out.push(`${t.vence < hoy ? '⚠ ' : ''}${conQuien(t, d)}${t.vence < hoy ? ` · venció ${fecha(t.vence)}` : ''}`);
      for (const t of p.tratosVencidos.slice(0, 3)) out.push(`«${t.titulo}» (${dinero(t.valor)}): la fecha de cierre ya pasó.`);
      for (const c of p.silencio.slice(0, 4)) { out.push(`${c.nombre}: sin noticias ${hace(c._ultimaActividad)}.`); acc.push(tarea(`Seguimiento a ${c.nombre}`, c)); }
      if (!out.length) return { texto: 'No tienes nada comercial pendiente hoy. Buen momento para pedir recomendaciones a tus mejores clientes o revisar el embudo.' };
      return { texto: `Lo más importante para vender hoy, por orden:\n${lineas(out)}`, acciones: acc };
    },
  },
  seguimientos: {
    agente: 'ventas', nombre: 'Leads sin respuesta', pista: /(seguimiento|sin respuesta|sin contestar|leads?|silencio|retomar|perseguir|olvidad)/,
    hacer(d) {
      const l = pendientesDeHoy(d).silencio.slice(0, 10);
      if (!l.length) return { texto: `Todos tus leads tienen contacto reciente o una tarea programada (umbral: ${d.diasSilencio} días). 👍` };
      return { texto: `Estos ${l.length} contactos llevan ${d.diasSilencio}+ días sin noticias y no tienen tarea:\n${lineas(l.map((c) => `${c.nombre} (${c._puntuacion}/100): última actividad ${hace(c._ultimaActividad)}`))}\n\nTe propongo una tarea de seguimiento para cada uno.`, acciones: l.map((c) => tarea(`Seguimiento a ${c.nombre}`, c)) };
    },
  },
  estancadas: {
    agente: 'ventas', nombre: 'Oportunidades estancadas', pista: /(estancad|parad|atascad|vencid|cierre pasad|no avanza|presupuestos? (pendiente|sin))/,
    hacer(d) {
      const ab = abiertas(d); const hoy = hoyISO();
      const l = d.tratos.filter((t) => ab.has(t.etapa) && ((t.cierre && t.cierre < hoy) || (dias(t.actualizado || t.creado) ?? 0) >= 14))
        .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0)).slice(0, 8);
      if (!l.length) return { texto: 'Ninguna oportunidad está parada: todas se han movido en las últimas 2 semanas y ninguna tiene la fecha de cierre vencida.' };
      return { texto: `Oportunidades que no avanzan:\n${lineas(l.map((t) => `«${t.titulo}» (${dinero(t.valor)})${d.porId.get(t.contacto) ? ` · ${d.porId.get(t.contacto).nombre}` : ''}${t.cierre && t.cierre < hoy ? ` · cierre vencido el ${fecha(t.cierre)}` : ` · sin cambios ${hace(t.actualizado || t.creado)}`}`))}`,
        acciones: l.filter((t) => d.porId.get(t.contacto)).map((t) => tarea(`Llamar por «${t.titulo}»`, d.porId.get(t.contacto), 'llamada')) };
    },
  },
  embudo: {
    agente: 'ventas', nombre: 'Estado del embudo y previsión', pista: /(embudo|pipeline|oportunidad|etapa|prevision|cuanto (voy a|podria) (cerrar|vender)|negocios abiertos)/,
    hacer(d) {
      const res = resultados(d, 30);
      const ab = d.etapas.filter((e) => e.tipo === 'abierta');
      // Previsión ponderada: cuanto más avanzada la etapa, más probable el cierre
      const peso = new Map(ab.map((e, i) => [e.id, (i + 1) / (ab.length + 1)]));
      const prevision = d.tratos.filter((t) => peso.has(t.etapa)).reduce((s, t) => s + (Number(t.valor) || 0) * peso.get(t.etapa), 0);
      const filas = res.embudo.filter((e) => e.tipo === 'abierta' && e.n).map((e) => `${e.nombre}: ${e.n} (${dinero(e.valor)})`);
      if (!filas.length) return { texto: 'No hay oportunidades abiertas en el embudo. Crea una por cada cliente que te pida precio o presupuesto.' };
      return { texto: `Tienes ${dinero(res.pipeline)} abiertos en el embudo:\n${lineas(filas)}\n\nPrevisión ponderada por etapa: unos ${dinero(prevision)}.${res.actual.tasa !== null ? ` Tasa de cierre de los últimos 30 días: ${res.actual.tasa} %.` : ''}` };
    },
  },
  ventas_mes: {
    agente: 'ventas', nombre: 'Ventas del último mes', pista: /(ventas|factur|vendido|ingres|resultado|como (voy|vamos)|este mes)/,
    hacer(d) {
      const { actual: a, anterior: b } = resultados(d, 30);
      const total = a.valorGanado + a.ventas; const antes = b.valorGanado + b.ventas;
      const dif = antes ? Math.round(((total - antes) / antes) * 100) : null;
      return { texto: `Últimos 30 días: ${dinero(total)} cerrados (${a.ganados} oportunidades ganadas y ${a.numVentas} compras)${dif !== null ? `, un ${dif >= 0 ? '+' : ''}${dif} % frente a los 30 días anteriores (${dinero(antes)})` : ''}.\nContactos nuevos: ${a.nuevos} (antes ${b.nuevos}).${a.tasa !== null ? ` Tasa de cierre: ${a.tasa} %.` : ''}` };
    },
  },
  // ── Atención al cliente
  pendientes_respuesta: {
    agente: 'atencion', nombre: 'Clientes pendientes de respuesta', pista: /(pendientes? de (respuesta|responder|contestar)|esperan? (una |tu |mi )?respuesta|bandeja|quien (me ha|ha) escrito|sin contestar|mensajes?( sin| pendientes)?)/,
    hacer(d) {
      const tresDias = Date.now() - 3 * 864e5;
      const porContacto = new Map();
      for (const a of d.actividades) if (a.contacto && a.fecha) {
        const prev = porContacto.get(a.contacto);
        if (!prev || a.fecha > prev.fecha) porContacto.set(a.contacto, a);
      }
      // Su último movimiento es un mensaje recibido de los últimos 3 días: falta contestar
      const l = [...porContacto.values()].filter((a) => /^mensaje recibido/i.test(a.texto || '') && new Date(a.fecha).getTime() >= tresDias)
        .map((a) => ({ a, c: d.porId.get(a.contacto) })).filter((x) => x.c);
      const tareas = d.tareas.filter((t) => !t.hecha && ['mensaje', 'llamada'].includes(t.tipo) && t.vence && t.vence <= hoyISO());
      if (!l.length && !tareas.length) return { texto: 'No hay clientes esperando respuesta ni mensajes o llamadas pendientes para hoy. 👍' };
      return { texto: [l.length ? `Esperan tu respuesta:\n${lineas(l.map(({ a, c }) => `${c.nombre} (${hace(a.fecha)}): ${a.texto.replace(/^mensaje recibido[^:]*:\s*/i, '').slice(0, 90)}`))}` : '',
        tareas.length ? `Mensajes y llamadas para hoy:\n${lineas(tareas.slice(0, 8).map((t) => `${conQuien(t, d)}`))}` : ''].filter(Boolean).join('\n\n'),
        acciones: l.filter(({ c }) => !yaTieneTarea(d, c)).map(({ c }) => tarea(`Responder a ${c.nombre}`, c)) };
    },
  },
  responder: {
    agente: 'atencion', nombre: 'Responder a un mensaje de cliente', pista: /^(responde|contesta|que (le )?(respondo|contesto)|me (ha )?escrit|cliente:|mensaje:)/,
    async hacer(d, s, texto) {
      const msg = texto.replace(/^(responde|contesta)( a)?( este mensaje)?:?|^que (le )?(respondo|contesto)( a)?:?|^(cliente|mensaje):/i, '').replace(/^["«\s]+|["»\s]+$/g, '').trim();
      if (msg.length < 6) return { texto: 'Pégame el mensaje del cliente después de «responde:» y te digo qué quiere y qué contestarle. Ej.: «responde: ¿hacéis envíos a Canarias?»' };
      const c = contactoEn(msg, d);
      const r = await clasificar(msg, c);
      return { texto: `Es ${r.nombre.toLowerCase()} (urgencia ${r.urgencia}).${r.conocimiento ? ` Uso tu respuesta guardada «${r.conocimiento}».` : ''}\n\nRespuesta sugerida:\n${r.respuesta}` };
    },
  },
  faq: {
    agente: 'atencion', nombre: 'Preguntas frecuentes del sector', pista: /(faq|preguntas frecuentes|conocimiento|que me suelen preguntar|respuestas guardadas)/,
    async hacer(d, s) {
      const qa = await db.todos('conocimiento');
      const tengo = new Set(qa.map((x) => sinTildes(x.pregunta)));
      const faltan = s.faq.filter((p) => !tengo.has(sinTildes(p)));
      return { texto: `Tienes ${qa.length} respuestas guardadas en Conocimiento.${faltan.length ? `\n\n${s.id === 'general' ? 'Los clientes' : `En ${s.nombre.toLowerCase()}`} suelen preguntar esto y aún no lo tienes respondido:\n${lineas(faltan)}\n\nAñádelo en Ajustes → Conocimiento y lo contestaré al momento.` : '\n\nTienes respondidas las preguntas típicas de tu sector. 👍'}` };
    },
  },
  quejas: {
    agente: 'atencion', nombre: 'Quejas e incidencias', pista: /(queja|reclam|incidenc|enfadad|problema|devoluci|mala experiencia)/,
    hacer(d) {
      const re = /(queja|reclam|incidenc|vergüenza|verguenza|fatal|enfad|mal estado|roto|no funciona|devoluci|denuncia)/i;
      const mes = Date.now() - 30 * 864e5;
      const l = d.actividades.filter((a) => a.contacto && re.test(a.texto || '') && new Date(a.fecha).getTime() >= mes).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 8);
      if (!l.length) return { texto: 'No veo quejas ni incidencias en el historial de los últimos 30 días.' };
      return { texto: `Quejas e incidencias de los últimos 30 días:\n${lineas(l.map((a) => `${d.porId.get(a.contacto)?.nombre || 'Contacto'} (${fecha(a.fecha)}): ${a.texto.slice(0, 100)}`))}\n\nUna queja bien resuelta fideliza más que una venta: llama tú antes de escribir.`,
        acciones: [...new Set(l.map((a) => a.contacto))].map((id) => d.porId.get(id)).filter((c) => c && !yaTieneTarea(d, c)).map((c) => tarea(`Llamar a ${c.nombre} por su incidencia`, c, 'llamada')) };
    },
  },
  tareas_vencidas: {
    agente: 'atencion', nombre: 'Tareas vencidas', pista: /(tareas?|vencid|agenda|retras|atrasad)/,
    hacer(d) {
      const hoy = hoyISO();
      const l = d.tareas.filter((t) => !t.hecha && t.vence && t.vence < hoy).sort((a, b) => a.vence.localeCompare(b.vence));
      if (!l.length) return { texto: 'No tienes tareas vencidas. 👍' };
      return { texto: `Tienes ${l.length} ${l.length === 1 ? 'tarea vencida' : 'tareas vencidas'}:\n${lineas(l.slice(0, 10).map((t) => `${conQuien(t, d)} · venció ${fecha(t.vence)}`))}\n\nHazlas hoy o cámbiales la fecha en Agenda: una tarea vencida es un cliente esperando.` };
    },
  },
  // ── Fidelización
  campana: {
    agente: 'fidelizacion', nombre: 'Preparar una campaña', pista: /(campa|promo|oferta|newsletter|mensaje (masivo|a todos)|descuento)/,
    async hacer(d, s, texto) {
      const t = sinTildes(texto);
      const segs = ['campeon', 'leal', 'nuevo', 'riesgo', 'dormido', 'lead'].filter((k) => t.includes(k === 'campeon' ? 'campeon' : k === 'lead' ? 'lead' : k.slice(0, 5)));
      const objetivo = segs.length ? segs : ['riesgo', 'dormido'];
      const l = d.contactos.filter((c) => objetivo.includes(c._segmento) && !c.archivado && (c.telefono || c.email)).sort((a, b) => b._gastado - a._gastado);
      if (!l.length) return { texto: `No hay ${objetivo.map((k) => PLURAL[k]).join(' ni ')} con teléfono o email.` };
      const ej = await mensajePorPlantilla({ contacto: l[0], d, objetivo: objetivo.some((k) => ['riesgo', 'dormido'].includes(k)) ? 'reactivar' : 'oferta', canal: 'whatsapp', detalle: '' });
      return { texto: `Campaña para ${objetivo.map((k) => PLURAL[k]).join(' y ')}: ${l.length} ${l.length === 1 ? 'contacto' : 'contactos'}.\n\nMensaje de ejemplo (se personaliza con el nombre de cada uno):\n${ej}\n\nNo envío nada por mi cuenta: te propongo una tarea por contacto y los mandas tú desde su ficha o desde Plantillas.`,
        acciones: l.slice(0, 15).filter((c) => !yaTieneTarea(d, c)).map((c) => tarea(`Campaña: escribir a ${c.nombre}`, c, 'mensaje', manana())) };
    },
  },
  riesgo: {
    agente: 'fidelizacion', nombre: 'Clientes en riesgo', pista: /(riesgo|perdiendo|dormid|inactiv|no (vuelven|compran|repiten)|recuperar|reactivar)/,
    hacer(d) {
      const l = d.contactos.filter((c) => ['riesgo', 'dormido'].includes(c._segmento) && !c.archivado).sort((a, b) => b._gastado - a._gastado).slice(0, 10);
      if (!l.length) return { texto: `Ningún cliente ha pasado su ciclo de compra (${d.ciclo} días en tu sector). 👍` };
      return { texto: `Clientes que se están enfriando (ciclo de compra de tu sector: ${d.ciclo} días), de más a menos valiosos:\n${lineas(l.map((c) => `${c.nombre}: última compra ${hace(c._ultimaCompra)}, ${dinero(c._gastado)} en total (${SEGMENTOS[c._segmento].nombre.toLowerCase()})`))}\n\nTe propongo una tarea de reactivación para cada uno; el mensaje lo tienes en su ficha → Redactar → Retomar el contacto.`,
        acciones: l.filter((c) => !yaTieneTarea(d, c)).map((c) => tarea(`Reactivar a ${c.nombre}`, c)) };
    },
  },
  recompra: {
    agente: 'fidelizacion', nombre: 'Clientes a punto de recomprar', pista: /(recompr|repetir|volver a comprar|reponer|toca (volver|repetir)|revision)/,
    hacer(d) {
      const l = d.contactos.filter((c) => c._compras && !c.archivado && (() => { const x = dias(c._ultimaCompra); return x >= d.ciclo * 0.75 && x <= d.ciclo; })())
        .sort((a, b) => b._gastado - a._gastado).slice(0, 10);
      if (!l.length) return { texto: `Ningún cliente está en su ventana de recompra (entre ${Math.round(d.ciclo * 0.75)} y ${d.ciclo} días desde su última compra).` };
      return { texto: `Estos clientes están a punto de cumplir su ciclo (${d.ciclo} días): es el mejor momento para escribirles, antes de que se enfríen.\n${lineas(l.map((c) => `${c.nombre}: última compra ${hace(c._ultimaCompra)} (${c._compras} compras)`))}`,
        acciones: l.filter((c) => !yaTieneTarea(d, c)).map((c) => tarea(`Proponer recompra a ${c.nombre}`, c)) };
    },
  },
  mejores: {
    agente: 'fidelizacion', nombre: 'Mejores clientes y reseñas', pista: /(mejores|top|campeon|leales?|vip|rese|recomendaci|quien (me )?compra mas)/,
    hacer(d) {
      const l = [...d.contactos].filter((c) => c._compras && ['campeon', 'leal', 'nuevo'].includes(c._segmento)).sort((a, b) => b._gastado - a._gastado).slice(0, 6);
      if (!l.length) return { texto: 'Aún no hay compras recientes registradas. Regístralas en la ficha de cada contacto («Registrar compra»).' };
      return { texto: `Tus mejores clientes activos:\n${lineas(l.map((c) => `${c.nombre}: ${dinero(c._gastado)} en ${c._compras} ${c._compras === 1 ? 'compra' : 'compras'} (${SEGMENTOS[c._segmento].nombre})`))}\n\nPídeles una reseña o que te recomienden: es la venta más barata que existe.`,
        acciones: l.slice(0, 4).filter((c) => !yaTieneTarea(d, c)).map((c) => tarea(`Pedir reseña a ${c.nombre}`, c)) };
    },
  },
  segmentos: {
    agente: 'fidelizacion', nombre: 'Resumen de la cartera de clientes', pista: /(segment|cartera|tipos de clientes|como estan mis clientes|fidelidad)/,
    hacer(d) {
      const n = resultados(d, 30).segmentos;
      return { texto: `Tu cartera hoy (ciclo de compra de ${d.ciclo} días):\n${lineas(Object.entries(SEGMENTOS).filter(([k]) => n[k]).map(([k, v]) => `${v.nombre}: ${n[k]}`))}` };
    },
  },
};

const PARTE = { ventas: ['prioridades', 'embudo'], atencion: ['pendientes_respuesta', 'tareas_vencidas'], fidelizacion: ['riesgo', 'recompra'] };

/* ───────────── Memoria (Hermes: memoria persistente que el agente cura) ───────────── */
const VACIAS = new Set('que de la el los las un una y o a en por para con mi me te tu lo al del se es son su sus le les recuerda acuerdate ten cuenta apunta'.split(' '));
const claves = (s) => sinTildes(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !VACIAS.has(w));

export async function recordar(agenteId, texto, fuente = 'usuario') {
  const t = texto.trim().replace(/^que\s+/i, '');
  if (t.length < 4) return null;
  const todas = await db.todos('memoria');
  if (todas.some((m) => sinTildes(m.texto) === sinTildes(t))) return null;
  return db.guardar('memoria', { agente: agenteId || 'todos', texto: t.charAt(0).toUpperCase() + t.slice(1), fecha: new Date().toISOString(), fuente });
}
async function memoriaRelevante(agenteId, texto, c) {
  const todas = (await db.todos('memoria')).filter((m) => m.agente === 'todos' || m.agente === agenteId);
  const q = new Set([...claves(texto), ...(c ? claves(c.nombre) : [])]);
  return todas.map((m) => ({ m, p: claves(m.texto).filter((w) => q.has(w)).length })).filter((x) => x.p > 0).sort((a, b) => b.p - a.p).slice(0, 3).map((x) => x.m);
}

/* ───────────── Ejecutar una petición ───────────── */
const ETIQUETA_IA = Object.fromEntries(Object.keys(HABILIDADES).map((k) => [k, k]));

export async function ejecutar(agenteId, texto, d, { delegar = true } = {}) {
  const yo = await agente(agenteId);
  const s = await sectorActual();
  const t = sinTildes(texto).trim();
  const r = await resolver(yo, s, t, texto, d, delegar);
  r.agente = r.agente || agenteId;
  r.acciones = (r.acciones || []).slice(0, 15);
  // Memoria relevante al final de la respuesta
  if (!['memoria', 'recordar'].includes(r.habilidad)) {
    const mem = await memoriaRelevante(agenteId, texto, r.contacto || contactoEn(texto, d));
    if (mem.length) r.texto += `\n\n📌 Lo que recuerdo:\n${lineas(mem.map((m) => m.texto))}`;
  }
  // Empujón para aprender (Hermes «nudge»): si el usuario cuenta una preferencia, ofrecer guardarla
  if (r.habilidad !== 'recordar' && /\b(prefiere|siempre|nunca|no le gusta|le gusta|odia|alergi)/.test(t)) r.texto += '\n\n¿Lo guardo? Escribe «recuerda que …» y lo tendré en cuenta siempre.';
  return r;
}

async function resolver(yo, s, t, original, d, delegar) {
  // 1. Comandos con barra
  if (t.startsWith('/')) {
    const [cmd, ...resto] = t.slice(1).split(/\s+/);
    if (cmd === 'recuerda') return guardarRecuerdo(yo, original.replace(/^\/\S+\s*/, ''));
    if (cmd === 'memoria') return verMemoria(yo);
    if (cmd === 'ayuda') return ayuda(yo, s);
    if (cmd === 'parte') return parte(yo, s, d);
    if (HABILIDADES[cmd]) return correr(cmd, d, s, resto.join(' '), yo);
    return { texto: `No conozco el comando /${cmd}. Escribe /ayuda.`, habilidad: 'ayuda' };
  }
  // 2. Memoria
  const rec = original.match(/^\s*(recuerda|acuerdate de|apunta|ten en cuenta|no olvides)( que| de que)?[:,]?\s+(.+)$/is);
  if (rec) return guardarRecuerdo(yo, rec[3]);
  if (/^(que recuerdas|que sabes de mi negocio|tu memoria|memoria)\??$/.test(t)) return verMemoria(yo);
  if (/^(ayuda|help|que (puedes|sabes) hacer|como funcionas)/.test(t)) return ayuda(yo, s);
  // 3. Habilidades guardadas por el usuario (se activan con su frase)
  for (const h of await db.todos('habilidades')) {
    if ((h.agente === yo.id || h.agente === 'todos') && h.frase && t.includes(sinTildes(h.frase))) {
      const partes = [];
      const acciones = [];
      for (const paso of h.pasos || []) if (HABILIDADES[paso]) { const r = await correr(paso, d, s, original, yo); partes.push(r.texto); acciones.push(...(r.acciones || [])); }
      if (h.nota) partes.push(h.nota);
      await db.guardar('habilidades', { ...h, usos: (h.usos || 0) + 1, ultimoUso: new Date().toISOString() });
      return { texto: `«${h.nombre}»\n\n${partes.join('\n\n')}`, acciones, habilidad: 'propia', propia: h.id, fuente: 'habilidad' };
    }
  }
  // 4. Habilidades de fábrica: primero las propias del agente, luego las de sus compañeros (delegación)
  const propias = Object.entries(HABILIDADES).filter(([, h]) => h.agente === yo.id);
  const ajenas = Object.entries(HABILIDADES).filter(([, h]) => h.agente !== yo.id);
  for (const [k, h] of propias) if (h.pista.test(t)) return correr(k, d, s, original, yo);
  // 5. Un contacto concreto
  const c = contactoEn(original, d);
  if (c) return fichaDe(yo, c, d);
  if (delegar) for (const [k, h] of ajenas) if (h.pista.test(t)) {
    const otro = await agente(h.agente);
    const r = await correr(k, d, s, original, otro);
    return { ...r, texto: `Esto es más de ${otro.nombre} (${otro.rol.toLowerCase()}); se lo he pedido:\n\n${r.texto}`, agente: otro.id, delegado: true };
  }
  // 6. Conocimiento del negocio
  const qa = await buscarConocimiento(original);
  if (qa) return { texto: `${qa.respuesta}\n\n(Según tu información del negocio: «${qa.pregunta}»)`, habilidad: 'conocimiento', fuente: 'reglas' };
  // 7. Consejo de oficio
  if (/(consejo|idea|como (puedo |consigo |vender|mejorar|captar|fidelizar|atender)|estrategia|recomiend|truco)/.test(t)) return consejo(yo, s, d);
  // 8. HGLmini elige la habilidad (pocos ejemplos bastan para un modelo pequeño)
  if (iaLista()) try {
    const lista = propias.map(([k]) => k).concat(ajenas.map(([k]) => k));
    const r = await pedirJSON(
      `You pick the right CRM tool for a request in Spanish. Reply ONLY with JSON {"tool":"..."}. Tools: ${lista.join(', ')}, advice, other.\n` +
      'Examples:\n"¿a quién llamo primero?" → {"tool":"prioridades"}\n"¿cuánto tengo en presupuestos?" → {"tool":"embudo"}\n"¿quién lleva tiempo sin comprar?" → {"tool":"riesgo"}\n' +
      '"¿quién me debe contestar?" → {"tool":"seguimientos"}\n"¿hay clientes enfadados?" → {"tool":"quejas"}\n"prepara algo para mis clientes fieles" → {"tool":"campana"}\n"¿cómo atiendo mejor?" → {"tool":"advice"}\n"¿qué tiempo hace?" → {"tool":"other"}',
      original,
    );
    const k = String(r.tool || '').toLowerCase().trim();
    if (k === 'advice') return { ...(await consejo(yo, s, d)), fuente: 'ia' };
    if (ETIQUETA_IA[k]) {
      const h = HABILIDADES[k];
      const quien = h.agente === yo.id ? yo : await agente(h.agente);
      const res = await correr(k, d, s, original, quien);
      return { ...res, fuente: 'ia', agente: quien.id, texto: `Entiendo que me pides: ${h.nombre.toLowerCase()}${quien.id !== yo.id ? ` (lo lleva ${quien.nombre})` : ''}. Si no es eso, escribe /ayuda.\n\n${res.texto}` };
    }
  } catch {}
  // 9. Parte del agente
  const p = await parte(yo, s, d);
  return { ...p, texto: `No estoy seguro de qué me pides, así que te doy mi parte de hoy. Escribe /ayuda para ver lo que sé hacer.\n\n${p.texto}` };
}

async function correr(k, d, s, original, quien) {
  const h = HABILIDADES[k];
  const r = await h.hacer(d, s, original);
  return { ...r, habilidad: k, agente: quien?.id || h.agente, fuente: r.fuente || 'reglas' };
}

async function guardarRecuerdo(yo, texto) {
  const m = await recordar(yo.id, texto);
  return { texto: m ? `Hecho, lo recordaré: «${m.texto}». Lo tendré en cuenta cuando hablemos de ello. Puedes verlo y borrarlo en la pestaña Memoria.` : 'Eso ya lo tenía apuntado (o es demasiado corto).', habilidad: 'recordar' };
}
async function verMemoria(yo) {
  const l = (await db.todos('memoria')).filter((m) => m.agente === 'todos' || m.agente === yo.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { texto: l.length ? `Esto es lo que recuerdo (${l.length}):\n${lineas(l.slice(0, 15).map((m) => m.texto))}` : 'Aún no recuerdo nada. Dime «recuerda que …» y lo guardaré.', habilidad: 'memoria' };
}
async function ayuda(yo, s) {
  const mias = Object.entries(HABILIDADES).filter(([, h]) => h.agente === yo.id);
  const propias = (await db.todos('habilidades')).filter((h) => h.agente === yo.id || h.agente === 'todos');
  return { texto: `Soy ${yo.nombre}, tu ${yo.rol.toLowerCase()}${s.id === 'general' ? '' : ` para ${s.nombre.toLowerCase()}`}. ${yo.foco}\n\nSé hacer:\n${lineas(mias.map(([k, h]) => `${h.nombre} (/${k})`))}${propias.length ? `\n\nTus habilidades guardadas:\n${lineas(propias.map((h) => `${h.nombre}: di «${h.frase}»`))}` : ''}\n\nTambién: el nombre de un contacto, «recuerda que …», /memoria, /parte y consejos de tu sector. Si me pides algo de mis compañeros, se lo paso.`, habilidad: 'ayuda' };
}
async function parte(yo, s, d) {
  const partes = []; const acciones = [];
  for (const k of PARTE[yo.id]) { const r = await correr(k, d, s, '', yo); partes.push(`— ${HABILIDADES[k].nombre} —\n${r.texto}`); acciones.push(...(r.acciones || [])); }
  return { texto: partes.join('\n\n'), acciones, habilidad: 'parte' };
}
function fichaDe(yo, c, d) {
  const foco = {
    ventas: () => { const t = c._tratos.find((x) => abiertas(d).has(x.etapa)); return t ? `Para cerrar: «${t.titulo}» (${dinero(t.valor)}) está en ${d.etapas.find((e) => e.id === t.etapa)?.nombre}.` : 'No tiene oportunidades abiertas: si hay interés, crea una.'; },
    atencion: () => { const ult = d.actividades.filter((a) => a.contacto === c.id).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]; return ult ? `Último contacto ${hace(ult.fecha)}: ${ult.texto.slice(0, 120)}` : 'No hay conversaciones registradas.'; },
    fidelizacion: () => c._compras ? `Segmento ${SEGMENTOS[c._segmento].nombre}: ${c._compras} ${c._compras === 1 ? 'compra' : 'compras'}; con un ciclo de ${d.ciclo} días ${dias(c._ultimaCompra) > d.ciclo ? 'ya debería haber vuelto' : `le toca volver en unos ${Math.max(0, d.ciclo - dias(c._ultimaCompra))} días`}.` : 'Todavía no ha comprado.',
  }[yo.id]();
  return { texto: `${fichaTexto(c, d)}\n\n${foco}\nSiguiente paso: ${siguientePaso(c, d)}`, habilidad: 'contacto', contacto: c,
    acciones: yaTieneTarea(d, c) ? [] : [tarea(`${yo.id === 'ventas' ? 'Seguimiento comercial' : yo.id === 'atencion' ? 'Contactar' : 'Cuidar la relación'} con ${c.nombre}`, c)] };
}
function consejo(yo, s, d) {
  const p = pendientesDeHoy(d);
  const datos = {
    ventas: [p.silencio.length && `Tienes ${p.silencio.length} ${p.silencio.length === 1 ? 'lead' : 'leads'} sin noticias: un mensaje corto recupera muchos.`, p.tratosVencidos.length && (p.tratosVencidos.length === 1 ? '1 oportunidad tiene la fecha de cierre vencida.' : `${p.tratosVencidos.length} oportunidades tienen la fecha de cierre vencida.`)],
    atencion: [p.tareas.length && `Tienes ${p.tareas.length} tareas para hoy o vencidas.`],
    fidelizacion: [p.riesgo.length && (p.riesgo.length === 1 ? '1 cliente ha pasado su ciclo de compra.' : `${p.riesgo.length} clientes han pasado su ciclo de compra.`)],
  }[yo.id].filter(Boolean);
  return { texto: `Consejos de ${yo.nombre}${s.id === 'general' ? '' : ` para ${s.nombre.toLowerCase()}`}:\n${lineas([...datos, ...s.ideas[yo.id]])}`, habilidad: 'consejo', fuente: 'reglas' };
}

/* ───────────── Acciones propuestas: el usuario las aprueba ───────────── */
export async function aplicarAccion(a) {
  if (a.tipo !== 'tarea') return false;
  await db.guardar('tareas', { titulo: a.titulo, tipo: a.tipoTarea || 'tarea', contacto: a.contacto || null, vence: a.vence || hoyISO(), hecha: false, origen: 'agente' });
  return true;
}

/* ───────────── Habilidades del usuario ───────────── */
export async function guardarHabilidad({ agente: ag, nombre, frase, pasos, nota = '' }) {
  return db.guardar('habilidades', { agente: ag, nombre: nombre.trim(), frase: sinTildes(frase).trim(), pasos, nota, usos: 0 });
}

/* ───────────── Rutinas (Hermes: tareas programadas en lenguaje natural) ───────────── */
export const RUTINAS_INICIALES = [
  { agente: 'ventas', nombre: 'Parte de ventas de la mañana', instruccion: '/parte', frecuencia: 'laborables', hora: '09:00', activa: true },
  { agente: 'atencion', nombre: 'Clientes pendientes de respuesta', instruccion: '/pendientes_respuesta', frecuencia: 'diaria', hora: '09:00', activa: true },
  { agente: 'fidelizacion', nombre: 'Revisión semanal de clientes en riesgo', instruccion: '/riesgo', frecuencia: 'semanal', dia: 1, hora: '10:00', activa: true },
];
export const FRECUENCIAS = { diaria: 'Cada día', laborables: 'De lunes a viernes', semanal: 'Una vez por semana' };
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Última hora programada que ya ha pasado
export function ultimaProgramada(r, ahora = new Date()) {
  const [h, m] = String(r.hora || '09:00').split(':').map(Number);
  const x = new Date(ahora); x.setHours(h || 0, m || 0, 0, 0);
  if (x > ahora) x.setDate(x.getDate() - 1);
  for (let i = 0; i < 8; i++) {
    const dsem = x.getDay();
    if (r.frecuencia === 'diaria' || (r.frecuencia === 'laborables' && dsem >= 1 && dsem <= 5) || (r.frecuencia === 'semanal' && dsem === Number(r.dia ?? 1))) return x;
    x.setDate(x.getDate() - 1);
  }
  return x;
}

let revisando = false;
export async function revisarRutinas(cargar) {
  if (revisando) return 0;
  revisando = true;
  let n = 0;
  try {
    if (!(await db.ajuste('rutinasCreadas'))) {
      await db.guardarVarios('rutinas', RUTINAS_INICIALES.map((r) => ({ ...r })));
      await db.fijar('rutinasCreadas', true);
    }
    const pendientes = (await db.todos('rutinas')).filter((r) => r.activa && (!r.ultima || new Date(r.ultima) < ultimaProgramada(r)));
    if (!pendientes.length) return 0;
    const d = await cargar();
    for (const r of pendientes) {
      const res = await ejecutar(r.agente, r.instruccion, d, { delegar: true });
      await db.guardar('bandeja', { agente: r.agente, titulo: r.nombre, texto: res.texto, acciones: res.acciones, fecha: new Date().toISOString(), leida: false, origen: 'rutina' });
      await db.guardar('rutinas', { ...r, ultima: new Date().toISOString() });
      n++;
    }
    if (n && document.hidden && 'Notification' in self && Notification.permission === 'granted') {
      try { new Notification('CRM HUGLE', { body: `Tus agentes han dejado ${n} ${n === 1 ? 'aviso' : 'avisos'} en la Bandeja.`, icon: 'img/icono-180.png' }); } catch {}
    }
  } finally { revisando = false; }
  return n;
}

/* ───────────── Búsqueda en conversaciones (Hermes: session search) ───────────── */
export async function buscarConversaciones(q) {
  const k = sinTildes(q).trim();
  if (k.length < 2) return [];
  const chat = (await db.todos('chat')).filter((m) => sinTildes(m.texto).includes(k));
  const band = (await db.todos('bandeja')).filter((m) => sinTildes(m.titulo + ' ' + m.texto).includes(k)).map((m) => ({ ...m, rol: 'ia', bandeja: true }));
  return [...chat, ...band].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 30);
}

export { SECTORES };
