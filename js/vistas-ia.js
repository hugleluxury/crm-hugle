// Pantallas de HGLmini1.2flash y de Ajustes.
import * as db from './db.js';
import { $, $$, esc, icono, aviso, modal, confirmar, datosForm, descargar, elegirArchivo, hoyISO } from './util.js';
import { NOMBRE_IA, MODELO_POR_DEFECTO, TAMANO_MB, alCambiarIA, estadoIA, encender, encenderDesdeArchivo, apagar, borrarModelo, enCache, lista as iaLista } from './ia.js';
import * as H from './herramientas-ia.js';
import { ETAPAS_POR_DEFECTO, ORIGENES, registrar, cargarEjemplo, borrarEjemplo, buscarDuplicado } from './negocio.js';
import { enviarPlantilla } from './vistas.js';
import { panelAgentes, panelBandeja, panelJefa } from './vistas-agentes.js';
import { AGENTES, IDS } from './agentes.js';
import { SECTORES } from './sectores.js';
import { cuenta, urlPanel, salir } from './plataforma.js';
import { PLATAFORMA } from './config.js';
import { tarjetaConexiones } from './conexiones.js';

let controlador = null; // para detener la respuesta en curso
const parar = () => { controlador?.abort(); controlador = null; };

/* Tarjeta de estado y activación de la IA */
function tarjetaIA(el, ctx) {
  el.innerHTML = `<div class="tarjeta pila">
    <div class="ia-cab"><img src="img/hglmini.svg" alt=""><div class="crece"><h2>${NOMBRE_IA}</h2><div class="tenue" id="ia-est">—</div></div><div id="ia-acc" class="fila"></div></div>
    <div class="progreso oculto" id="ia-prog"><i></i></div>
    <p class="tenue" style="margin:0" id="ia-nota">La IA viene incluida en el CRM y trabaja dentro de este dispositivo: tus clientes nunca salen de aquí. La primera vez que abres el CRM se instala sola (${TAMANO_MB} MB, una única vez); desde ese momento funciona sin conexión a internet.</p>
  </div>`;
  const pintar = async (s) => {
    if (!el.isConnected) return quitar();
    const est = $('#ia-est', el); const acc = $('#ia-acc', el); const prog = $('#ia-prog', el);
    prog.classList.toggle('oculto', !['instalando', 'descargando', 'cargando'].includes(s.fase));
    prog.firstElementChild.style.width = (s.fase === 'cargando' ? 100 : s.progreso) + '%';
    if (s.fase === 'lista') {
      est.innerHTML = `<i class="punto ok"></i> Activa · ${s.gpu ? 'WebGPU' : `${s.hilos} ${s.hilos === 1 ? 'hilo' : 'hilos'} de CPU`}`;
      acc.innerHTML = `<button class="btn peq" id="ia-off">Apagar</button>`;
      $('#ia-off', el).onclick = () => apagar();
    } else if (s.fase === 'instalando') {
      est.innerHTML = `<i class="punto va"></i> Instalando la IA en este dispositivo… ${s.progreso} %`; acc.innerHTML = '';
    } else if (s.fase === 'descargando') {
      est.innerHTML = `<i class="punto va"></i> Descargando… ${s.progreso} %`; acc.innerHTML = '';
    } else if (s.fase === 'cargando') {
      est.innerHTML = '<i class="punto va"></i> Preparando la IA…'; acc.innerHTML = '';
    } else {
      const guardada = await enCache((await db.ajuste('iaModelo')) || MODELO_POR_DEFECTO);
      est.innerHTML = s.fase === 'error' ? `<i class="punto mal"></i> ${esc(s.error)}` : `<i class="punto"></i> ${guardada ? 'Instalada · apagada (funciona sin internet)' : 'Pendiente de instalar'}`;
      acc.innerHTML = `<button class="btn grad" id="ia-on">${icono('ia')}${guardada ? 'Activar' : 'Instalar y activar'}</button>`;
      $('#ia-on', el).onclick = () => activar();
    }
  };
  const quitar = alCambiarIA(pintar);
  ctx.limpiar = () => { quitar(); parar(); };
}

export async function activar() {
  try {
    await encender((await db.ajuste('iaModelo')) || MODELO_POR_DEFECTO);
    await db.fijar('iaUsada', true);
    aviso(`${NOMBRE_IA} lista`);
  } catch (e) { aviso(estadoIA().error || 'No se pudo activar la IA'); }
}

async function asegurarIA() {
  if (iaLista()) return true;
  const s = estadoIA();
  if (['instalando', 'descargando', 'cargando'].includes(s.fase)) { aviso('La IA se está preparando…'); await encender((await db.ajuste('iaModelo')) || MODELO_POR_DEFECTO).catch(() => {}); return iaLista(); }
  const origen = await db.ajuste('iaModelo');
  if (origen && !(await enCache(origen)) && !(await confirmar('Para usar el modelo que has elegido hay que descargarlo una vez. ¿Descargar ahora?', 'Descargar'))) return false;
  await activar();
  return iaLista();
}

/* ───────────── ASISTENTE ───────────── */
export async function asistente(el, ctx) {
  const PEST = { agentes: 'Agentes', bandeja: 'Bandeja', jefa: 'Jefa de personal', redactar: 'Redactar mensaje', clasificar: 'Clasificar mensaje', extraer: 'Sacar contacto de un texto' };
  const pest = PEST[ctx.pestanaIA] ? ctx.pestanaIA : 'agentes';
  const sinLeer = (await db.todos('bandeja')).filter((x) => !x.leida).length;
  el.innerHTML = `<details class="tarjeta-ia" ${ctx.verIA ? 'open' : ''}><summary class="tenue">${icono('ia')}Motor de IA: ${NOMBRE_IA} <span id="ia-mini"></span></summary><div id="ia-tarjeta" style="margin-top:10px"></div></details>
    <div class="filtros" style="margin:12px 0 14px">${Object.entries(PEST).map(([k, t]) => `<button data-p="${k}" class="${k === pest ? 'activo' : ''}">${t}${k === 'bandeja' && sinLeer ? ` (${sinLeer})` : ''}</button>`).join('')}</div>
    <div id="ia-panel"></div>`;
  tarjetaIA($('#ia-tarjeta', el), ctx);
  const det = el.querySelector('.tarjeta-ia');
  det.addEventListener('toggle', () => { ctx.verIA = det.open; });
  const quitarMini = alCambiarIA((s) => { const m = $('#ia-mini', el); if (m) m.innerHTML = s.fase === 'lista' ? '<i class="punto ok"></i> activa' : ['instalando', 'descargando'].includes(s.fase) ? `<i class="punto va"></i> instalando ${s.progreso} %` : s.fase === 'cargando' ? '<i class="punto va"></i> preparando…' : '<i class="punto"></i> apagada (los agentes funcionan igual con reglas)'; });
  const limpiar = ctx.limpiar; ctx.limpiar = () => { quitarMini(); limpiar?.(); };
  $$('[data-p]', el).forEach((b) => b.addEventListener('click', () => { parar(); ctx.pestanaIA = b.dataset.p; ctx.pintar(); }));
  const panel = $('#ia-panel', el);
  await ({ agentes: panelAgentes, bandeja: panelBandeja, jefa: panelJefa, redactar: panelRedactar, clasificar: panelClasificar, extraer: panelExtraer })[pest](panel, ctx);
}

function selectorContactos(ctx, sel) {
  return `<select name="contacto" class="entrada"><option value="">Elige un contacto…</option>${[...ctx.datos.contactos].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>`;
}

async function panelRedactar(el, ctx, cid = null) {
  el.innerHTML = `<div class="tarjeta"><form class="form" id="f-red">
    <label class="campo"><span>Contacto</span>${selectorContactos(ctx, cid)}</label>
    <label class="campo"><span>Objetivo</span><select name="objetivo">${Object.entries(H.OBJETIVOS).map(([k, v]) => `<option value="${k}">${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></label>
    <label class="campo"><span>Canal</span><select name="canal"><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select></label>
    <label class="campo"><span>Detalle (opcional)</span><input name="detalle" placeholder="p. ej. ofrecer un 10 % este mes"></label>
    <div class="todo fila"><button class="btn grad">${icono('ia')}Redactar</button></div>
    <div class="todo resultado" id="salida" contenteditable="true" aria-label="Mensaje redactado (puedes editarlo)"></div>
    <div class="todo fila oculto" id="acciones"><button type="button" class="btn" id="otra">Otra versión</button><button type="button" class="btn" id="con-ia">${icono('ia')}Que la escriba la IA (experimental)</button><button type="button" class="btn" id="copiar">${icono('copiar')}Copiar</button><button type="button" class="btn prim" id="usar">${icono('enviar')}Enviar…</button><span class="tenue" id="origen"></span></div>
  </form></div>`;
  const form = $('#f-red', el); const salida = $('#salida', el);
  let variante = 0;
  const generar = async (usarIA = false) => {
    const v = datosForm(form);
    const c = ctx.datos.porId.get(v.contacto);
    if (!c) { aviso('Elige un contacto'); return; }
    if (usarIA && !(await asegurarIA())) return;
    parar(); controlador = new AbortController();
    salida.textContent = ''; salida.classList.add('pensando');
    try {
      const r = await H.redactar({ contacto: c, d: ctx.datos, ...v, variante, usarIA, senal: controlador.signal, onTexto: (t) => (salida.textContent = t) });
      salida.textContent = r.texto;
      $('#origen', el).textContent = r.origen === 'ia' ? `Escrito por ${NOMBRE_IA}. Revísalo antes de enviar.` : usarIA ? `${NOMBRE_IA} no dio un texto fiable; te dejo la plantilla inteligente.` : 'Plantilla inteligente rellenada con los datos del contacto. Puedes editarla.';
    } catch (err) { if (!/abort/i.test(err?.message)) salida.textContent = 'Error: ' + err.message; }
    controlador = null; salida.classList.remove('pensando');
    $('#acciones', el).classList.remove('oculto');
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); variante = 0; generar(); });
  $('#otra', el).addEventListener('click', () => { variante++; generar(); });
  $('#con-ia', el).addEventListener('click', () => generar(true));
  $('#copiar', el).addEventListener('click', async () => { try { await navigator.clipboard.writeText(salida.innerText); aviso('Copiado'); } catch {} });
  $('#usar', el).addEventListener('click', () => {
    const c = ctx.datos.porId.get(form.contacto.value);
    if (c) enviarPlantilla(ctx, c, form.canal.value, salida.innerText);
  });
}

export function redactarPara(ctx, c) {
  const d = modal({ titulo: `Redactar para ${c.nombre}`, ancho: true, cuerpo: '<div id="red-modal"></div>' });
  panelRedactar(d.querySelector('#red-modal'), ctx, c.id);
  d.addEventListener('close', parar);
}

export async function resumenPara(ctx, c, salida) {
  salida.classList.remove('oculto');
  salida.textContent = await H.resumirContacto(c, ctx.datos);
}

async function panelClasificar(el, ctx) {
  el.innerHTML = `<div class="rejilla r-2"><div class="tarjeta pila">
      <h2>Pega el mensaje de un cliente</h2>
      <p class="tenue" style="margin:0">${NOMBRE_IA} detecta qué quiere, lo urgente que es y te propone una respuesta. Puedes guardarlo en un contacto y moverlo en el embudo.</p>
      <textarea class="entrada" id="msg" rows="6" placeholder="Ej.: Hola, ¿cuánto cuesta el pack completo? Lo necesitaría para la semana que viene."></textarea>
      <label class="campo"><span>Contacto (opcional)</span>${selectorContactos(ctx)}</label>
      <div class="fila"><button class="btn grad" id="b-clas">${icono('ia')}Clasificar</button></div>
    </div>
    <div class="tarjeta pila" id="res"><h2>Resultado</h2><p class="tenue">Aquí aparecerá la clasificación.</p></div></div>`;
  $('#b-clas', el).addEventListener('click', async () => {
    const texto = $('#msg', el).value.trim();
    if (!texto) { aviso('Pega un mensaje'); return; }
    if (!(await asegurarIA())) return;
    const res = $('#res', el);
    res.innerHTML = '<h2>Resultado</h2><div class="resultado pensando">Analizando…</div>';
    const cid = el.querySelector('[name=contacto]').value;
    const c = ctx.datos.porId.get(cid);
    let r;
    try { r = await H.clasificar(texto, c); } catch (e) { res.innerHTML = `<h2>Resultado</h2><div class="aviso">${esc(e.message)}</div>`; return; }
    const color = { alta: 'rojo', media: 'ambar', baja: '' }[r.urgencia];
    const etapa = r.etapa && ctx.datos.etapas.find((e) => e.id === r.etapa);
    res.innerHTML = `<h2>Resultado</h2>
      <div class="fila"><span class="etiqueta azul">${esc(r.nombre)}</span><span class="etiqueta ${color}">Urgencia ${esc(r.urgencia)}</span><span class="tenue">${r.fuente === 'ia' ? `Decidido por ${NOMBRE_IA}` : 'Detectado por las reglas de HGLmini'}</span></div>
      ${r.conocimiento ? `<p class="tenue" style="margin:0">Respuesta basada en tu conocimiento: «${esc(r.conocimiento)}»</p>` : ''}
      <label class="campo"><span>Respuesta sugerida</span><textarea class="entrada" id="resp" rows="4">${esc(r.respuesta)}</textarea></label>
      <div class="fila">${c ? `<button class="btn" id="b-guardar">Guardar en ${esc(c.nombre.split(' ')[0])}</button>${etapa ? `<button class="btn" id="b-mover">Crear oportunidad en «${esc(etapa.nombre)}»</button>` : ''}<button class="btn prim" id="b-resp">${icono('whatsapp')}Responder</button>` : '<span class="tenue">Elige un contacto para guardar el mensaje o responder.</span>'}</div>`;
    $('#b-guardar', res)?.addEventListener('click', async () => { await registrar(c.id, 'mensaje', `Mensaje recibido (${r.nombre}): ${texto}`); aviso('Guardado en el historial'); });
    $('#b-mover', res)?.addEventListener('click', async () => {
      await db.guardar('tratos', { contacto: c.id, titulo: r.resumen || 'Nueva consulta', valor: 0, etapa: etapa.id, cerrado: etapa.tipo !== 'abierta' ? new Date().toISOString() : null });
      await registrar(c.id, 'sistema', `Oportunidad creada desde un mensaje (${r.nombre}).`);
      aviso('Oportunidad creada');
    });
    $('#b-resp', res)?.addEventListener('click', () => enviarPlantilla(ctx, c, 'whatsapp', $('#resp', res).value));
  });
}

async function panelExtraer(el, ctx) {
  el.innerHTML = `<div class="rejilla r-2"><div class="tarjeta pila">
      <h2>Pega una firma de email, un mensaje o una tarjeta</h2>
      <textarea class="entrada" id="txt" rows="7" placeholder="Ej.: Soy Laura Gómez, de Reformas Gómez en Valencia. Me interesa un presupuesto para una cocina. Mi móvil es 612 345 678 y mi correo laura@reformasgomez.es"></textarea>
      <div class="fila"><button class="btn grad" id="b-ext">${icono('ia')}Sacar datos</button></div>
    </div><div class="tarjeta pila" id="res"><h2>Contacto</h2><p class="tenue">Los datos aparecerán aquí para revisarlos antes de guardar.</p></div></div>`;
  $('#b-ext', el).addEventListener('click', async () => {
    const texto = $('#txt', el).value.trim();
    if (!texto) { aviso('Pega un texto'); return; }
    if (!(await asegurarIA())) return;
    const res = $('#res', el);
    res.innerHTML = '<h2>Contacto</h2><div class="resultado pensando">Leyendo…</div>';
    const r = await H.extraer(texto).catch((e) => ({ ...H.extraerPorReglas(texto), error: e.message }));
    res.innerHTML = `<h2>Contacto</h2><form class="form" id="f-ext">
      <label class="campo todo"><span>Nombre *</span><input name="nombre" required value="${esc(r.nombre || '')}"></label>
      <label class="campo"><span>Teléfono</span><input name="telefono" value="${esc(r.telefono || '')}"></label>
      <label class="campo"><span>Email</span><input name="email" value="${esc(r.email || '')}"></label>
      <label class="campo"><span>Empresa</span><input name="empresa" value="${esc(r.empresa || '')}"></label>
      <label class="campo"><span>Ciudad</span><input name="ciudad" value="${esc(r.ciudad || '')}"></label>
      <label class="campo"><span>Origen</span><select name="origen"><option value="">—</option>${ORIGENES.map((o) => `<option>${o}</option>`).join('')}</select></label>
      <label class="campo"><span>Interés</span><input name="interes" value="${esc(r.interes || '')}"></label>
      <div class="todo fila"><button class="btn prim">${icono('check')}Guardar contacto</button></div></form>`;
    $('#f-ext', res).addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = datosForm(e.target);
      if (!v.nombre) { aviso('Falta el nombre'); return; }
      const dup = buscarDuplicado(ctx.datos.contactos, v);
      if (dup && !(await confirmar(`Ya existe «${dup.nombre}» con ese teléfono o email. ¿Crear otro?`, 'Crear'))) return;
      const { interes, ...datos } = v;
      const c = await db.guardar('contactos', { ...datos, etiquetas: [] });
      await registrar(c.id, 'nota', `Primer contacto: ${texto}${interes ? `\nInterés: ${interes}` : ''}`);
      aviso('Contacto creado');
      ctx.ir('contacto', c.id);
    });
  });
}

/* ───────────── AJUSTES ───────────── */
export async function ajustes(el, ctx) {
  const a = {};
  for (const k of ['negocio', 'yo', 'sector', 'sectorId', 'tono', 'infoNegocio', 'color', 'logo', 'moneda', 'diasSilencio', 'iaAuto', 'iaModelo', 'ejemplo', ...IDS.map((x) => 'agente_' + x)]) a[k] = await db.ajuste(k);
  const sec = SECTORES[a.sectorId] || SECTORES.general;
  const cta = cuenta();
  const etapas = (await db.ajuste('etapas')) || ETAPAS_POR_DEFECTO;
  const qa = await db.todos('conocimiento');
  const uso = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  el.innerHTML = `<div class="rejilla r-2">
  <div class="pila">
    <div class="tarjeta"><h2>Tu negocio</h2><form class="form" id="f-neg">
      <label class="campo"><span>Nombre del negocio</span><input name="negocio" value="${esc(a.negocio || '')}" placeholder="Mi negocio"></label>
      <label class="campo"><span>Tu nombre (para firmar mensajes)</span><input name="yo" value="${esc(a.yo || '')}"></label>
      <label class="campo"><span>Sector (especializa a tus agentes)</span><select name="sectorId">${Object.entries(SECTORES).map(([k, x]) => `<option value="${k}" ${k === (a.sectorId || 'general') ? 'selected' : ''}>${x.nombre}</option>`).join('')}</select></label>
      <label class="campo"><span>Especialidad (opcional)</span><input name="sector" value="${esc(a.sector || '')}" placeholder="p. ej. clínica dental, moda mujer…"></label>
      <label class="campo"><span>Tono de los mensajes</span><select name="tono">${['cercano y profesional', 'formal', 'muy cercano y amable', 'directo y breve'].map((t) => `<option ${t === (a.tono || 'cercano y profesional') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo todo"><span>Qué vendes y cómo trabajas (lo usa la IA)</span><textarea name="infoNegocio" rows="3" placeholder="Servicios, precios orientativos, zona, horario…">${esc(a.infoNegocio || '')}</textarea></label>
      <label class="campo"><span>Moneda</span><select name="moneda">${['EUR', 'USD', 'MXN', 'COP', 'ARS', 'CLP', 'PEN', 'GBP'].map((m) => `<option ${m === (a.moneda || 'EUR') ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label class="campo"><span>Avisar si un lead lleva sin noticias (días)</span><input name="diasSilencio" type="number" min="1" max="90" value="${esc(a.diasSilencio || 7)}"></label>
      <label class="campo"><span>Color de marca</span><input name="color" type="color" value="${esc(a.color || '#4285F4')}" style="padding:4px;height:40px"></label>
      <div class="campo"><span>Logo</span><div class="fila"><img src="${esc(a.logo || 'img/logo.svg')}" alt="" style="width:40px;height:40px;border-radius:10px;object-fit:contain;background:var(--sup-2)"><button type="button" class="btn peq" id="b-logo">Cambiar</button>${a.logo ? '<button type="button" class="btn fant peq" id="b-logo-x">Quitar</button>' : ''}</div></div>
      <div class="todo fila"><button class="btn prim">Guardar</button>${a.color ? '<button type="button" class="btn fant" id="b-color-x">Color original</button>' : ''}</div></form></div>

    <div class="tarjeta pila"><h2>Tu equipo de agentes</h2>
      <p class="tenue" style="margin:0">Ponles el nombre que quieras. Trabajan con el ciclo de compra de tu sector (${sec.ciclo} días): a partir de ahí, un cliente está «en riesgo».</p>
      <form class="form" id="f-ag">${IDS.map((k) => `<label class="campo"><span>${AGENTES[k].rol}</span><input name="agente_${k}" value="${esc(a['agente_' + k] || AGENTES[k].nombre)}" maxlength="24"></label>`).join('')}<div class="todo fila"><button class="btn prim">Guardar nombres</button></div></form></div>

    <div class="tarjeta"><div class="fila entre"><h2>Etapas del embudo</h2><span class="fila">${sec.etapas ? `<button class="btn fant peq" id="b-etapas-sector">Las de mi sector</button>` : ''}<button class="btn peq" id="b-etapa">${icono('mas')}Añadir</button></span></div>
      <p class="tenue">Ponlas en el orden de tu proceso de venta. «Ganada» y «Perdida» cierran la oportunidad.</p>
      <div class="pila" id="etapas">${etapas.map((e, i) => `<div class="fila" data-i="${i}" style="flex-wrap:nowrap">
        <input type="color" value="${esc(e.color)}" data-k="color" style="width:36px;height:36px;padding:2px;border:0;background:none">
        <input class="entrada crece" value="${esc(e.nombre)}" data-k="nombre">
        <select class="entrada" data-k="tipo" style="width:auto">${[['abierta', 'Abierta'], ['ganada', 'Ganada'], ['perdida', 'Perdida']].map(([v, t]) => `<option value="${v}" ${v === e.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <button class="btn fant ico peq" data-sube aria-label="Subir">↑</button><button class="btn fant ico peq peligro" data-quita aria-label="Quitar">${icono('x')}</button></div>`).join('')}</div>
      <div class="fila" style="margin-top:12px"><button class="btn prim" id="b-etapas">Guardar etapas</button></div></div>
  </div>

  <div class="pila">
    ${PLATAFORMA.requiereCuenta ? `<div class="tarjeta pila"><h2>Tu cuenta HUGLE</h2>
      ${cta ? `<p style="margin:0"><b>${esc(cta.nombre || cta.email)}</b> · ${esc(cta.email)}</p><div class="fila">${['crm', 'studio', 'business'].map((x) => `<span class="etiqueta ${cta.apps.includes(x) ? 'verde' : ''}">${x.toUpperCase()} HUGLE${cta.apps.includes(x) ? '' : ' · sin activar'}</span>`).join('')}</div>` : ''}
      <p class="tenue" style="margin:0">La cuenta solo sirve para entrar y para las apps de pago. Tus clientes no salen de este dispositivo.</p>
      <div class="fila"><a class="btn" href="${urlPanel()}">Abrir mi Control Center</a><button class="btn fant" id="b-salir">Cerrar sesión</button></div></div>` : ''}
    <div id="con-tarjeta"></div>
    <div id="ia-tarjeta"></div>
    <div class="tarjeta pila"><h2>Opciones de la IA</h2>
      <label class="fila"><input type="checkbox" id="ia-auto" ${a.iaAuto !== false ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--marca)"> Encenderla sola al abrir el CRM</label>
      <div class="fila"><button class="btn peq" id="b-gguf">${icono('subir')}Cargar un archivo .gguf</button><button class="btn peq peligro" id="b-borrar-ia">${icono('papelera')}Desinstalar la IA</button></div>
      <details><summary class="tenue" style="cursor:pointer">Avanzado: usar otro modelo</summary>
        <div class="pila" style="margin-top:10px"><input class="entrada mono" id="ia-url" value="${esc(a.iaModelo || '')}" placeholder="Modelo incluido (${NOMBRE_IA}) · o una URL https a un .gguf"><div class="fila"><button class="btn peq" id="b-url">Guardar origen</button><button class="btn fant peq" id="b-url-x">Usar el incluido</button></div>
        <p class="tenue" style="margin:0">Cualquier GGUF pequeño (≤ 2 GB, ideal &lt; 1 GB) compatible con llama.cpp; se descarga de internet una vez. El modelo incluido es MNN-Pocket-0.3B Instruct Q4_1 (Apache-2.0) y no necesita conexión.</p></div></details>
    </div>

    <div class="tarjeta"><div class="fila entre"><h2>Conocimiento del negocio</h2><button class="btn peq" id="b-qa">${icono('mas')}Añadir</button></div>
      <p class="tenue">Preguntas frecuentes con su respuesta. ${NOMBRE_IA} las usa para contestar y redactar sin inventar.</p>
      ${qa.length ? `<ul class="lista" style="margin:0 -18px -18px">${qa.map((x) => `<li class="clic" data-qa="${x.id}"><div class="crece"><div class="tit">${esc(x.pregunta)}</div><div class="sub">${esc(x.respuesta)}</div></div></li>`).join('')}</ul>` : ''}
    </div>

    <div class="tarjeta pila"><h2>Tus datos</h2>
      <p class="tenue" style="margin:0">${icono('escudo')} Todo se guarda solo en este navegador${uso ? ` (${Math.round((uso.usage || 0) / 1048576)} MB usados)` : ''}. Haz una copia de seguridad de vez en cuando y úsala para pasar tus datos a otro dispositivo.</p>
      <div class="fila"><button class="btn" id="b-copia">${icono('bajar')}Descargar copia</button><button class="btn" id="b-restaurar">${icono('subir')}Restaurar copia</button></div>
      <div class="fila">${a.ejemplo ? '<button class="btn" id="b-sin-ejemplo">Quitar datos de ejemplo</button>' : '<button class="btn" id="b-ejemplo">Cargar datos de ejemplo</button>'}<button class="btn peligro" id="b-todo">${icono('papelera')}Borrar todo</button></div>
    </div>
    <p class="tenue">CRM HUGLE ${(await import('./app.js')).VERSION} · Código abierto (MIT) · IA ${NOMBRE_IA} basada en MNN-Pocket-0.3B (Apache-2.0) y wllama (MIT) · Memoria, habilidades y rutinas inspiradas en Hermes Agent (MIT).</p>
  </div></div>`;

  tarjetaIA($('#ia-tarjeta', el), ctx);
  tarjetaConexiones($('#con-tarjeta', el), ctx);

  // Negocio y marca
  const fneg = $('#f-neg', el);
  let logoNuevo = null;
  fneg.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = datosForm(fneg);
    for (const [k, val] of Object.entries(v)) await db.fijar(k, k === 'diasSilencio' ? Number(val) || 7 : val);
    if (logoNuevo) await db.fijar('logo', logoNuevo);
    await ctx.aplicarMarca(); aviso('Ajustes guardados'); ctx.pintar();
  });
  $('#b-color-x', el)?.addEventListener('click', async () => { await db.fijar('color', ''); await ctx.aplicarMarca(); ctx.pintar(); });
  $('#b-logo', el).addEventListener('click', async () => {
    const f = await elegirArchivo('image/*');
    if (!f) return;
    logoNuevo = await reducirImagen(f, 256);
    fneg.querySelector('img').src = logoNuevo;
    aviso('Pulsa Guardar para aplicar el logo');
  });
  $('#b-logo-x', el)?.addEventListener('click', async () => { await db.fijar('logo', ''); await ctx.aplicarMarca(); ctx.pintar(); });

  // Cuenta y agentes
  $('#b-salir', el)?.addEventListener('click', async () => { if (await confirmar('¿Cerrar sesión en este dispositivo? Tus datos se quedan aquí; para volver a entrar abre el CRM desde tu Control Center.', 'Cerrar sesión')) salir(); });
  $('#f-ag', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    for (const [k, v] of Object.entries(datosForm(e.target))) await db.fijar(k, v.trim());
    aviso('Nombres guardados'); ctx.pintar();
  });
  $('#b-etapas-sector', el)?.addEventListener('click', async () => {
    if (!(await confirmar(`¿Usar las etapas típicas de ${sec.nombre.toLowerCase()}? Las oportunidades de etapas que desaparezcan pasarán a «${sec.etapas[0].nombre}».`, 'Usar'))) return;
    const ids = new Set(sec.etapas.map((x) => x.id));
    for (const t of ctx.datos.tratos) if (!ids.has(t.etapa)) await db.guardar('tratos', { ...t, etapa: sec.etapas[0].id });
    await db.fijar('etapas', sec.etapas.map((x) => ({ ...x })));
    aviso('Etapas del sector aplicadas'); ctx.pintar();
  });

  // Etapas
  let lista = etapas.map((e) => ({ ...e }));
  const leer = () => $$('#etapas [data-i]', el).map((f, i) => ({ ...lista[i], nombre: f.querySelector('[data-k=nombre]').value.trim() || 'Etapa', color: f.querySelector('[data-k=color]').value, tipo: f.querySelector('[data-k=tipo]').value }));
  $$('#etapas [data-sube]', el).forEach((b) => b.addEventListener('click', async () => { const i = Number(b.closest('[data-i]').dataset.i); if (!i) return; lista = leer(); [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]]; await db.fijar('etapas', lista); ctx.pintar(); }));
  $$('#etapas [data-quita]', el).forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.closest('[data-i]').dataset.i);
    const usadas = ctx.datos.tratos.filter((t) => t.etapa === lista[i].id).length;
    if (usadas) { aviso(`Hay ${usadas} oportunidades en esa etapa: muévelas antes.`); return; }
    lista = leer(); lista.splice(i, 1); await db.fijar('etapas', lista); ctx.pintar();
  }));
  $('#b-etapa', el).addEventListener('click', async () => { lista = leer(); const pos = Math.max(0, lista.findIndex((e) => e.tipo !== 'abierta')); lista.splice(pos === -1 ? lista.length : pos, 0, { id: db.id().slice(0, 8), nombre: 'Nueva etapa', color: '#5B8DEF', tipo: 'abierta' }); await db.fijar('etapas', lista); ctx.pintar(); });
  $('#b-etapas', el).addEventListener('click', async () => {
    lista = leer();
    if (!lista.some((e) => e.tipo === 'abierta')) { aviso('Necesitas al menos una etapa abierta.'); return; }
    await db.fijar('etapas', lista); aviso('Etapas guardadas');
  });

  // IA
  $('#ia-auto', el).addEventListener('change', (e) => db.fijar('iaAuto', e.target.checked));
  $('#b-gguf', el).addEventListener('click', async () => {
    const f = await elegirArchivo('.gguf');
    if (!f) return;
    try { await encenderDesdeArchivo(f); aviso('Modelo cargado desde el archivo'); } catch (e) { aviso('No se pudo cargar: ' + e.message); }
  });
  $('#b-borrar-ia', el).addEventListener('click', async () => { if (await confirmar(`¿Desinstalar ${NOMBRE_IA} de este dispositivo? Liberas ${TAMANO_MB} MB; se volverá a instalar sola la próxima vez que abras el CRM con conexión.`, 'Desinstalar')) { await borrarModelo(); await db.fijar('iaAuto', false); aviso('IA desinstalada'); ctx.pintar(); } });
  $('#b-url', el).addEventListener('click', async () => { const u = $('#ia-url', el).value.trim(); if (!/^https?:\/\/.+\.gguf(\?.*)?$/i.test(u)) { aviso('Debe ser una URL https a un archivo .gguf'); return; } await db.fijar('iaModelo', u); await apagar(); aviso('Origen guardado'); });
  $('#b-url-x', el).addEventListener('click', async () => { await db.fijar('iaModelo', ''); await apagar(); ctx.pintar(); });

  // Conocimiento
  const editarQA = (x = null) => modal({
    titulo: x ? 'Editar' : 'Nueva pregunta frecuente',
    cuerpo: `<div class="form"><label class="campo todo"><span>Pregunta *</span><input name="pregunta" required value="${esc(x?.pregunta || '')}"></label><label class="campo todo"><span>Respuesta *</span><textarea name="respuesta" required>${esc(x?.respuesta || '')}</textarea></label></div>`,
    pie: `${x ? `<button type="button" class="btn peligro" data-borrar style="margin-right:auto">${icono('papelera')}Borrar</button>` : ''}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>`,
    alAbrir: (d) => d.querySelector('[data-borrar]')?.addEventListener('click', async () => { await db.borrar('conocimiento', x.id); d.close(); ctx.pintar(); }),
    alGuardar: async (form) => { await db.guardar('conocimiento', { ...(x || {}), ...datosForm(form) }); ctx.pintar(); },
  });
  $('#b-qa', el).addEventListener('click', () => editarQA());
  $$('[data-qa]', el).forEach((li) => li.addEventListener('click', () => editarQA(qa.find((x) => x.id === li.dataset.qa))));

  // Datos
  $('#b-copia', el).addEventListener('click', async () => { descargar(`crm-hugle-copia-${hoyISO()}.json`, JSON.stringify(await db.exportar())); await db.fijar('ultimaCopia', new Date().toISOString()); aviso('Copia descargada'); });
  $('#b-restaurar', el).addEventListener('click', async () => {
    const f = await elegirArchivo('.json,application/json');
    if (!f) return;
    try {
      const datos = JSON.parse(await f.text());
      if (!(await confirmar('Restaurar sustituye TODOS los datos actuales por los de la copia. ¿Seguir?', 'Restaurar'))) return;
      await db.importar(datos); await ctx.aplicarMarca(); aviso('Copia restaurada'); ctx.ir('inicio');
    } catch (e) { aviso(e.message || 'Archivo no válido'); }
  });
  $('#b-ejemplo', el)?.addEventListener('click', async () => { await cargarEjemplo(); aviso('Datos de ejemplo cargados'); ctx.pintar(); });
  $('#b-sin-ejemplo', el)?.addEventListener('click', async () => { await borrarEjemplo(); aviso('Datos de ejemplo quitados'); ctx.pintar(); });
  $('#b-todo', el).addEventListener('click', async () => {
    if (!(await confirmar('Esto borra TODOS los contactos, oportunidades, tareas y ajustes de este dispositivo. No se puede deshacer. ¿Seguro?', 'Borrar todo'))) return;
    for (const t of db.TABLAS) await db.vaciar(t);
    await ctx.aplicarMarca(); aviso('Datos borrados'); location.reload();
  });
}

function reducirImagen(archivo, lado) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const cv = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      ok(cv.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = mal;
    img.src = URL.createObjectURL(archivo);
  });
}
