// Pantallas de los 3 agentes IA, la Bandeja y la Jefa de personal.
import * as db from './db.js';
import { $, $$, esc, icono, aviso, modal, confirmar, datosForm, fechaHora, fecha } from './util.js';
import { NOMBRE_IA, lista as iaLista } from './ia.js';
import { HABILIDADES, IDS, equipo, agente, ejecutar, aplicarAccion, guardarHabilidad, recordar, revisarRutinas, ultimaProgramada, buscarConversaciones, FRECUENCIAS, DIAS } from './agentes.js';
import { sectorActual } from './sectores.js';
import { tieneApp, cuenta, urlPanel, recogerOrdenes, encargarAJefa } from './plataforma.js';

const SUGERENCIAS = {
  ventas: ['¿Qué hago hoy?', 'Leads sin respuesta', '¿Cómo va el embudo?', 'Oportunidades estancadas', 'Consejos para vender más'],
  atencion: ['¿Quién espera respuesta?', 'responde: ¿hacéis envíos a mi zona?', 'Quejas del último mes', 'Preguntas frecuentes de mi sector'],
  fidelizacion: ['Clientes en riesgo', '¿Quién está a punto de recomprar?', 'Prepara una campaña para clientes dormidos', 'Mis mejores clientes'],
};

const cara = (a, tam = 40) => `<span class="cara" style="--c:${a.color};width:${tam}px;height:${tam}px">${icono(a.icono)}</span>`;

/* Acciones propuestas con botón de aprobar */
function htmlAcciones(acciones = []) {
  if (!acciones.length) return '';
  const pend = acciones.filter((a) => !a.hecha).length;
  return `<div class="acciones-ag">
    <div class="fila entre"><b>${acciones.every((a) => a.tipo === 'whatsapp') ? 'Respuesta propuesta' : acciones.length === 1 ? 'Te propongo 1 tarea' : `Te propongo ${acciones.length} tareas`}</b>${pend > 1 ? '<button type="button" class="btn peq prim" data-todas>Aprobar todas</button>' : ''}</div>
    ${acciones.map((a, i) => `<div class="accion ${a.hecha ? 'hecha' : ''}" data-i="${i}">${icono(a.hecha ? 'check' : 'agenda')}<span class="crece">${esc(a.titulo)} <span class="tenue">· ${fecha(a.vence)}</span></span>${a.hecha ? `<span class="tenue">${a.tipo === 'whatsapp' ? 'Enviada' : 'Creada'}</span>` : `<button type="button" class="btn peq" data-aprobar>${a.tipo === 'whatsapp' ? 'Enviar' : 'Aprobar'}</button>`}</div>`).join('')}
  </div>`;
}
// Engancha los botones; `guardar(acciones)` persiste el estado en su registro (chat o bandeja)
function engancharAcciones(caja, acciones, guardar) {
  // Solo se marca hecha si de verdad se ha creado o enviado; los fallos se avisan y el estado se guarda siempre
  const aprobar = async (i) => {
    if (acciones[i].hecha) return false;
    if (!(await aplicarAccion(acciones[i]))) throw new Error(acciones[i].tipo === 'whatsapp' ? 'WhatsApp no está conectado: no se ha enviado.' : 'No se ha podido aplicar.');
    acciones[i].hecha = true; return true;
  };
  const texto = (n, wa) => wa ? (n === 1 ? 'Respuesta enviada por WhatsApp' : `${n} respuestas enviadas por WhatsApp`) : (n === 1 ? 'Tarea creada en Agenda' : `${n} tareas creadas en Agenda`);
  caja.querySelectorAll('[data-aprobar]').forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.closest('[data-i]').dataset.i);
    b.disabled = true;
    try { await aprobar(i); aviso(texto(1, acciones[i].tipo === 'whatsapp')); }
    catch (e) { aviso(e.message || 'No se ha podido enviar. Prueba otra vez.'); }
    finally { await guardar(acciones); repintar(); }
  }));
  caja.querySelector('[data-todas]')?.addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    let n = 0;
    try { for (let i = 0; i < acciones.length; i++) if (await aprobar(i)) n++; aviso(texto(n, acciones.every((a) => a.tipo === 'whatsapp'))); }
    catch (e) { aviso((n ? texto(n, acciones.every((a) => a.tipo === 'whatsapp')) + '. ' : '') + (e.message || 'Ha fallado una.')); }
    finally { await guardar(acciones); repintar(); }
  });
  function repintar() { const nuevo = document.createElement('div'); nuevo.innerHTML = htmlAcciones(acciones); const viejo = caja.querySelector('.acciones-ag'); viejo.replaceWith(nuevo.firstElementChild); engancharAcciones(caja, acciones, guardar); }
}

/* ───────────── Agentes ───────────── */
export async function panelAgentes(el, ctx) {
  const lista = await equipo();
  const id = IDS.includes(ctx.agente) ? ctx.agente : 'ventas';
  const yo = lista.find((a) => a.id === id);
  const s = await sectorActual();
  const historial = (await db.todos('chat')).filter((m) => (m.agente || 'ventas') === id).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const lado = ctx.ladoAgente || 'memoria';
  el.innerHTML = `<div class="agentes-sel">${lista.map((a) => `<button type="button" class="agente-tar ${a.id === id ? 'activo' : ''}" data-ag="${a.id}" style="--c:${a.color}">${cara(a)}<span><b>${esc(a.nombre)}</b><small>${esc(a.rol)}</small></span></button>`).join('')}</div>
    <p class="tenue" style="margin:10px 2px 14px">Especializados en <b>${esc(s.nombre)}</b> (cámbialo en Ajustes). ${iaLista() ? `Con ${NOMBRE_IA} activa entienden mejor lo que les pides.` : `Funcionan ya con reglas; si activas ${NOMBRE_IA} entenderán peticiones más libres.`}</p>
    <div class="agentes-cuerpo">
      <div class="tarjeta plana chat">
        <div class="mensajes" id="msgs"></div>
        <div class="sugerencias">${SUGERENCIAS[id].map((x) => `<button type="button">${esc(x)}</button>`).join('')}</div>
        <form id="f-chat"><textarea class="entrada" name="t" rows="1" placeholder="Pídele algo a ${esc(yo.nombre)}… (/ayuda)"></textarea><button class="btn prim ico" aria-label="Enviar">${icono('enviar')}</button></form>
        <div class="fila entre" style="padding:0 12px 10px"><span class="tenue">${esc(yo.nombre)} propone; tú apruebas. Nunca envía mensajes por su cuenta.</span><button class="btn fant peq" id="b-borrar">Borrar conversación</button></div>
      </div>
      <div class="tarjeta pila lado-ag">
        <div class="filtros">${[['memoria', 'Memoria'], ['habilidades', 'Habilidades'], ['rutinas', 'Rutinas'], ['buscar', 'Buscar']].map(([k, t]) => `<button type="button" data-lado="${k}" class="${k === lado ? 'activo' : ''}">${t}</button>`).join('')}</div>
        <div id="lado"></div>
      </div>
    </div>`;
  $$('[data-ag]', el).forEach((b) => b.addEventListener('click', () => { ctx.agente = b.dataset.ag; ctx.pintar(); }));
  $$('[data-lado]', el).forEach((b) => b.addEventListener('click', () => { ctx.ladoAgente = b.dataset.lado; ctx.pintar(); }));
  await ({ memoria: ladoMemoria, habilidades: ladoHabilidades, rutinas: ladoRutinas, buscar: ladoBuscar })[lado]($('#lado', el), ctx, yo);

  const msgs = $('#msgs', el);
  const pintarMsg = (m) => {
    const div = document.createElement('div');
    div.className = `burbuja ${m.rol === 'yo' ? 'yo' : 'ia'}`;
    if (m.rol === 'yo') { div.textContent = m.texto; msgs.append(div); return; }
    const otro = m.agente && m.agente !== id ? lista.find((a) => a.id === m.agente) : null;
    div.innerHTML = `${otro ? `<div class="tenue" style="margin-bottom:4px">Respondido por ${esc(otro.nombre)}</div>` : ''}<div class="txt"></div>${htmlAcciones(m.acciones)}${HABILIDADES[m.habilidad] && m.pregunta ? `<div class="fila" style="margin-top:8px"><button type="button" class="btn fant peq" data-hab>${icono('rayo')}Guardar como habilidad</button></div>` : ''}`;
    div.querySelector('.txt').textContent = m.texto;
    msgs.append(div);
    if (m.acciones?.length) engancharAcciones(div, m.acciones, (acc) => m.id && db.guardar('chat', { ...m, acciones: acc }));
    div.querySelector('[data-hab]')?.addEventListener('click', () => editarHabilidad(ctx, yo, { frase: m.pregunta, pasos: [m.habilidad], nombre: HABILIDADES[m.habilidad].nombre }));
  };
  if (historial.length) historial.forEach(pintarMsg);
  else msgs.innerHTML = `<div class="vacio">${cara(yo, 52)}<div style="margin-top:10px"><b>Hola, soy ${esc(yo.nombre)}.</b><br>${esc(yo.foco)}<br>Escribe /ayuda para ver todo lo que sé hacer.</div></div>`;
  msgs.scrollTop = msgs.scrollHeight;

  const form = $('#f-chat', el); const ta = form.t;
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  $$('.sugerencias button', el).forEach((b) => b.addEventListener('click', () => { ta.value = b.textContent; form.requestSubmit(); }));
  $('#b-borrar', el).addEventListener('click', async () => {
    if (!(await confirmar(`¿Borrar la conversación con ${yo.nombre}? Su memoria se conserva.`))) return;
    for (const m of await db.todos('chat')) if ((m.agente || 'ventas') === id) await db.borrar('chat', m.id);
    ctx.pintar();
  });
  let ocupado = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = ta.value.trim();
    if (!texto || ocupado) return;
    ocupado = true; ta.value = '';
    msgs.querySelector('.vacio')?.remove();
    const mio = await db.guardar('chat', { rol: 'yo', agente: id, texto, fecha: new Date().toISOString() });
    pintarMsg(mio);
    const espera = document.createElement('div'); espera.className = 'burbuja ia pensando'; msgs.append(espera); msgs.scrollTop = msgs.scrollHeight;
    let r;
    try { r = await ejecutar(id, texto, ctx.datos); } catch (err) { r = { texto: 'No he podido hacerlo: ' + (err.message || err) }; }
    espera.remove();
    const m = await db.guardar('chat', { rol: 'ia', agente: r.agente || id, texto: r.texto, acciones: r.acciones || [], habilidad: r.habilidad || '', pregunta: r.fuente === 'ia' || r.delegado ? texto : '', fecha: new Date().toISOString() });
    pintarMsg(m);
    msgs.scrollTop = msgs.scrollHeight;
    ocupado = false;
    if (r.habilidad === 'recordar' && ctx.ladoAgente !== 'habilidades') ladoMemoria($('#lado', el), ctx, yo);
  });
}

async function ladoMemoria(el, ctx, yo) {
  const l = (await db.todos('memoria')).filter((m) => m.agente === yo.id || m.agente === 'todos').sort((a, b) => b.fecha.localeCompare(a.fecha));
  el.innerHTML = `<p class="tenue" style="margin:0">Lo que ${esc(yo.nombre)} sabe de tu negocio y de tus clientes. Lo usa al responder. Dile «recuerda que …» o escríbelo aquí.</p>
    <form class="fila" id="f-mem" style="flex-wrap:nowrap"><input class="entrada" name="t" placeholder="Ej.: Ana prefiere que la llamen por la tarde"><button class="btn peq">${icono('mas')}</button></form>
    <label class="opcion tenue"><input type="checkbox" id="mem-todos"> Que lo sepa todo el equipo</label>
    ${l.length ? `<ul class="lista sin-borde">${l.map((m) => `<li><div class="crece"><div style="white-space:normal">${esc(m.texto)}</div><div class="sub">${m.agente === 'todos' ? 'Todo el equipo' : esc(yo.nombre)} · ${fecha(m.fecha)}</div></div><button class="btn fant ico peq" data-x="${m.id}" aria-label="Olvidar">${icono('x')}</button></li>`).join('')}</ul>` : '<div class="vacio" style="padding:18px">Aún no hay recuerdos.</div>'}`;
  $('#f-mem', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = e.target.t.value.trim(); if (!t) return;
    await recordar($('#mem-todos', el).checked ? 'todos' : yo.id, t);
    ladoMemoria(el, ctx, yo);
  });
  $$('[data-x]', el).forEach((b) => b.addEventListener('click', async () => { await db.borrar('memoria', b.dataset.x); ladoMemoria(el, ctx, yo); }));
}

async function ladoHabilidades(el, ctx, yo) {
  const propias = (await db.todos('habilidades')).filter((h) => h.agente === yo.id || h.agente === 'todos');
  const fabrica = Object.entries(HABILIDADES).filter(([, h]) => h.agente === yo.id);
  el.innerHTML = `<p class="tenue" style="margin:0">Recetas con nombre: di su frase y ${esc(yo.nombre)} las hace de un tirón. Guárdalas desde una respuesta («Guardar como habilidad») o créalas aquí.</p>
    <div class="fila"><button class="btn peq" id="b-nueva">${icono('mas')}Nueva habilidad</button></div>
    ${propias.length ? `<ul class="lista sin-borde">${propias.map((h) => `<li class="clic" data-h="${h.id}"><div class="crece"><div class="tit">${esc(h.nombre)}</div><div class="sub">Di «${esc(h.frase)}» · ${h.usos || 0} usos</div></div></li>`).join('')}</ul>` : ''}
    <details><summary class="tenue" style="cursor:pointer">De fábrica (${fabrica.length})</summary><ul class="lista sin-borde">${fabrica.map(([k, h]) => `<li class="clic" data-f="${k}"><div class="crece"><div class="tit">${esc(h.nombre)}</div><div class="sub">/${k}</div></div></li>`).join('')}</ul></details>`;
  $('#b-nueva', el).addEventListener('click', () => editarHabilidad(ctx, yo));
  $$('[data-h]', el).forEach((li) => li.addEventListener('click', () => editarHabilidad(ctx, yo, propias.find((h) => h.id === li.dataset.h))));
  $$('[data-f]', el).forEach((li) => li.addEventListener('click', () => { const ta = document.querySelector('#f-chat textarea'); ta.value = '/' + li.dataset.f; ta.form.requestSubmit(); }));
}

function editarHabilidad(ctx, yo, h = {}) {
  const fabrica = Object.entries(HABILIDADES);
  modal({
    titulo: h.id ? 'Editar habilidad' : 'Nueva habilidad', ancho: true,
    cuerpo: `<div class="form">
      <label class="campo"><span>Nombre *</span><input name="nombre" required value="${esc(h.nombre || '')}" placeholder="Ej.: Repaso del lunes"></label>
      <label class="campo"><span>Frase que la activa *</span><input name="frase" required value="${esc(h.frase || '')}" placeholder="Ej.: repaso del lunes"></label>
      <div class="campo todo"><span>Qué hace (en orden)</span><div class="pasos">${fabrica.map(([k, x]) => `<label class="fila"><input type="checkbox" name="p_${k}" ${(h.pasos || []).includes(k) ? 'checked' : ''}> ${esc(x.nombre)}${x.agente !== yo.id ? ' <span class="tenue">(compañero)</span>' : ''}</label>`).join('')}</div></div>
      <label class="campo todo"><span>Nota final (opcional)</span><textarea name="nota" rows="2" placeholder="Ej.: Recuerda revisar también el correo de la web.">${esc(h.nota || '')}</textarea></label>
    </div>`,
    pie: `${h.id ? `<button type="button" class="btn peligro" data-borrar style="margin-right:auto">${icono('papelera')}Borrar</button>` : ''}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>`,
    alAbrir: (d) => d.querySelector('[data-borrar]')?.addEventListener('click', async () => { await db.borrar('habilidades', h.id); d.close(); ctx.pintar(); }),
    alGuardar: async (form) => {
      const v = datosForm(form);
      const pasos = fabrica.map(([k]) => k).filter((k) => form.elements['p_' + k].checked);
      if (!v.nombre || !v.frase) { aviso('Faltan el nombre y la frase'); return false; }
      if (!pasos.length && !v.nota) { aviso('Elige al menos un paso'); return false; }
      if (h.id) await db.guardar('habilidades', { ...h, nombre: v.nombre, frase: v.frase.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), pasos, nota: v.nota });
      else await guardarHabilidad({ agente: yo.id, nombre: v.nombre, frase: v.frase, pasos, nota: v.nota });
      aviso('Habilidad guardada'); ctx.ladoAgente = 'habilidades'; ctx.pintar();
    },
  });
}

async function ladoRutinas(el, ctx, yo) {
  await revisarRutinas(ctx.recargar); // crea las de fábrica la primera vez
  const l = (await db.todos('rutinas')).filter((r) => r.agente === yo.id);
  const cuando = (r) => `${FRECUENCIAS[r.frecuencia]}${r.frecuencia === 'semanal' ? ` (${DIAS[r.dia ?? 1]})` : ''} a las ${r.hora}`;
  const permiso = 'Notification' in self ? Notification.permission : 'denied';
  el.innerHTML = `<p class="tenue" style="margin:0">Trabajos que ${esc(yo.nombre)} hace solo y te deja en la Bandeja. Se ejecutan cuando tienes el CRM abierto (o al abrirlo, si se pasó la hora).</p>
    <div class="fila"><button class="btn peq" id="b-rut">${icono('mas')}Nueva rutina</button>${permiso === 'default' ? `<button class="btn fant peq" id="b-notif">Avisarme con notificaciones</button>` : ''}</div>
    ${l.length ? `<ul class="lista sin-borde">${l.map((r) => `<li><input type="checkbox" data-act="${r.id}" ${r.activa ? 'checked' : ''} aria-label="Activa" style="width:18px;height:18px;accent-color:var(--marca)"><div class="crece clic" data-r="${r.id}"><div class="tit">${esc(r.nombre)}</div><div class="sub">${cuando(r)}${r.ultima ? ` · última ${fechaHora(r.ultima)}` : ''}</div></div><button class="btn fant peq" data-ya="${r.id}">Ahora</button></li>`).join('')}</ul>` : '<div class="vacio" style="padding:18px">Sin rutinas.</div>'}`;
  $('#b-rut', el).addEventListener('click', () => editarRutina(ctx, yo));
  $('#b-notif', el)?.addEventListener('click', async () => { await Notification.requestPermission(); ladoRutinas(el, ctx, yo); });
  $$('[data-r]', el).forEach((x) => x.addEventListener('click', () => editarRutina(ctx, yo, l.find((r) => r.id === x.dataset.r))));
  $$('[data-act]', el).forEach((x) => x.addEventListener('change', async () => { const r = l.find((y) => y.id === x.dataset.act); await db.guardar('rutinas', { ...r, activa: x.checked, ultima: x.checked ? new Date().toISOString() : r.ultima }); }));
  $$('[data-ya]', el).forEach((x) => x.addEventListener('click', async () => {
    const r = l.find((y) => y.id === x.dataset.ya);
    const res = await ejecutar(r.agente, r.instruccion, ctx.datos);
    await db.guardar('bandeja', { agente: r.agente, titulo: r.nombre, texto: res.texto, acciones: res.acciones, fecha: new Date().toISOString(), leida: false, origen: 'rutina' });
    await db.guardar('rutinas', { ...r, ultima: new Date().toISOString() });
    aviso('Hecho: lo tienes en la Bandeja'); ctx.pestanaIA = 'bandeja'; ctx.pintar();
  }));
}

function editarRutina(ctx, yo, r = { frecuencia: 'diaria', hora: '09:00', dia: 1, activa: true }) {
  const opciones = Object.entries(HABILIDADES).filter(([, h]) => h.agente === yo.id);
  const esFabrica = /^\/\w+$/.test(r.instruccion || '');
  modal({
    titulo: r.id ? 'Editar rutina' : `Nueva rutina de ${yo.nombre}`,
    cuerpo: `<div class="form">
      <label class="campo todo"><span>Nombre *</span><input name="nombre" required value="${esc(r.nombre || '')}" placeholder="Ej.: Repaso de presupuestos"></label>
      <label class="campo todo"><span>Qué debe hacer *</span><select name="sel"><option value="/parte" ${r.instruccion === '/parte' ? 'selected' : ''}>Su parte completo</option>${opciones.map(([k, h]) => `<option value="/${k}" ${r.instruccion === '/' + k ? 'selected' : ''}>${esc(h.nombre)}</option>`).join('')}<option value="libre" ${r.instruccion && !esFabrica ? 'selected' : ''}>Otra cosa (escrita)…</option></select></label>
      <label class="campo todo"><span>Si es otra cosa, escríbela como se la dirías</span><input name="libre" value="${esc(r.instruccion && !esFabrica ? r.instruccion : '')}" placeholder="Ej.: prepara una campaña para clientes leales"></label>
      <label class="campo"><span>Frecuencia</span><select name="frecuencia">${Object.entries(FRECUENCIAS).map(([k, t]) => `<option value="${k}" ${k === r.frecuencia ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo"><span>Día (si es semanal)</span><select name="dia">${DIAS.map((t, i) => `<option value="${i}" ${i === Number(r.dia ?? 1) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo"><span>Hora</span><input name="hora" type="time" value="${esc(r.hora || '09:00')}"></label>
    </div>`,
    pie: `${r.id ? `<button type="button" class="btn peligro" data-borrar style="margin-right:auto">${icono('papelera')}Borrar</button>` : ''}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>`,
    alAbrir: (d) => d.querySelector('[data-borrar]')?.addEventListener('click', async () => { await db.borrar('rutinas', r.id); d.close(); ctx.pintar(); }),
    alGuardar: async (form) => {
      const v = datosForm(form);
      const instruccion = v.sel === 'libre' ? v.libre.trim() : v.sel;
      if (!v.nombre || !instruccion) { aviso('Faltan el nombre o qué debe hacer'); return false; }
      const nueva = { ...r, agente: yo.id, nombre: v.nombre, instruccion, frecuencia: v.frecuencia, dia: Number(v.dia), hora: v.hora || '09:00' };
      // Al crearla o cambiar su horario, que no salte por una hora ya pasada
      nueva.ultima = new Date(Math.max(Date.now(), ultimaProgramada(nueva).getTime())).toISOString();
      await db.guardar('rutinas', nueva);
      aviso('Rutina guardada'); ctx.ladoAgente = 'rutinas'; ctx.pintar();
    },
  });
}

async function ladoBuscar(el, ctx, yo) {
  el.innerHTML = `<p class="tenue" style="margin:0">Busca en todas las conversaciones con tus agentes y en la Bandeja.</p>
    <input class="entrada" id="q" type="search" placeholder="Ej.: Ana, campaña, presupuesto…" value="${esc(ctx.buscaAg || '')}"><div id="res"></div>`;
  const q = $('#q', el); const res = $('#res', el);
  const buscar = async () => {
    ctx.buscaAg = q.value;
    const l = await buscarConversaciones(q.value);
    const nombres = Object.fromEntries((await equipo()).map((a) => [a.id, a.nombre]));
    res.innerHTML = q.value.trim().length < 2 ? '' : l.length ? `<ul class="lista sin-borde">${l.map((m) => `<li><div class="crece"><div class="sub">${m.bandeja ? 'Bandeja' : m.rol === 'yo' ? 'Tú' : esc(nombres[m.agente || 'ventas'])} · ${fechaHora(m.fecha)}</div><div style="white-space:pre-wrap;font-size:13px">${esc(m.texto.slice(0, 220))}${m.texto.length > 220 ? '…' : ''}</div></div></li>`).join('')}</ul>` : '<div class="vacio" style="padding:18px">Nada encontrado.</div>';
  };
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 200); });
  if (q.value) buscar();
  q.focus();
}

/* ───────────── Bandeja ───────────── */
export async function panelBandeja(el, ctx) {
  const l = (await db.todos('bandeja')).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const nombres = Object.fromEntries((await equipo()).map((a) => [a.id, a]));
  el.innerHTML = `<div class="fila entre" style="margin-bottom:12px"><span class="tenue">Lo que tus agentes hacen solos (rutinas) y las órdenes de la Jefa de personal.</span>
      <span class="fila"><button class="btn peq" id="b-rev">${icono('reloj')}Revisar rutinas ahora</button>${l.some((x) => !x.leida) ? '<button class="btn fant peq" id="b-leido">Marcar todo leído</button>' : ''}${l.length ? `<button class="btn fant peq" id="b-vaciar">${icono('papelera')}Vaciar</button>` : ''}</span></div>
    ${l.length ? l.map((x) => { const a = nombres[x.agente] || nombres.ventas; return `<div class="tarjeta pila aviso-ag ${x.leida ? '' : 'nuevo'}" data-b="${x.id}">
      <div class="fila">${cara(a, 32)}<div class="crece"><b>${esc(x.titulo)}</b><div class="tenue">${esc(a.nombre)} · ${x.origen === 'jefa' ? 'orden de la Jefa' : x.origen === 'whatsapp' ? 'WhatsApp' : 'rutina'} · ${fechaHora(x.fecha)}</div></div>${x.leida ? '' : '<span class="etiqueta azul">Nuevo</span>'}<button class="btn fant ico peq" data-x aria-label="Borrar">${icono('x')}</button></div>
      <div class="txt" style="white-space:pre-wrap;overflow-wrap:anywhere"></div>${htmlAcciones(x.acciones)}</div>`; }).join('')
    : `<div class="tarjeta vacio">${icono('reloj')}<div>Aún no hay avisos. Tus agentes dejarán aquí sus partes diarios.</div></div>`}`;
  for (const x of l) {
    const caja = el.querySelector(`[data-b="${x.id}"]`);
    caja.querySelector('.txt').textContent = x.texto;
    if (x.acciones?.length) engancharAcciones(caja, x.acciones, (acc) => db.guardar('bandeja', { ...x, acciones: acc }));
    caja.querySelector('[data-x]').addEventListener('click', async () => { await db.borrar('bandeja', x.id); caja.remove(); ctx.contarBandeja?.(); });
  }
  $('#b-rev', el).addEventListener('click', async () => { const n = await revisarRutinas(ctx.recargar); aviso(n ? `${n} rutinas hechas` : 'No hay rutinas pendientes ahora'); if (n) ctx.pintar(); });
  $('#b-leido', el)?.addEventListener('click', async () => { await db.guardarVarios('bandeja', l.map((x) => ({ ...x, leida: true }))); ctx.pintar(); });
  $('#b-vaciar', el)?.addEventListener('click', async () => { if (await confirmar('¿Borrar todos los avisos de la Bandeja?')) { await db.vaciar('bandeja'); ctx.pintar(); } });
  // Al verla, queda leída (sin repintar ahora, para que se vea qué era nuevo)
  const sinLeer = l.filter((x) => !x.leida);
  if (sinLeer.length) setTimeout(async () => { await db.guardarVarios('bandeja', sinLeer.map((x) => ({ ...x, leida: true }))); ctx.contarBandeja?.(); }, 1500);
}

/* ───────────── Jefa de personal (BUSINESS HUGLE) ───────────── */
export async function panelJefa(el, ctx) {
  const lista = await equipo();
  const c = cuenta();
  if (!tieneApp('business')) {
    el.innerHTML = `<div class="rejilla r-2"><div class="tarjeta pila jefa-bloq">
        <div class="fila">${icono('escudo')}<h2 style="margin:0">Jefa de personal</h2><span class="etiqueta violeta">BUSINESS HUGLE</span></div>
        <p style="margin:0">Con <b>BUSINESS HUGLE</b>, la Jefa de personal dirige a ${lista.map((a) => esc(a.nombre)).join(', ')}: les reparte encargos desde tu Control Center (o desde aquí), ellos los hacen con los datos de este dispositivo y te devuelven un informe.</p>
        <ul class="tenue" style="margin:0;padding-left:18px"><li>«Recupera a los clientes en riesgo y revisa el embudo» → Iris y Marco se ponen a ello.</li><li>Informes sin teléfonos ni correos; los nombres, abreviados.</li><li>Las tareas que propongan esperan tu aprobación (o se crean solas, si lo eliges).</li></ul>
        <div class="fila"><a class="btn grad" href="${urlPanel('&ver=business')}">${icono('rayo')}Ver BUSINESS HUGLE en tu Control Center</a></div>
        ${c ? `<p class="tenue" style="margin:0">Tu cuenta (${esc(c.email)}) tiene: ${c.apps.map((a) => a.toUpperCase() + ' HUGLE').join(', ')}.</p>` : ''}
      </div>
      <div class="tarjeta pila"><h2>Tu equipo</h2>${lista.map((a) => `<div class="fila">${cara(a, 36)}<div><b>${esc(a.nombre)}</b> · ${esc(a.rol)}<div class="tenue">${esc(a.foco)}</div></div></div>`).join('')}</div></div>`;
    return;
  }
  const [hist, auto, nombres] = await Promise.all([db.todos('ordenes'), db.ajuste('jefaAutoTareas', false), db.ajuste('jefaNombres', false)]);
  hist.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const nom = Object.fromEntries(lista.map((a) => [a.id, a]));
  el.innerHTML = `<div class="rejilla r-2"><div class="pila">
      <div class="tarjeta pila"><div class="fila">${icono('escudo')}<h2 style="margin:0">Encargo para tu equipo</h2><span class="etiqueta verde">BUSINESS activo</span></div>
        <p class="tenue" style="margin:0">La Jefa de personal lo reparte entre ${lista.map((a) => esc(a.nombre)).join(', ')}. También puedes mandárselo desde tu Control Center, desde cualquier dispositivo.</p>
        <form id="f-jefa" class="pila"><textarea class="entrada" name="o" rows="3" placeholder="Ej.: Esta semana quiero recuperar clientes en riesgo y cerrar los presupuestos pendientes"></textarea>
        <div class="fila"><button class="btn grad">${icono('enviar')}Encargar</button><button type="button" class="btn" id="b-sync">${icono('reloj')}Recoger órdenes ahora</button></div></form>
        <div id="reparto"></div></div>
      <div class="tarjeta pila"><h2>Cómo trabajan las órdenes</h2>
        <label class="opcion"><input type="checkbox" id="j-auto" ${auto ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--marca)"> Crear solas las tareas que propongan (si no, esperan tu aprobación en la Bandeja)</label>
        <label class="opcion"><input type="checkbox" id="j-nom" ${nombres ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--marca)"> Poner los nombres completos de los clientes en los informes (por defecto, abreviados)</label>
        <p class="tenue" style="margin:0">Los informes nunca llevan teléfonos ni correos. Las órdenes se recogen cada minuto mientras el CRM está abierto.</p></div>
    </div>
    <div class="tarjeta pila"><h2>Órdenes recibidas</h2>${hist.length ? hist.slice(0, 30).map((o) => `<div class="orden"><div class="fila">${cara(nom[o.agente] || nom.ventas, 28)}<b class="crece">${esc(o.instruccion)}</b><span class="etiqueta ${o.estado === 'hecha' ? 'verde' : 'rojo'}">${o.estado}</span></div><div class="tenue">${esc(nom[o.agente]?.nombre || o.agente)} · ${fechaHora(o.fecha)}</div><details><summary class="tenue" style="cursor:pointer">Informe</summary><div class="resultado" style="margin-top:6px">${esc(o.informe)}</div></details></div>`).join('') : '<div class="vacio">Aún no hay órdenes.</div>'}</div></div>`;
  $('#j-auto', el).addEventListener('change', (e) => db.fijar('jefaAutoTareas', e.target.checked));
  $('#j-nom', el).addEventListener('change', (e) => db.fijar('jefaNombres', e.target.checked));
  const sync = async () => { const n = await recogerOrdenes(ctx.recargar); aviso(n ? `${n} órdenes hechas` : 'No hay órdenes pendientes'); if (n) ctx.pintar(); };
  $('#b-sync', el).addEventListener('click', sync);
  $('#f-jefa', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const o = e.target.o.value.trim(); if (!o) return;
    try {
      const r = await encargarAJefa(o);
      $('#reparto', el).innerHTML = `<div class="aviso info">La Jefa lo ha repartido a: <b>${r.reparto.map((a) => esc(nom[a]?.nombre || a)).join(', ')}</b>. Se ponen a ello…</div>`;
      e.target.o.value = '';
      await sync();
    } catch (err) { $('#reparto', el).innerHTML = `<div class="aviso">${esc(err.message)}</div>`; }
  });
}

export { agente };
