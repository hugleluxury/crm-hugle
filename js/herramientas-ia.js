// HGLmini1.2flash · tareas de IA del CRM con diseño híbrido.
// Un modelo de 0,3B parámetros es rapidísimo y privado, pero se equivoca a menudo y su español es limitado.
// Por eso cada tarea combina: reglas en español (resultado seguro) + el modelo (enrutar, clasificar, personalizar)
// + validación de lo que devuelve el modelo. Si la IA no da un resultado válido, se usa el de las reglas.
// Con un modelo mejor (Ajustes → IA → origen del modelo) el mismo código aprovecha más la IA automáticamente.
import * as db from './db.js';
import { conversar, pedirJSON, lista as iaLista } from './ia.js';
import { dinero, fecha, hace, dias, hoyISO } from './util.js';
import { SEGMENTOS, pendientesDeHoy, resultados } from './negocio.js';

export async function perfilNegocio() {
  const [negocio, yo, sector, tono, extra] = await Promise.all([
    db.ajuste('negocio', ''), db.ajuste('yo', ''), db.ajuste('sector', ''), db.ajuste('tono', 'cercano y profesional'), db.ajuste('infoNegocio', ''),
  ]);
  return { negocio: negocio || 'nuestro equipo', yo, sector, tono: tono || 'cercano y profesional', extra };
}

/* ───── Validación de lo que escribe el modelo ───── */
const INGLES = /\b(the|and|you|your|with|this|that|for|have|hope|thanks|please|here|are|will|would|just|hi|best|regards|looking|forward)\b/gi;
export function esEspanolValido(t, { min = 20, max = 900 } = {}) {
  if (!t) return false;
  const s = t.trim();
  if (s.length < min || s.length > max) return false;
  if (/[぀-ヿ㐀-鿿가-힯]/.test(s)) return false; // chino, japonés, coreano
  if (/\[(your|tu) ?name\]|\{\{|<\|/i.test(s)) return false;
  const palabras = s.split(/\s+/).length;
  const ingles = (s.match(INGLES) || []).length;
  if (ingles / palabras > 0.08) return false;
  if (!/[áéíóúñ¿¡]|\b(de|que|el|la|los|las|por|para|con|una?|tu|te|si|gracias|hola)\b/i.test(s)) return false;
  return true;
}
const sinTildes = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ───── Conocimiento del negocio: búsqueda por palabras ───── */
const VACIAS = new Set('de la el los las un una unos unas y o a en por para con que qué como cómo cual cuál cuanto cuánto es son se su sus mi me te tu lo al del hay tiene tienen tenéis vuestro vuestra hola buenas quiero querria quería saber puedo podria podría'.split(' '));
// Raíz simple: quita plurales y vocal final (paga/pago → pag, semanas → seman).
const raiz = (w) => w.replace(/(es|s)$/, '').replace(/[aeiou]$/, '');
const palabras = (s) => sinTildes(s).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((p) => p.length > 2 && !VACIAS.has(p)).map(raiz).filter((p) => p.length > 2);
export async function buscarConocimiento(texto) {
  const qa = await db.todos('conocimiento');
  const q = new Set(palabras(texto));
  let mejor = null; let puntos = 0;
  for (const x of qa) {
    // Coincidir con la pregunta guardada vale el doble que coincidir con la respuesta.
    const p = 2 * new Set(palabras(x.pregunta).filter((w) => q.has(w))).size + new Set(palabras(x.respuesta).filter((w) => q.has(w))).size;
    if (p > puntos) { puntos = p; mejor = x; }
  }
  return puntos >= 2 ? mejor : null;
}

/* ───── 1. Redactar mensajes ───── */
export const OBJETIVOS = {
  seguimiento: 'hacer seguimiento y saber si tiene dudas',
  cita: 'proponer una llamada o cita',
  gracias: 'agradecer su compra o confianza',
  reactivar: 'retomar el contacto después de un tiempo',
  oferta: 'presentar una oferta o novedad sin presionar',
  cobro: 'recordar un pago pendiente con amabilidad',
};

const PLANTILLAS = {
  seguimiento: [
    'Hola {n}, ¿qué tal? Te escribo para saber si pudiste revisar {cosa}. Si tienes cualquier duda, te la resuelvo encantad{o}.',
    'Hola {n}, solo quería saber si le has podido echar un vistazo a {cosa}. Cuéntame qué te parece y lo vemos juntos.',
  ],
  cita: [
    'Hola {n}, ¿te viene bien que hablemos unos minutos esta semana sobre {cosa}? Dime qué día y hora te encajan mejor.',
    'Hola {n}, me gustaría comentarte {cosa} en una llamada corta. ¿Qué día te va bien?',
  ],
  gracias: [
    'Hola {n}, ¡muchas gracias por confiar en {negocio}! Si necesitas cualquier cosa, aquí me tienes.',
    'Hola {n}, gracias de corazón por tu confianza. Espero que todo esté a tu gusto; cualquier cosa, me dices.',
  ],
  reactivar: [
    'Hola {n}, ¡cuánto tiempo! En {negocio} tenemos novedades que creo que te pueden interesar. ¿Te cuento?',
    'Hola {n}, hace tiempo que no hablamos y me acordé de ti. ¿Cómo va todo? Si te puedo ayudar en algo, aquí estoy.',
  ],
  oferta: [
    'Hola {n}, te escribo porque tenemos una novedad que encaja contigo: {detalle}. Si te interesa, te paso los detalles sin compromiso.',
    'Hola {n}, este mes tenemos algo especial: {detalle}. ¿Quieres que te cuente más?',
  ],
  cobro: [
    'Hola {n}, te escribo para recordarte que queda pendiente el pago de {cosa}. Si ya lo has hecho, ignora este mensaje. ¡Gracias!',
    'Hola {n}, un recordatorio amable: tenemos pendiente el pago de {cosa}. Cualquier duda, me dices.',
  ],
};
const FORMAL = (t) => t.replace(/\bTe escribo\b/g, 'Le escribo').replace(/\bte escribo\b/g, 'le escribo').replace(/¿qué tal\?/g, '¿cómo está?')
  .replace(/\bpudiste\b/g, 'pudo').replace(/\btienes\b/g, 'tiene').replace(/\bte la resuelvo\b/g, 'se la resuelvo').replace(/\bCuéntame\b/g, 'Cuénteme')
  .replace(/\bte viene\b/g, 'le viene').replace(/\bDime\b/g, 'Dígame').replace(/\bte encajan\b/g, 'le encajan').replace(/\bcomentarte\b/g, 'comentarle')
  .replace(/\bte va\b/g, 'le va').replace(/\bme tienes\b/g, 'me tiene').replace(/\btu confianza\b/g, 'su confianza').replace(/\bme dices\b/g, 'me dice')
  .replace(/\bte pueden\b/g, 'le pueden').replace(/¿Te cuento\?/g, '¿Le cuento?').replace(/\bte puedo\b/g, 'le puedo').replace(/\bcontigo\b/g, 'con usted')
  .replace(/\bte interesa\b/g, 'le interesa').replace(/\bte paso\b/g, 'le paso').replace(/¿Quieres que te cuente\b/g, '¿Quiere que le cuente')
  .replace(/\brecordarte\b/g, 'recordarle').replace(/\bhas hecho\b/g, 'ha hecho').replace(/\ble has podido\b/g, 'le ha podido').replace(/\bme acordé de ti\b/g, 'me acordé de usted');

function cosaDe(c, d, objetivo) {
  const abiertas = new Set(d.etapas.filter((e) => e.tipo === 'abierta').map((e) => e.id));
  const t = c._tratos.find((x) => abiertas.has(x.etapa)) || c._tratos[0];
  if (t && objetivo === 'cobro') return `«${t.titulo}»`;
  if (t) return `la propuesta de ${t.titulo.charAt(0).toLowerCase() + t.titulo.slice(1)}`;
  const v = c._ventas?.at?.(-1);
  if (v) return v.concepto.charAt(0).toLowerCase() + v.concepto.slice(1);
  return 'lo que hablamos';
}

export async function mensajePorPlantilla({ contacto, d, objetivo, canal, detalle, variante = 0 }) {
  const p = await perfilNegocio();
  const lista = PLANTILLAS[objetivo] || PLANTILLAS.seguimiento;
  let t = lista[variante % lista.length]
    .replace('{n}', contacto.nombre.split(' ')[0])
    .replace('{cosa}', cosaDe(contacto, d, objetivo))
    .replace('{negocio}', p.negocio)
    .replace('{detalle}', detalle || 'una propuesta pensada para ti')
    .replace('{o}', 'o');
  if (/formal/i.test(p.tono)) t = FORMAL(t);
  if (detalle && objetivo !== 'oferta') t += ` ${detalle.charAt(0).toUpperCase() + detalle.slice(1).replace(/\.?$/, '.')}`;
  const firma = p.yo ? `${p.yo}${p.negocio !== 'nuestro equipo' ? `, de ${p.negocio}` : ''}` : (p.negocio !== 'nuestro equipo' ? p.negocio : '');
  if (canal === 'email') return `${t}\n\nUn saludo,\n${firma || ''}`.trim();
  return firma ? `${t}\n\n${firma}` : t;
}

const EJEMPLOS = [
  ['Cliente: Marta. Objetivo: seguimiento del presupuesto de reforma de baño.', 'Hola Marta, ¿qué tal? Te escribo para saber si pudiste revisar el presupuesto de la reforma del baño. Si tienes cualquier duda, te la resuelvo encantado.'],
  ['Cliente: Pablo. Objetivo: agradecer su compra del plan trimestral.', 'Hola Pablo, ¡muchas gracias por confiar en nosotros con el plan trimestral! Cualquier cosa que necesites, aquí me tienes.'],
];

// Devuelve { texto, origen: 'ia' | 'plantilla' }.
// Por defecto, plantilla inteligente (instantánea y siempre correcta). Con usarIA, la escribe el modelo
// y, si su texto no pasa la validación, se vuelve a la plantilla.
export async function redactar({ contacto, d, objetivo, canal = 'whatsapp', detalle = '', onTexto, senal, variante = 0, usarIA = false }) {
  const base = await mensajePorPlantilla({ contacto, d, objetivo, canal, detalle, variante });
  if (!usarIA) return { texto: base, origen: 'plantilla' };
  const p = await perfilNegocio();
  const mensajes = [{ role: 'system', content: `Escribes mensajes breves de WhatsApp en español de España para «${p.negocio}». Tono ${p.tono}. Solo el mensaje, sin firma ni explicaciones.` }];
  for (const [u, a] of EJEMPLOS) mensajes.push({ role: 'user', content: u }, { role: 'assistant', content: a });
  mensajes.push({ role: 'user', content: `Cliente: ${contacto.nombre.split(' ')[0]}. Objetivo: ${OBJETIVOS[objetivo] || objetivo} (${cosaDe(contacto, d)}).${detalle ? ` Detalle: ${detalle}.` : ''}` });
  let ia = '';
  if (iaLista()) try { ia = await conversar(mensajes, { senal, max: 130, temperatura: 0.4, onTexto }); } catch (e) { if (senal?.aborted) throw e; }
  const nombre = sinTildes(contacto.nombre.split(' ')[0]);
  const repite = sinTildes(ia).includes(sinTildes(OBJETIVOS[objetivo] || objetivo).slice(0, 18)); // el modelo copia la instrucción
  if (esEspanolValido(ia, { min: 40, max: 600 }) && sinTildes(ia).includes(nombre) && !repite && /[.!?]$/.test(ia.trim())) {
    const firma = base.includes('\n\n') ? base.slice(base.lastIndexOf('\n\n')) : '';
    return { texto: ia.trim() + firma, origen: 'ia' };
  }
  return { texto: base, origen: 'plantilla' };
}

/* ───── 2. Clasificar mensajes entrantes (enrutador de intención) ───── */
export const INTENCIONES = {
  compra: { nombre: 'Quiere comprar', etapa: 'negociacion', prioridad: 'alta' },
  precio: { nombre: 'Pregunta precio', etapa: 'contactado', prioridad: 'alta' },
  cita: { nombre: 'Quiere cita o llamada', etapa: 'contactado', prioridad: 'alta' },
  informacion: { nombre: 'Pide información', etapa: 'contactado', prioridad: 'media' },
  queja: { nombre: 'Queja o problema', etapa: null, prioridad: 'alta' },
  soporte: { nombre: 'Ayuda con un pedido', etapa: null, prioridad: 'media' },
  baja: { nombre: 'No le interesa', etapa: 'perdido', prioridad: 'baja' },
  otro: { nombre: 'Otro', etapa: null, prioridad: 'baja' },
};
const PISTAS = [
  ['baja', /(no me interesa|no gracias|dejad de|dejen de|darme de baja|no quiero (nada|recibir)|borradme|no me escrib)/],
  ['queja', /(queja|reclam|fatal|roto|rota|defectuos|no funciona|estafa|enfadad|cabread|verguenza|decepcion|mal servicio|devolucion|devolver|reembolso)/],
  ['soporte', /(mi pedido|el pedido|seguimiento|no (me )?ha llegado|no llega|(mi|el) envio|factura|cambio de talla|cambiar la talla|numero de pedido)/],
  ['cita', /(cita|reunion|llamad|llamame|llamarme|quedar|agendar|hueco|disponibilidad|visita|pasarme por)/],
  ['compra', /(comprar|lo quiero|la quiero|me lo quedo|me la quedo|reservar|reserva|contratar|como (pago|puedo pagar)|apuntame|hacer (un )?pedido|quiero (el|la|uno|una|dos))/],
  ['precio', /(precio|cuanto (cuesta|vale|sale|es)|cuanto seria|tarifa|presupuesto|coste|costo|descuento|oferta|promocion)/],
  ['informacion', /(info|informacion|saber mas|detalles|horario|donde estais|donde esta|como funciona|teneis|tienen|haceis|hacen|enviais|envios a|llegais|hay disponible)/],
];
export function clasificarPorReglas(texto) {
  const t = sinTildes(texto);
  for (const [k, re] of PISTAS) if (re.test(t)) return k;
  return 'otro';
}
const MAPA_IA = { buy: 'compra', purchase: 'compra', price: 'precio', pricing: 'precio', info: 'informacion', information: 'informacion', question: 'informacion', appointment: 'cita', meeting: 'cita', call: 'cita', complaint: 'queja', problem: 'queja', support: 'soporte', order: 'soporte', unsubscribe: 'baja', 'not interested': 'baja', other: 'otro' };

const RESPUESTAS = {
  compra: '¡Genial, {n}! Te ayudo encantado con el pedido. ¿Me confirmas qué necesitas exactamente y te indico los siguientes pasos?',
  precio: 'Hola {n}, gracias por escribir. Te paso el precio enseguida: ¿me confirmas exactamente qué necesitas para darte el importe correcto?',
  cita: 'Hola {n}, ¡claro! ¿Qué día y hora te vienen mejor? Te lo dejo reservado.',
  informacion: 'Hola {n}, gracias por tu mensaje. Te cuento todo lo que necesites: ¿qué te gustaría saber exactamente?',
  queja: 'Hola {n}, siento mucho lo ocurrido. Quiero solucionarlo cuanto antes: ¿me cuentas qué ha pasado y, si puedes, me envías una foto?',
  soporte: 'Hola {n}, lo reviso ahora mismo. ¿Me pasas tu número de pedido o el nombre con el que lo hiciste?',
  baja: 'Entendido, {n}. No te escribiremos más. Gracias por tu tiempo y aquí estamos si algún día lo necesitas.',
  otro: 'Hola {n}, gracias por tu mensaje. ¿En qué te puedo ayudar?',
};

export async function clasificar(texto, contacto = null) {
  const reglas = clasificarPorReglas(texto);
  let deIA = null;
  if (iaLista()) try {
    const r = await pedirJSON(
      'Classify the customer message (it may be in Spanish). Reply ONLY with JSON {"intent": "...", "urgency": "..."}. intent is one of: buy, price, appointment, info, complaint, support, unsubscribe, other. urgency is one of: high, medium, low.\n' +
      'Examples:\n"¿me lo podéis mandar mañana?" → {"intent":"buy","urgency":"high"}\n"¿sale muy caro?" → {"intent":"price","urgency":"medium"}\n' +
      '"esto es una vergüenza" → {"intent":"complaint","urgency":"high"}\n"¿hacéis envíos a Canarias?" → {"intent":"info","urgency":"medium"}\n"jajaja vale" → {"intent":"other","urgency":"low"}',
      texto,
    );
    const k = String(r.intent || '').toLowerCase().split(/[,\s]/)[0];
    deIA = { intencion: MAPA_IA[k] || MAPA_IA[String(r.intent || '').toLowerCase()] || null, urgencia: { high: 'alta', medium: 'media', low: 'baja' }[String(r.urgency || '').toLowerCase()] || null };
  } catch {}
  // Las reglas mandan cuando son claras; la IA decide los mensajes ambiguos.
  const ambiguo = reglas === 'otro';
  let intencion = ambiguo && deIA?.intencion ? deIA.intencion : reglas;
  if (intencion === 'otro' && texto.includes('?')) intencion = 'informacion';
  const info = INTENCIONES[intencion];
  const urgencia = ['queja', 'compra', 'cita'].includes(intencion) ? 'alta' : (deIA?.urgencia && intencion === deIA.intencion ? deIA.urgencia : info.prioridad);
  const n = contacto ? contacto.nombre.split(' ')[0] : '';
  let respuesta = RESPUESTAS[intencion].replace('{n}', n).replace(/\s,/, ',').replace('Hola ,', 'Hola,').replace('¡Genial, !', '¡Genial!').replace('Entendido, .', 'Entendido.');
  const qa = ['precio', 'informacion', 'cita', 'compra'].includes(intencion) ? await buscarConocimiento(texto) : null;
  if (qa) respuesta = `${n ? `Hola ${n}, ` : 'Hola, '}${qa.respuesta.charAt(0).toLowerCase() + qa.respuesta.slice(1)} ¿Te ayudo con algo más?`;
  return { intencion, ...info, urgencia, respuesta, fuente: ambiguo && deIA?.intencion ? 'ia' : 'reglas', conocimiento: qa?.pregunta || '' };
}

/* ───── 3. Sacar un contacto de un texto ───── */
const CIUDADES = 'Madrid Barcelona Valencia Sevilla Zaragoza Málaga Murcia Palma Bilbao Alicante Córdoba Valladolid Vigo Gijón Granada Vitoria Coruña Elche Oviedo Badalona Cartagena Terrassa Jerez Sabadell Móstoles Alcalá Pamplona Fuenlabrada Almería Leganés Santander Burgos Castellón Albacete Getafe Alcorcón Logroño Badajoz Salamanca Huelva Marbella Lleida Tarragona León Cádiz Jaén Ourense Girona Lugo Cáceres Toledo Ceuta Melilla Segovia Ávila Soria Teruel Huesca Cuenca Zamora Palencia Ciudad Real Guadalajara Pontevedra Santiago Lisboa Oporto México Bogotá Lima Santiago Buenos Aires Medellín Quito Caracas Montevideo Guadalajara Monterrey Puebla Cali Barranquilla Asunción'.split(' ');
export function extraerPorReglas(texto) {
  const email = texto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || '';
  const telefono = (texto.match(/(\+?\d[\d\s().-]{7,}\d)/) || [])[0]?.replace(/[^\d+]/g, '') || '';
  const N = '(\\p{Lu}\\p{Ll}+(?:[ \\t]+(?:de[ \\t]+)?\\p{Lu}\\p{Ll}+){0,3})';
  // Sin la marca «i» para que el nombre tenga que empezar por mayúscula.
  let nombre = (texto.match(new RegExp(`(?:[Ss]oy|[Mm]e llamo|[Mm]i nombre es|[Aa]tentamente,?|[Uu]n saludo,?|[Ss]aludos,?|[Cc]ordialmente,?)[ \\t]*\\n?[ \\t]*${N}`, 'u')) || [])[1] || '';
  // Empresa: una línea con forma jurídica (S.L., S.A., SLU…) o «de/en <Nombre Propio>».
  const lineaSociedad = texto.split('\n').map((l) => l.trim()).find((l) => /\b(S\.?L\.?U?|S\.?A\.?|S\.?C\.?|Ltd|Inc|LLC|GmbH|S\.? ?de ?R\.?L\.?)\.?$/i.test(l));
  const empresa = lineaSociedad || (texto.match(/\b(?:de|desde|en|trabajo en|empresa)[ \t]+((?:\p{Lu}[\p{L}&.'-]*[ \t]?){1,4})/u) || [])[1]?.trim() || '';
  let ciudad = '';
  for (const c of CIUDADES) if (new RegExp(`(^|[^\\p{L}])${c}([^\\p{L}]|$)`, 'iu').test(texto)) { ciudad = c; break; }
  const interes = (texto.match(/(?:me interesa|quiero|necesito|busco|quisiera)\s+([^.!?\n]{3,60})/i) || [])[1] || '';
  if (/^(director|gerente|responsable|jefe|ceo|comercial)/i.test(nombre)) nombre = '';
  return { email, telefono, nombre: nombre.trim(), empresa: empresa && empresa !== ciudad && empresa !== nombre ? empresa.replace(/[ \t]+(en|de)$/, '') : '', ciudad, interes: interes.trim() };
}
export async function extraer(texto) {
  const r = extraerPorReglas(texto);
  if (iaLista()) try {
    const ia = await pedirJSON('Extract contact data from the text (it may be in Spanish). Reply ONLY with JSON: {"name": "", "company": "", "city": ""}. Copy the words exactly as written; use "" if missing.', texto);
    const aparece = (v) => typeof v === 'string' && v.trim().length > 1 && sinTildes(texto).includes(sinTildes(v.trim()));
    const limpiar = (v) => v.trim().replace(/^(soy|me llamo|mi nombre es)\s+/i, '');
    if (!r.nombre && aparece(ia.name)) r.nombre = limpiar(ia.name);
    if (!r.empresa && aparece(ia.company) && limpiar(ia.company) !== r.nombre) r.empresa = limpiar(ia.company);
    if (!r.ciudad && aparece(ia.city)) r.ciudad = limpiar(ia.city);
  } catch {}
  return r;
}

/* ───── 4. Resumen y siguiente paso de un contacto ───── */
export function fichaTexto(c, d) {
  const etapa = (id) => d.etapas.find((e) => e.id === id)?.nombre || id;
  const tratos = c._tratos.map((t) => `${t.titulo} (${dinero(t.valor)}, ${etapa(t.etapa)})`).join('; ');
  const ult = d.actividades.filter((a) => a.contacto === c.id && a.tipo !== 'sistema').sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return [
    `${c.nombre}${c.empresa ? ` (${c.empresa})` : ''}${c.ciudad ? `, ${c.ciudad}` : ''}.`,
    `${SEGMENTOS[c._segmento]?.nombre}: ${c._compras ? `${c._compras} compras por ${dinero(c._gastado)}, la última ${hace(c._ultimaCompra)}` : 'aún no ha comprado'}. Última actividad ${hace(c._ultimaActividad)}.`,
    tratos ? `Oportunidades: ${tratos}.` : '',
    ult ? `Última nota (${fecha(ult.fecha)}): ${ult.texto}` : '',
  ].filter(Boolean).join('\n');
}

export function siguientePaso(c, d) {
  const hoy = hoyISO();
  const tarea = d.tareas.filter((t) => t.contacto === c.id && !t.hecha).sort((a, b) => String(a.vence).localeCompare(String(b.vence)))[0];
  if (tarea) return `${tarea.vence && tarea.vence < hoy ? 'Ponte al día: ' : ''}${tarea.titulo}${tarea.vence ? ` (${tarea.vence < hoy ? 'venció' : 'vence'} ${fecha(tarea.vence)})` : ''}.`;
  const abiertas = new Set(d.etapas.filter((e) => e.tipo === 'abierta').map((e) => e.id));
  const t = c._tratos.find((x) => abiertas.has(x.etapa));
  const silencio = dias(c._ultimaActividad) ?? 0;
  if (t && t.cierre && t.cierre < hoy) return `La fecha de cierre de «${t.titulo}» ya pasó: llama para saber en qué punto está.`;
  if (t && silencio >= 5) return `Haz seguimiento de «${t.titulo}» (${dinero(t.valor)}): lleva ${silencio} días sin noticias.`;
  if (t) return `Prepara el siguiente paso de «${t.titulo}» y agenda una tarea para no perderlo de vista.`;
  if (c._segmento === 'riesgo' || c._segmento === 'dormido') return 'Escríbele un mensaje de reactivación con alguna novedad o ventaja.';
  if (c._segmento === 'campeon' || c._segmento === 'leal') return 'Es de tus mejores clientes: agradécele su confianza y pídele una recomendación o reseña.';
  if (c._segmento === 'nuevo') return 'Pregúntale qué tal su primera compra y ofrécele ayuda.';
  return silencio >= 3 ? 'Contacta para conocer qué necesita y crea una oportunidad si hay interés.' : 'Registra lo que necesita y crea una oportunidad si hay interés.';
}

export async function resumirContacto(c, d) {
  return `${fichaTexto(c, d)}\n\nSiguiente paso: ${siguientePaso(c, d)}`;
}

/* ───── 5. Chat: HGLmini enruta la pregunta y el CRM responde con datos reales ───── */
const RUTAS = {
  hoy: /(hoy|que (hago|deberia hacer|tengo)|pendiente|tareas?|agenda|prioridad|urgente)/,
  riesgo: /(riesgo|perdiendo|dormid|inactiv|no compran|recuperar|reactivar)/,
  embudo: /(embudo|pipeline|oportunidad|negocios abiertos|tratos|etapas?)/,
  ventas: /(ventas|vendido|factur|ingres|resultado|cuanto (he|hemos) (vendido|ganado)|mes|semana)/,
  mejores: /(mejores clientes|top|campeon|leales|vip|quien compra mas)/,
  consejo: /(idea|consejo|como (consigo|consigo|puedo conseguir|vender|mejorar|captar)|mas clientes|estrategia|recomiend)/,
  ayuda: /^(ayuda|help|que puedes hacer|que sabes hacer|como funcionas)/,
};
const ETIQUETAS_IA = { today: 'hoy', tasks: 'hoy', risk: 'riesgo', pipeline: 'embudo', sales: 'ventas', best: 'mejores', advice: 'consejo', help: 'ayuda', contact: 'contacto', other: 'libre' };

export async function enrutar(pregunta, d) {
  const t = sinTildes(pregunta);
  const c = d.contactos.find((x) => {
    const partes = sinTildes(x.nombre).split(' ');
    return t.includes(sinTildes(x.nombre)) || (partes[0].length > 3 && new RegExp(`\\b${partes[0]}\\b`).test(t) && (partes.length < 2 || t.includes(partes[1]) || d.contactos.filter((y) => sinTildes(y.nombre).startsWith(partes[0] + ' ')).length === 1));
  });
  if (c) return { ruta: 'contacto', contacto: c, fuente: 'reglas' };
  for (const [k, re] of Object.entries(RUTAS)) if (re.test(t)) return { ruta: k, fuente: 'reglas' };
  const qa = await buscarConocimiento(pregunta);
  if (qa) return { ruta: 'conocimiento', qa, fuente: 'reglas' };
  if (iaLista()) try {
    // Pocos ejemplos bastan para que un modelo pequeño enrute bien; «other» para lo que no es del CRM.
    const r = await pedirJSON(
      'You route questions inside a CRM app (questions may be in Spanish). Reply ONLY with JSON {"route": "..."} where route is one of: today, risk, pipeline, sales, best, advice, help, other.\n' +
      'Examples:\n"¿a quién llamo primero?" → {"route":"today"}\n"¿quién lleva tiempo sin comprar?" → {"route":"risk"}\n"¿cuántos presupuestos tengo abiertos?" → {"route":"pipeline"}\n"¿cuánto he facturado?" → {"route":"sales"}\n"¿quién me compra más?" → {"route":"best"}\n"¿cómo puedo vender más?" → {"route":"advice"}\n"¿qué es la fotosíntesis?" → {"route":"other"}\n"¿cuál es la capital de Italia?" → {"route":"other"}',
      pregunta,
    );
    const ruta = ETIQUETAS_IA[String(r.route || '').toLowerCase()];
    if (ruta && ruta !== 'contacto' && ruta !== 'libre') return { ruta, fuente: 'ia' };
  } catch {}
  return { ruta: 'libre', fuente: 'ia' };
}

function lineas(arr) { return arr.filter(Boolean).map((x) => `• ${x}`).join('\n'); }

async function responderRuta(r, pregunta, d, opciones) {
  const p = pendientesDeHoy(d);
  const res = resultados(d, 30);
  switch (r.ruta) {
    case 'hoy': {
      if (!p.total && !p.riesgo.length) return 'Hoy no tienes nada pendiente. Buen momento para contactar con clientes en riesgo o pedir reseñas a tus mejores clientes.';
      const out = [];
      for (const t of p.tareas.slice(0, 5)) out.push(`${t.vence < hoyISO() ? '⚠ ' : ''}${t.titulo}${d.porId.get(t.contacto) ? ` (${d.porId.get(t.contacto).nombre})` : ''}${t.vence < hoyISO() ? ` · venció ${fecha(t.vence)}` : ''}`);
      for (const t of p.tratosVencidos.slice(0, 3)) out.push(`Revisa «${t.titulo}» (${dinero(t.valor)}): la fecha de cierre ya pasó.`);
      for (const c of p.silencio.slice(0, 3)) out.push(`Retoma el contacto con ${c.nombre}: sin noticias ${hace(c._ultimaActividad)}.`);
      for (const c of p.riesgo.slice(0, 2)) out.push(`Recupera a ${c.nombre} (cliente en riesgo, ${dinero(c._gastado)} gastados).`);
      return `Esto es lo más importante para hoy, por orden:\n${lineas(out)}`;
    }
    case 'riesgo': {
      const l = d.contactos.filter((c) => ['riesgo', 'dormido'].includes(c._segmento)).sort((a, b) => b._gastado - a._gastado).slice(0, 8);
      if (!l.length) return 'No tienes clientes en riesgo ahora mismo. 👍';
      return `Clientes que se están enfriando (de más a menos valiosos):\n${lineas(l.map((c) => `${c.nombre}: última compra ${hace(c._ultimaCompra)}, ${dinero(c._gastado)} en total (${SEGMENTOS[c._segmento].nombre.toLowerCase()})`))}\n\nConsejo: mándales un mensaje de reactivación desde su ficha («Redactar mensaje» → Retomar el contacto).`;
    }
    case 'embudo': {
      const ab = res.embudo.filter((e) => e.tipo === 'abierta' && e.n);
      return `Tienes ${dinero(res.pipeline)} abiertos en el embudo:\n${lineas(ab.map((e) => `${e.nombre}: ${e.n} ${e.n === 1 ? 'oportunidad' : 'oportunidades'} (${dinero(e.valor)})`))}${res.actual.tasa !== null ? `\n\nTu tasa de cierre en los últimos 30 días es del ${res.actual.tasa} %.` : ''}`;
    }
    case 'ventas': {
      const a = res.actual; const b = res.anterior;
      const total = a.valorGanado + a.ventas; const antes = b.valorGanado + b.ventas;
      return `Últimos 30 días: ${dinero(total)} cerrados (${a.ganados} oportunidades ganadas y ${a.numVentas} compras), frente a ${dinero(antes)} en los 30 días anteriores.\nContactos nuevos: ${a.nuevos} (antes ${b.nuevos}).${a.tasa !== null ? ` Tasa de cierre: ${a.tasa} %.` : ''}`;
    }
    case 'mejores': {
      const l = [...d.contactos].filter((c) => c._compras).sort((a, b) => b._gastado - a._gastado).slice(0, 6);
      if (!l.length) return 'Aún no hay compras registradas. Regístralas en la ficha de cada contacto («Registrar compra»).';
      return `Tus mejores clientes por gasto:\n${lineas(l.map((c) => `${c.nombre}: ${dinero(c._gastado)} en ${c._compras} ${c._compras === 1 ? 'compra' : 'compras'} (${SEGMENTOS[c._segmento].nombre})`))}`;
    }
    case 'contacto': return `${fichaTexto(r.contacto, d)}\n\nSiguiente paso: ${siguientePaso(r.contacto, d)}`;
    case 'conocimiento': return `${r.qa.respuesta}\n\n(Según tu información del negocio: «${r.qa.pregunta}»)`;
    case 'consejo': {
      const ideas = [];
      if (p.silencio.length) ideas.push(`Tienes ${p.silencio.length} leads sin noticias: un mensaje corto de seguimiento recupera muchos.`);
      if (res.segmentos.campeon || res.segmentos.leal) ideas.push('Pide a tus mejores clientes una reseña o que te recomienden: es la venta más barata.');
      if (res.segmentos.riesgo || res.segmentos.dormido) ideas.push('Lanza una oferta de reactivación para los clientes en riesgo y dormidos.');
      const origen = Object.entries(res.origenes).sort((a, b) => b[1].valor - a[1].valor)[0];
      if (origen && origen[0] !== 'Sin origen') ideas.push(`Tu canal con más ventas es «${origen[0]}»: refuérzalo antes de abrir otros.`);
      ideas.push('Responde rápido: contestar en menos de una hora multiplica las opciones de cerrar.', 'Después de cada venta, agenda una tarea de seguimiento a los 15–30 días.');
      return `Ideas para vender más con lo que veo en tu CRM:\n${lineas(ideas.slice(0, 5))}`;
    }
    case 'ayuda': return 'Puedo ayudarte con:\n• «¿Qué hago hoy?»: tus prioridades\n• «Clientes en riesgo» y «mis mejores clientes»\n• «Cómo va el embudo» y «ventas del mes»\n• El nombre de un contacto: su resumen y siguiente paso\n• Preguntas sobre tu negocio (las que guardes en Ajustes → Conocimiento)\nY en las otras pestañas: redactar mensajes, clasificar mensajes de clientes y sacar contactos de un texto.';
    default: {
      const pf = await perfilNegocio();
      let t = '';
      if (iaLista()) try {
        t = await conversar([
          { role: 'system', content: `Eres el asistente de ventas de «${pf.negocio}». Respondes en español de España, en 2 a 4 frases, de forma práctica.` },
          { role: 'user', content: pregunta },
        ], { ...opciones, max: 200, onTexto: undefined });
      } catch (e) { if (opciones.senal?.aborted) throw e; }
      if (esEspanolValido(t)) return t;
      return 'Esa pregunta es demasiado abierta para una IA tan pequeña como yo, que funciona dentro de tu dispositivo. Prueba con algo como «¿qué hago hoy?», «clientes en riesgo», «cómo va el embudo» o el nombre de un contacto. Escribe «ayuda» para ver todo lo que sé hacer.';
    }
  }
}

export async function charlar(historial, d, _contacto, opciones = {}) {
  const pregunta = historial.at(-1)?.texto || '';
  const r = await enrutar(pregunta, d);
  let texto = await responderRuta(r, pregunta, d, opciones);
  const TEMAS = { hoy: 'tus prioridades de hoy', riesgo: 'clientes en riesgo', embudo: 'tu embudo de ventas', ventas: 'tus ventas', mejores: 'tus mejores clientes', consejo: 'ideas para vender más', ayuda: 'qué sé hacer' };
  if (r.fuente === 'ia' && TEMAS[r.ruta]) texto = `Entiendo que me preguntas por ${TEMAS[r.ruta]}. Si no es eso, escribe «ayuda».\n\n${texto}`;
  opciones.onTexto?.(texto);
  return texto;
}
