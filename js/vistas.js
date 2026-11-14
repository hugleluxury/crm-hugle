// Pantallas del CRM: inicio, contactos, ficha, embudo, agenda, resultados y plantillas.
import * as db from './db.js';
import {
  $, $$, esc, dinero, numero, fecha, fechaHora, hace, dias, hoyISO, avatar, icono, aviso, modal, confirmar, datosForm,
  descargar, elegirArchivo, leerCSV, aCSV, normTel, rellenar, enlaceWhatsApp,
} from './util.js';
import {
  ORIGENES, TIPOS_TAREA, TIPOS_ACTIVIDAD, SEGMENTOS, pendientesDeHoy, resultados as calcResultados, buscarDuplicado, registrar,
  moverTrato, cargarEjemplo,
} from './negocio.js';

const etiquetaSeg = (s) => `<span class="etiqueta ${SEGMENTOS[s]?.clase || ''}" title="${esc(SEGMENTOS[s]?.ayuda || '')}">${esc(SEGMENTOS[s]?.nombre || s)}</span>`;
const opciones = (lista, sel) => lista.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
const vacio = (ic, texto, extra = '') => `<div class="vacio">${icono(ic)}<div>${texto}</div>${extra}</div>`;

/* ───────────── INICIO ───────────── */
export async function inicio(el, ctx) {
  const d = ctx.datos;
  const p = pendientesDeHoy(d);
  const r = calcResultados(d, 30);
  const negocio = await db.ajuste('negocio');
  const primera = !d.contactos.length;
  const delta = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
  const kpi = (eti, ic, valor, a, b) => {
    const dl = delta(a, b);
    return `<div class="tarjeta kpi"><div class="eti">${icono(ic)}${eti}</div><div class="num">${valor}</div>
      <div class="tenue">${a === b ? 'igual que' : `<span class="delta ${dl >= 0 ? 'sube' : 'baja'}">${dl >= 0 ? '▲' : '▼'} ${Math.abs(dl)} %</span> frente a`} los 30 días anteriores</div></div>`;
  };
  el.innerHTML = `
  ${primera ? `<div class="tarjeta bienvenida pila" style="margin-bottom:14px">
      <h2>Bienvenido a tu CRM${negocio ? `, ${esc(negocio)}` : ''}</h2>
      <p style="margin:0;opacity:.92">Todo se guarda en este dispositivo: nadie más ve tus clientes. Empieza creando un contacto, importa tu lista en CSV o carga datos de ejemplo para probar.</p>
      <div class="fila"><button class="btn prim" data-a="nuevo">${icono('mas')}Crear contacto</button><button class="btn" data-a="importar">${icono('subir')}Importar CSV</button><button class="btn" data-a="ejemplo">Cargar ejemplo</button><button class="btn" data-a="ajustes">${icono('ajustes')}Configurar negocio</button></div>
    </div>` : ''}
  <div class="rejilla r-4">
    ${kpi('Contactos nuevos', 'contactos', numero(r.actual.nuevos), r.actual.nuevos, r.anterior.nuevos)}
    ${kpi('Ventas cerradas', 'euro', dinero(r.actual.valorGanado + r.actual.ventas), r.actual.valorGanado + r.actual.ventas, r.anterior.valorGanado + r.anterior.ventas)}
    <div class="tarjeta kpi"><div class="eti">${icono('embudo')}En el embudo</div><div class="num">${dinero(r.pipeline)}</div><div class="tenue">${d.tratos.filter((t) => d.etapas.find((e) => e.id === t.etapa)?.tipo === 'abierta').length} oportunidades abiertas</div></div>
    <div class="tarjeta kpi"><div class="eti">${icono('check')}Tasa de cierre</div><div class="num">${r.actual.tasa === null ? '—' : r.actual.tasa + ' %'}</div><div class="tenue">${r.actual.ganados} ganadas · ${r.actual.perdidos} perdidas (30 días)</div></div>
  </div>
  <div class="rejilla r-21" style="margin-top:14px">
    <div class="tarjeta plana">
      <div class="fila entre" style="padding:16px 16px 6px"><h2>${icono('rayo')} Para hoy</h2><span class="tenue">${p.total ? `${p.total} pendientes` : 'Todo al día'}</span></div>
      ${p.total || p.riesgo.length ? `<ul class="lista">
        ${p.tareas.map((t) => {
          const c = d.porId.get(t.contacto);
          const vencida = t.vence < hoyISO();
          return `<li><input type="checkbox" data-hecha="${t.id}" aria-label="Marcar hecha" style="width:18px;height:18px;accent-color:var(--marca)">
            <div class="crece"><div class="tit">${esc(t.titulo)}</div><div class="sub">${esc(TIPOS_TAREA[t.tipo] || 'Tarea')}${c ? ` · ${esc(c.nombre)}` : ''}</div></div>
            <span class="etiqueta ${vencida ? 'rojo' : 'ambar'}">${vencida ? `Vencida ${fecha(t.vence)}` : 'Hoy'}${t.hora ? ` ${esc(t.hora)}` : ''}</span></li>`;
        }).join('')}
        ${p.tratosVencidos.map((t) => `<li class="clic" data-trato="${t.id}"><span class="avatar" style="background:var(--ambar)">${icono('reloj')}</span>
            <div class="crece"><div class="tit">${esc(t.titulo)}</div><div class="sub">Fecha de cierre pasada (${fecha(t.cierre)}) · ${dinero(t.valor)}</div></div><span class="etiqueta ambar">Revisar</span></li>`).join('')}
        ${p.silencio.slice(0, 8).map((c) => `<li class="clic" data-contacto="${c.id}">${avatar(c.nombre)}
            <div class="crece"><div class="tit">${esc(c.nombre)}</div><div class="sub">Sin noticias ${hace(c._ultimaActividad)} · ${c._puntuacion} pts</div></div><span class="etiqueta azul">Retomar</span></li>`).join('')}
        ${p.riesgo.slice(0, 5).map((c) => `<li class="clic" data-contacto="${c.id}">${avatar(c.nombre)}
            <div class="crece"><div class="tit">${esc(c.nombre)}</div><div class="sub">Cliente en riesgo · última compra ${hace(c._ultimaCompra)} · ${dinero(c._gastado)}</div></div>${etiquetaSeg('riesgo')}</li>`).join('')}
      </ul>` : vacio('check', 'No tienes nada pendiente. Buen trabajo.')}
    </div>
    <div class="pila">
      <div class="tarjeta"><h2>Embudo</h2>${r.embudo.map((e) => barra(e.nombre, e.n, Math.max(1, ...r.embudo.map((x) => x.n)), dinero(e.valor), e.color)).join('')}</div>
      <div class="tarjeta"><h2>Clientes por segmento</h2><div class="fila" style="margin-top:12px">${Object.entries(r.segmentos).map(([s, n]) => `${etiquetaSeg(s)}<b style="margin-right:8px">${n}</b>`).join('') || '<span class="tenue">Sin contactos todavía.</span>'}</div></div>
    </div>
  </div>`;
  el.querySelector('[data-a=nuevo]')?.addEventListener('click', () => editarContacto(ctx));
  el.querySelector('[data-a=importar]')?.addEventListener('click', () => importarCSV(ctx));
  el.querySelector('[data-a=ajustes]')?.addEventListener('click', () => ctx.ir('ajustes'));
  el.querySelector('[data-a=ejemplo]')?.addEventListener('click', async () => { await cargarEjemplo(); aviso('Datos de ejemplo cargados. Puedes borrarlos en Ajustes.'); });
  enlazarLista(el, ctx);
}

function barra(nombre, n, max, derecha, color) {
  return `<div class="barra-h"><span>${esc(nombre)}</span><span class="pista"><i style="width:${Math.round((n / max) * 100)}%;${color ? `background:${color}` : ''}"></i></span><b>${n}</b></div>
  <div class="tenue" style="margin:-4px 0 4px 130px">${derecha}</div>`;
}

function enlazarLista(el, ctx) {
  $$('[data-contacto]', el).forEach((x) => x.addEventListener('click', () => ctx.ir('contacto', x.dataset.contacto)));
  $$('[data-trato]', el).forEach((x) => x.addEventListener('click', (e) => { e.stopPropagation(); editarTrato(ctx, ctx.datos.tratos.find((t) => t.id === x.dataset.trato)); }));
  $$('[data-hecha]', el).forEach((x) => x.addEventListener('change', () => marcarTarea(ctx, x.dataset.hecha, x.checked)));
}

async function marcarTarea(ctx, id, hecha) {
  const t = await db.uno('tareas', id);
  if (!t) return;
  t.hecha = hecha; t.hechaEn = hecha ? new Date().toISOString() : null;
  await db.guardar('tareas', t);
  if (hecha && t.contacto) await registrar(t.contacto, 'sistema', `Hecho: ${t.titulo}`);
  aviso(hecha ? 'Tarea completada' : 'Tarea reabierta');
}

/* ───────────── CONTACTOS ───────────── */
export async function contactos(el, ctx) {
  const d = ctx.datos;
  const f = ctx.filtroContactos || 'todos';
  const q = (ctx.busqueda || '').toLowerCase().trim();
  let lista = d.contactos.filter((c) => !c.archivado || f === 'archivados');
  if (f === 'archivados') lista = d.contactos.filter((c) => c.archivado);
  else if (f !== 'todos') lista = lista.filter((c) => c._segmento === f);
  if (q) lista = lista.filter((c) => [c.nombre, c.empresa, c.email, c.telefono, c.ciudad, c.origen, ...(c.etiquetas || [])].join(' ').toLowerCase().includes(q));
  const orden = ctx.ordenContactos || 'puntuacion';
  const ordenes = { puntuacion: (a, b) => b._puntuacion - a._puntuacion, nombre: (a, b) => a.nombre.localeCompare(b.nombre), reciente: (a, b) => String(b._ultimaActividad).localeCompare(String(a._ultimaActividad)), gasto: (a, b) => b._gastado - a._gastado };
  lista.sort(ordenes[orden]);
  const cuenta = (s) => d.contactos.filter((c) => !c.archivado && c._segmento === s).length;

  el.innerHTML = `
  <div class="fila entre" style="margin-bottom:12px">
    <div class="filtros" role="tablist">
      <button data-f="todos">Todos <span class="tenue">${d.contactos.filter((c) => !c.archivado).length}</span></button>
      ${Object.keys(SEGMENTOS).map((s) => (cuenta(s) ? `<button data-f="${s}">${SEGMENTOS[s].nombre} <span class="tenue">${cuenta(s)}</span></button>` : '')).join('')}
      ${d.contactos.some((c) => c.archivado) ? '<button data-f="archivados">Archivados</button>' : ''}
    </div>
    <div class="fila">
      <input class="entrada solo-movil" id="q-movil" type="search" placeholder="Buscar…" value="${esc(ctx.busqueda || '')}" style="width:150px">
      <select class="entrada" id="orden" style="width:auto">${opciones([['puntuacion', 'Mejor puntuación'], ['reciente', 'Actividad reciente'], ['gasto', 'Más gasto'], ['nombre', 'Nombre']], orden)}</select>
      <button class="btn" id="b-imp">${icono('subir')}<span>Importar</span></button>
      <button class="btn" id="b-exp">${icono('bajar')}<span>Exportar</span></button>
    </div>
  </div>
  <div class="tarjeta plana">
    ${lista.length ? `<div class="desliza"><table class="tabla">
      <thead><tr><th>Nombre</th><th>Segmento</th><th class="om">Puntos</th><th class="om">Compras</th><th class="om">Origen</th><th class="om">Última actividad</th></tr></thead>
      <tbody>${lista.map((c) => `<tr class="clic" data-contacto="${c.id}">
        <td><div class="fila" style="flex-wrap:nowrap">${avatar(c.nombre)}<div style="min-width:0"><b>${esc(c.nombre)}</b><div class="tenue">${esc([c.empresa, c.ciudad].filter(Boolean).join(' · ') || c.telefono || c.email || '')}</div></div></div></td>
        <td>${etiquetaSeg(c._segmento)} ${(c.etiquetas || []).map((t) => `<span class="etiqueta">${esc(t)}</span>`).join(' ')}</td>
        <td class="om"><b>${c._puntuacion}</b></td>
        <td class="om nw">${c._compras ? `${c._compras} · ${dinero(c._gastado)}` : '—'}</td>
        <td class="om">${esc(c.origen || '—')}</td>
        <td class="om tenue nw">${hace(c._ultimaActividad)}</td></tr>`).join('')}</tbody></table></div>`
    : vacio('contactos', q ? 'Ningún contacto coincide con la búsqueda.' : 'Todavía no hay contactos.', `<div class="fila" style="justify-content:center;margin-top:12px"><button class="btn prim" id="b-nuevo">${icono('mas')}Crear contacto</button></div>`)}
  </div>`;
  $$('[data-f]', el).forEach((b) => { b.classList.toggle('activo', b.dataset.f === f); b.addEventListener('click', () => { ctx.filtroContactos = b.dataset.f; ctx.pintar(); }); });
  $('#orden', el).addEventListener('change', (e) => { ctx.ordenContactos = e.target.value; ctx.pintar(); });
  $('#b-imp', el).addEventListener('click', () => importarCSV(ctx));
  $('#b-exp', el).addEventListener('click', () => exportarCSV(ctx));
  $('#b-nuevo', el)?.addEventListener('click', () => editarContacto(ctx));
  const qm = $('#q-movil', el);
  qm?.addEventListener('change', () => { ctx.busqueda = qm.value; ctx.pintar(); });
  enlazarLista(el, ctx);
}

export function editarContacto(ctx, c = null) {
  const nuevo = !c;
  c = c || { nombre: '', etiquetas: [] };
  modal({
    titulo: nuevo ? 'Nuevo contacto' : 'Editar contacto',
    cuerpo: `<div class="form">
      <label class="campo todo"><span>Nombre *</span><input name="nombre" required value="${esc(c.nombre)}" autocomplete="off"></label>
      <label class="campo"><span>Teléfono (con prefijo, p. ej. +34)</span><input name="telefono" type="tel" value="${esc(c.telefono || '')}"></label>
      <label class="campo"><span>Email</span><input name="email" type="email" value="${esc(c.email || '')}"></label>
      <label class="campo"><span>Empresa</span><input name="empresa" value="${esc(c.empresa || '')}"></label>
      <label class="campo"><span>Ciudad</span><input name="ciudad" value="${esc(c.ciudad || '')}"></label>
      <label class="campo"><span>Origen</span><select name="origen"><option value="">—</option>${opciones(ORIGENES, c.origen)}</select></label>
      <label class="campo"><span>Etiquetas (separadas por comas)</span><input name="etiquetas" value="${esc((c.etiquetas || []).join(', '))}"></label>
      <label class="campo todo"><span>Notas</span><textarea name="notas">${esc(c.notas || '')}</textarea></label>
    </div>`,
    pie: `${nuevo ? '' : `<button type="button" class="btn peligro" data-borrar style="margin-right:auto">${icono('papelera')}Borrar</button>`}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>`,
    alAbrir: (dlg) => dlg.querySelector('[data-borrar]')?.addEventListener('click', async () => {
      if (!(await confirmar(`¿Borrar a ${c.nombre} con todas sus notas, tareas, oportunidades y compras? No se puede deshacer.`))) return;
      await db.borrarContacto(c.id); dlg.close(); aviso('Contacto borrado'); ctx.ir('contactos');
    }),
    alGuardar: async (form) => {
      const v = datosForm(form);
      const dup = nuevo && buscarDuplicado(ctx.datos.contactos, v);
      if (dup && !(await confirmar(`Ya existe «${dup.nombre}» con ese teléfono o email. ¿Crear otro igualmente?`, 'Crear'))) return false;
      const obj = { ...stripCalc(c), ...v, etiquetas: v.etiquetas.split(',').map((x) => x.trim()).filter(Boolean) };
      const g = await db.guardar('contactos', obj);
      if (nuevo) await registrar(g.id, 'sistema', 'Contacto creado.');
      aviso(nuevo ? 'Contacto creado' : 'Cambios guardados');
      if (nuevo) ctx.ir('contacto', g.id);
    },
  });
}

const stripCalc = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

/* ───────────── FICHA DE CONTACTO ───────────── */
export async function ficha(el, ctx) {
  const d = ctx.datos;
  const c = d.porId.get(ctx.param);
  if (!c) { el.innerHTML = vacio('contactos', 'Este contacto ya no existe.'); return; }
  const acts = d.actividades.filter((a) => a.contacto === c.id);
  const historial = [
    ...acts.map((a) => ({ f: a.fecha, clase: a.tipo === 'nota' ? 'nota' : '', t: TIPOS_ACTIVIDAD[a.tipo] || a.tipo, txt: a.texto, id: a.id })),
    ...c._ventas.map((v) => ({ f: v.fecha, clase: 'venta', t: `Compra · ${dinero(v.importe)}`, txt: v.concepto, venta: v.id })),
  ].sort((a, b) => String(b.f).localeCompare(String(a.f)));
  const tareas = d.tareas.filter((t) => t.contacto === c.id).sort((a, b) => Number(a.hecha) - Number(b.hecha) || String(a.vence).localeCompare(String(b.vence)));
  const etapa = (id) => d.etapas.find((e) => e.id === id);
  $('#titulo').textContent = c.nombre;

  el.innerHTML = `
  <button class="btn fant peq" id="volver" style="margin-bottom:10px">${icono('atras')}Contactos</button>
  <div class="ficha">
    <div class="pila">
      <div class="tarjeta pila">
        <div class="fila" style="flex-wrap:nowrap">${avatar(c.nombre, 'g')}<div class="crece"><h2>${esc(c.nombre)}</h2><div class="tenue">${esc([c.empresa, c.ciudad].filter(Boolean).join(' · '))}</div></div>
          <button class="btn fant ico" id="editar" aria-label="Editar">${icono('editar')}</button></div>
        <div class="fila">${etiquetaSeg(c._segmento)}<span class="etiqueta azul">${c._puntuacion} puntos</span>${(c.etiquetas || []).map((t) => `<span class="etiqueta">${esc(t)}</span>`).join('')}${c.archivado ? '<span class="etiqueta rojo">Archivado</span>' : ''}</div>
        <div class="fila">
          ${c.telefono ? `<a class="btn peq" href="tel:${esc(normTel(c.telefono))}">${icono('tel')}Llamar</a><button class="btn peq" id="wa">${icono('whatsapp')}WhatsApp</button>` : ''}
          ${c.email ? `<a class="btn peq" href="mailto:${esc(c.email)}">${icono('mail')}Email</a>` : ''}
          <button class="btn peq grad" id="ia-resumen">${icono('ia')}Resumen IA</button>
        </div>
        <div class="resultado oculto" id="ia-salida"></div>
        <dl class="datos">
          <dt>Teléfono</dt><dd>${esc(c.telefono || '—')}</dd>
          <dt>Email</dt><dd>${esc(c.email || '—')}</dd>
          <dt>Origen</dt><dd>${esc(c.origen || '—')}</dd>
          <dt>Compras</dt><dd>${c._compras} · ${dinero(c._gastado)}</dd>
          <dt>Última</dt><dd>${hace(c._ultimaActividad)}</dd>
          <dt>Alta</dt><dd>${fecha(c.creado, { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
        </dl>
        ${c.notas ? `<div class="resultado">${esc(c.notas)}</div>` : ''}
      </div>
      <div class="tarjeta">
        <div class="fila entre"><h2>Oportunidades</h2><button class="btn peq" id="n-trato">${icono('mas')}Añadir</button></div>
        ${c._tratos.length ? `<ul class="lista" style="margin:8px -18px -18px">${c._tratos.map((t) => `<li class="clic" data-trato="${t.id}"><i class="color-etapa" style="background:${etapa(t.etapa)?.color || '#888'}"></i><div class="crece"><div class="tit">${esc(t.titulo)}</div><div class="sub">${esc(etapa(t.etapa)?.nombre || '')}${t.cierre ? ` · cierre ${fecha(t.cierre)}` : ''}</div></div><b>${dinero(t.valor)}</b></li>`).join('')}</ul>` : '<p class="tenue">Sin oportunidades.</p>'}
      </div>
      <div class="tarjeta">
        <div class="fila entre"><h2>Tareas</h2><button class="btn peq" id="n-tarea">${icono('mas')}Añadir</button></div>
        ${tareas.length ? `<div class="pila" style="margin-top:10px">${tareas.map((t) => `<label class="tarea-fila ${t.hecha ? 'hecha' : ''}"><input type="checkbox" data-hecha="${t.id}" ${t.hecha ? 'checked' : ''}><div class="crece"><div class="tit">${esc(t.titulo)}</div><div class="tenue">${esc(TIPOS_TAREA[t.tipo] || '')} · ${t.vence ? fecha(t.vence) : 'sin fecha'}${t.hora ? ' ' + esc(t.hora) : ''}</div></div></label>`).join('')}</div>` : '<p class="tenue">Sin tareas.</p>'}
      </div>
      <div class="fila"><button class="btn peq" id="archivar">${c.archivado ? 'Recuperar' : 'Archivar'}</button></div>
    </div>
    <div class="pila">
      <div class="tarjeta">
        <form id="f-nota" class="pila">
          <div class="filtros" id="tipo-act">${['nota', 'llamada', 'mensaje', 'email', 'reunion'].map((t, i) => `<button type="button" data-t="${t}" class="${i === 0 ? 'activo' : ''}">${TIPOS_ACTIVIDAD[t]}</button>`).join('')}</div>
          <textarea class="entrada" name="texto" rows="3" placeholder="¿Qué ha pasado? Escribe una nota, el resumen de una llamada…"></textarea>
          <div class="fila entre"><div class="fila"><button type="button" class="btn peq" id="n-venta">${icono('euro')}Registrar compra</button><button type="button" class="btn peq" id="redactar">${icono('ia')}Redactar mensaje</button></div><button class="btn prim peq">Guardar</button></div>
        </form>
      </div>
      <div class="tarjeta">
        <h2>Historial</h2>
        ${historial.length ? `<div class="linea" style="margin-top:14px">${historial.map((h) => `<div class="hito ${h.clase}"><div class="fila entre"><b style="font-size:13px">${esc(h.t)}</b><span class="tenue">${fechaHora(h.f)} ${h.id ? `<button class="btn fant peq ico" data-borrar-act="${h.id}" aria-label="Borrar" style="height:22px;width:22px">${icono('x')}</button>` : ''}${h.venta ? `<button class="btn fant peq ico" data-borrar-venta="${h.venta}" aria-label="Borrar compra" style="height:22px;width:22px">${icono('x')}</button>` : ''}</span></div><p>${esc(h.txt)}</p></div>`).join('')}</div>` : '<p class="tenue">Sin actividad todavía.</p>'}
      </div>
    </div>
  </div>`;

  $('#volver', el).addEventListener('click', () => history.length > 1 ? history.back() : ctx.ir('contactos'));
  $('#editar', el).addEventListener('click', () => editarContacto(ctx, c));
  $('#n-trato', el).addEventListener('click', () => editarTrato(ctx, null, c.id));
  $('#n-tarea', el).addEventListener('click', () => editarTarea(ctx, null, c.id));
  $('#n-venta', el).addEventListener('click', () => editarVenta(ctx, c.id));
  $('#archivar', el).addEventListener('click', async () => { await db.guardar('contactos', { ...stripCalc(c), archivado: !c.archivado }); aviso(c.archivado ? 'Contacto recuperado' : 'Contacto archivado'); });
  $('#wa', el)?.addEventListener('click', () => enviarPlantilla(ctx, c, 'whatsapp'));
  $('#redactar', el).addEventListener('click', () => import('./vistas-ia.js').then((m) => m.redactarPara(ctx, c)));
  $('#ia-resumen', el).addEventListener('click', () => import('./vistas-ia.js').then((m) => m.resumenPara(ctx, c, $('#ia-salida', el))));
  let tipo = 'nota';
  $$('#tipo-act button', el).forEach((b) => b.addEventListener('click', () => { tipo = b.dataset.t; $$('#tipo-act button', el).forEach((x) => x.classList.toggle('activo', x === b)); }));
  $('#f-nota', el).addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = e.target.texto.value.trim();
    if (!texto) return;
    await registrar(c.id, tipo, texto);
    aviso('Guardado en el historial');
  });
  $$('[data-borrar-act]', el).forEach((b) => b.addEventListener('click', async () => { if (await confirmar('¿Borrar esta entrada del historial?')) await db.borrar('actividades', b.dataset.borrarAct); }));
  $$('[data-borrar-venta]', el).forEach((b) => b.addEventListener('click', async () => { if (await confirmar('¿Borrar esta compra?')) await db.borrar('ventas', b.dataset.borrarVenta); }));
  enlazarLista(el, ctx);
}

export function menuNuevoContacto(ctx, cid) {
  const d = modal({
    titulo: 'Añadir',
    cuerpo: `<div class="pila"><button type="button" class="btn" data-x="trato" style="width:100%">${icono('embudo')}Oportunidad</button><button type="button" class="btn" data-x="tarea" style="width:100%">${icono('agenda')}Tarea</button><button type="button" class="btn" data-x="venta" style="width:100%">${icono('euro')}Compra</button><button type="button" class="btn" data-x="contacto" style="width:100%">${icono('contactos')}Otro contacto</button></div>`,
  });
  d.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => {
    d.close();
    ({ trato: () => editarTrato(ctx, null, cid), tarea: () => editarTarea(ctx, null, cid), venta: () => editarVenta(ctx, cid), contacto: () => editarContacto(ctx) })[b.dataset.x]();
  }));
}

function selectorContacto(ctx, sel, obligatorio = false) {
  const lista = [...ctx.datos.contactos].filter((c) => !c.archivado || c.id === sel).sort((a, b) => a.nombre.localeCompare(b.nombre));
  return `<select name="contacto" ${obligatorio ? 'required' : ''}><option value="">${obligatorio ? 'Elige un contacto…' : 'Sin contacto'}</option>${lista.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nombre)}${c.empresa ? ` (${esc(c.empresa)})` : ''}</option>`).join('')}</select>`;
}

function editarVenta(ctx, cid) {
  modal({
    titulo: 'Registrar compra',
    cuerpo: `<div class="form">
      <label class="campo todo"><span>Contacto *</span>${selectorContacto(ctx, cid, true)}</label>
      <label class="campo todo"><span>Concepto *</span><input name="concepto" required placeholder="Producto o servicio"></label>
      <label class="campo"><span>Importe *</span><input name="importe" type="number" step="0.01" min="0" required inputmode="decimal"></label>
      <label class="campo"><span>Fecha</span><input name="fecha" type="date" value="${hoyISO()}"></label></div>`,
    pie: '<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>',
    alGuardar: async (form) => {
      const v = datosForm(form);
      await db.guardar('ventas', { contacto: v.contacto, concepto: v.concepto, importe: Number(v.importe), fecha: new Date(v.fecha + 'T12:00:00').toISOString() });
      aviso('Compra registrada');
    },
  });
}

/* ───────────── EMBUDO (kanban) ───────────── */
export async function embudo(el, ctx) {
  const d = ctx.datos;
  el.innerHTML = `<p class="tenue" style="margin:0 0 12px">Arrastra las tarjetas para cambiarlas de etapa (en el móvil, toca una y elige la etapa). Las etapas se cambian en Ajustes.</p>
  <div class="kanban">${d.etapas.map((e) => {
    const ts = d.tratos.filter((t) => t.etapa === e.id).sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0));
    return `<section class="columna" data-etapa="${e.id}">
      <header><i class="color-etapa" style="background:${e.color}"></i><b>${esc(e.nombre)}</b><span class="tenue">${ts.length} · ${dinero(ts.reduce((s, t) => s + (Number(t.valor) || 0), 0))}</span></header>
      ${ts.map((t) => { const c = d.porId.get(t.contacto); return `<article class="trato" draggable="true" data-id="${t.id}">
        <b>${esc(t.titulo)}</b><div class="fila entre"><span class="tenue">${esc(c?.nombre || 'Sin contacto')}</span><b>${dinero(t.valor)}</b></div>
        ${t.cierre ? `<div class="fila"><span class="etiqueta ${e.tipo === 'abierta' && t.cierre < hoyISO() ? 'rojo' : ''}">${icono('reloj')} ${fecha(t.cierre)}</span></div>` : ''}</article>`; }).join('')}
      <button class="btn fant peq" data-nuevo="${e.id}" style="width:100%;margin-top:8px">${icono('mas')}Añadir</button>
    </section>`;
  }).join('')}</div>`;

  let arrastrado = null;
  $$('.trato', el).forEach((t) => {
    t.addEventListener('dragstart', (e) => { arrastrado = t.dataset.id; t.classList.add('arrastrando'); e.dataTransfer.effectAllowed = 'move'; });
    t.addEventListener('dragend', () => t.classList.remove('arrastrando'));
    t.addEventListener('click', () => editarTrato(ctx, d.tratos.find((x) => x.id === t.dataset.id)));
  });
  $$('.columna', el).forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('sobre'); });
    col.addEventListener('dragleave', () => col.classList.remove('sobre'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault(); col.classList.remove('sobre');
      const t = d.tratos.find((x) => x.id === arrastrado);
      if (t) { await moverTrato(stripCalc(t), col.dataset.etapa, d.etapas); aviso(`Movido a ${d.etapas.find((x) => x.id === col.dataset.etapa)?.nombre}`); }
    });
  });
  $$('[data-nuevo]', el).forEach((b) => b.addEventListener('click', () => editarTrato(ctx, null, null, b.dataset.nuevo)));
}

export function editarTrato(ctx, t = null, cid = null, etapa = null) {
  const nuevo = !t;
  const d = ctx.datos;
  t = t || { titulo: '', valor: '', etapa: etapa || d.etapas[0]?.id, contacto: cid };
  modal({
    titulo: nuevo ? 'Nueva oportunidad' : 'Oportunidad',
    cuerpo: `<div class="form">
      <label class="campo todo"><span>Título *</span><input name="titulo" required value="${esc(t.titulo)}" placeholder="Qué le vas a vender"></label>
      <label class="campo todo"><span>Contacto</span>${selectorContacto(ctx, t.contacto)}</label>
      <label class="campo"><span>Valor</span><input name="valor" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(t.valor)}"></label>
      <label class="campo"><span>Etapa</span><select name="etapa">${opciones(d.etapas.map((e) => [e.id, e.nombre]), t.etapa)}</select></label>
      <label class="campo"><span>Fecha de cierre prevista</span><input name="cierre" type="date" value="${esc(t.cierre || '')}"></label>
      <label class="campo todo"><span>Notas</span><textarea name="notas">${esc(t.notas || '')}</textarea></label></div>`,
    pie: `${nuevo ? '' : `<button type="button" class="btn peligro" data-borrar style="margin-right:auto">${icono('papelera')}Borrar</button>`}${!nuevo && t.contacto ? '<button type="button" class="btn" data-ver>Ver contacto</button>' : ''}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>`,
    alAbrir: (dlg) => {
      dlg.querySelector('[data-borrar]')?.addEventListener('click', async () => { if (await confirmar(`¿Borrar «${t.titulo}»?`)) { await db.borrar('tratos', t.id); dlg.close(); aviso('Oportunidad borrada'); } });
      dlg.querySelector('[data-ver]')?.addEventListener('click', () => { dlg.close(); ctx.ir('contacto', t.contacto); });
    },
    alGuardar: async (form) => {
      const v = datosForm(form);
      const base = { ...stripCalc(t), titulo: v.titulo, contacto: v.contacto || null, valor: Number(v.valor) || 0, cierre: v.cierre || null, notas: v.notas };
      if (nuevo) {
        base.etapa = v.etapa;
        const tipo = d.etapas.find((e) => e.id === v.etapa)?.tipo;
        base.cerrado = tipo && tipo !== 'abierta' ? new Date().toISOString() : null;
        const g = await db.guardar('tratos', base);
        if (g.contacto) await registrar(g.contacto, 'sistema', `Nueva oportunidad: ${g.titulo} (${dinero(g.valor)}).`);
      } else {
        await db.guardar('tratos', base);
        await moverTrato(base, v.etapa, d.etapas);
      }
      aviso('Oportunidad guardada');
    },
  });
}

/* ───────────── AGENDA ───────────── */
export async function agenda(el, ctx) {
  const d = ctx.datos;
  const hoy = hoyISO();
  const manana = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const semana = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const pend = d.tareas.filter((t) => !t.hecha).sort((a, b) => (String(a.vence || '9') + (a.hora || '')).localeCompare(String(b.vence || '9') + (b.hora || '')));
  const grupos = [
    ['Vencidas', pend.filter((t) => t.vence && t.vence < hoy), 'rojo'],
    ['Hoy', pend.filter((t) => t.vence === hoy), 'ambar'],
    ['Mañana', pend.filter((t) => t.vence === manana), 'azul'],
    ['Próximos 7 días', pend.filter((t) => t.vence > manana && t.vence <= semana), ''],
    ['Más adelante', pend.filter((t) => t.vence > semana), ''],
    ['Sin fecha', pend.filter((t) => !t.vence), ''],
  ];
  const hechas = d.tareas.filter((t) => t.hecha).sort((a, b) => String(b.hechaEn).localeCompare(String(a.hechaEn))).slice(0, 15);
  const fila = (t, clase) => {
    const c = d.porId.get(t.contacto);
    return `<li><input type="checkbox" data-hecha="${t.id}" ${t.hecha ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--marca)" aria-label="Hecha">
      <div class="crece clic" data-editar="${t.id}" style="cursor:pointer"><div class="tit" ${t.hecha ? 'style="text-decoration:line-through;color:var(--texto-3)"' : ''}>${esc(t.titulo)}</div><div class="sub">${esc(TIPOS_TAREA[t.tipo] || 'Tarea')}${c ? ` · ${esc(c.nombre)}` : ''}</div></div>
      ${t.vence ? `<span class="etiqueta ${clase}">${fecha(t.vence, { weekday: 'short', day: 'numeric', month: 'short' })}${t.hora ? ' ' + esc(t.hora) : ''}</span>` : ''}
      ${c?.telefono ? `<a class="btn fant ico peq" href="tel:${esc(normTel(c.telefono))}" aria-label="Llamar">${icono('tel')}</a>` : ''}</li>`;
  };
  el.innerHTML = `<div class="rejilla r-21">
    <div class="pila">${grupos.filter(([, l]) => l.length).map(([tit, l, cl]) => `<div class="tarjeta plana"><div class="fila entre" style="padding:14px 16px 4px"><h2>${tit}</h2><span class="tenue">${l.length}</span></div><ul class="lista">${l.map((t) => fila(t, cl)).join('')}</ul></div>`).join('') || `<div class="tarjeta">${vacio('agenda', 'No tienes tareas pendientes.', `<div style="margin-top:12px"><button class="btn prim" id="b-nueva">${icono('mas')}Nueva tarea</button></div>`)}</div>`}</div>
    <div class="tarjeta plana"><div style="padding:14px 16px 4px"><h2>Hechas recientemente</h2></div>${hechas.length ? `<ul class="lista">${hechas.map((t) => fila(t, '')).join('')}</ul>` : '<p class="tenue" style="padding:0 16px">Aún nada.</p>'}</div>
  </div>`;
  $('#b-nueva', el)?.addEventListener('click', () => editarTarea(ctx));
  $$('[data-editar]', el).forEach((x) => x.addEventListener('click', () => editarTarea(ctx, d.tareas.find((t) => t.id === x.dataset.editar))));
  enlazarLista(el, ctx);
}

export function editarTarea(ctx, t = null, cid = null) {
  const nuevo = !t;
  t = t || { titulo: '', tipo: 'llamada', vence: hoyISO(), contacto: cid };
  modal({
    titulo: nuevo ? 'Nueva tarea' : 'Tarea',
    cuerpo: `<div class="form">
      <label class="campo todo"><span>Qué hay que hacer *</span><input name="titulo" required value="${esc(t.titulo)}"></label>
      <label class="campo"><span>Tipo</span><select name="tipo">${opciones(Object.entries(TIPOS_TAREA), t.tipo)}</select></label>
      <label class="campo"><span>Contacto</span>${selectorContacto(ctx, t.contacto)}</label>
      <label class="campo"><span>Fecha</span><input name="vence" type="date" value="${esc(t.vence || '')}"></label>
      <label class="campo"><span>Hora</span><input name="hora" type="time" value="${esc(t.hora || '')}"></label></div>`,
    pie: `${nuevo ? '' : `<button type="button" class="btn peligro" data-borrar style="margin-right:auto">${icono('papelera')}Borrar</button>`}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>`,
    alAbrir: (dlg) => dlg.querySelector('[data-borrar]')?.addEventListener('click', async () => { if (await confirmar('¿Borrar esta tarea?')) { await db.borrar('tareas', t.id); dlg.close(); aviso('Tarea borrada'); } }),
    alGuardar: async (form) => {
      const v = datosForm(form);
      await db.guardar('tareas', { ...stripCalc(t), ...v, contacto: v.contacto || null, hecha: !!t.hecha });
      aviso('Tarea guardada');
    },
  });
}

/* ───────────── RESULTADOS ───────────── */
export async function resultados(el, ctx) {
  const periodo = ctx.periodo || 30;
  const r = calcResultados(ctx.datos, periodo);
  const a = r.actual; const b = r.anterior;
  const comp = (x, y, fmt = numero) => {
    const dl = y ? Math.round(((x - y) / y) * 100) : x ? 100 : 0;
    return `<div class="num">${fmt(x)}</div><div class="tenue">antes ${fmt(y)} ${x !== y ? `<span class="delta ${dl >= 0 ? 'sube' : 'baja'}">${dl >= 0 ? '▲' : '▼'} ${Math.abs(dl)} %</span>` : ''}</div>`;
  };
  const origenes = Object.entries(r.origenes).sort((x, y) => y[1].valor - x[1].valor || y[1].contactos - x[1].contactos);
  const maxO = Math.max(1, ...origenes.map(([, o]) => o.contactos));
  el.innerHTML = `
  <div class="fila entre" style="margin-bottom:12px"><p class="tenue" style="margin:0">Todo sale de los datos de tu CRM. Compara el periodo con el anterior de la misma duración.</p>
    <div class="filtros">${[7, 30, 90, 365].map((p) => `<button data-p="${p}" class="${p === periodo ? 'activo' : ''}">${p === 365 ? '1 año' : p + ' días'}</button>`).join('')}</div></div>
  <div class="rejilla r-4">
    <div class="tarjeta kpi"><div class="eti">Contactos nuevos</div>${comp(a.nuevos, b.nuevos)}</div>
    <div class="tarjeta kpi"><div class="eti">Oportunidades ganadas</div>${comp(a.ganados, b.ganados)}</div>
    <div class="tarjeta kpi"><div class="eti">Valor ganado + compras</div>${comp(a.valorGanado + a.ventas, b.valorGanado + b.ventas, dinero)}</div>
    <div class="tarjeta kpi"><div class="eti">Tareas completadas</div>${comp(a.tareasHechas, b.tareasHechas)}</div>
  </div>
  <div class="rejilla r-2" style="margin-top:14px">
    <div class="tarjeta"><h2>Embudo actual</h2>${r.embudo.map((e) => barra(e.nombre, e.n, Math.max(1, ...r.embudo.map((x) => x.n)), dinero(e.valor), e.color)).join('')}</div>
    <div class="tarjeta"><h2>¿De dónde vienen tus clientes?</h2>${origenes.length ? origenes.map(([o, v]) => barra(o, v.contactos, maxO, `${dinero(v.valor)} en ventas`)).join('') : '<p class="tenue">Indica el origen de cada contacto para ver qué canal te trae más ventas.</p>'}</div>
  </div>
  <div class="tarjeta" style="margin-top:14px"><h2>Resumen del periodo</h2>
    <p class="suave" style="margin:10px 0 0">${a.ganados} oportunidades ganadas y ${a.perdidos} perdidas${a.tasa !== null ? ` (tasa de cierre ${a.tasa} %)` : ''}. ${a.numVentas} compras registradas por ${dinero(a.ventas)}. Hay ${dinero(r.pipeline)} abiertos en el embudo.</p></div>`;
  $$('[data-p]', el).forEach((x) => x.addEventListener('click', () => { ctx.periodo = Number(x.dataset.p); ctx.pintar(); }));
}

/* ───────────── PLANTILLAS ───────────── */
export async function plantillas(el, ctx) {
  const ps = (await db.todos('plantillas')).sort((a, b) => a.nombre.localeCompare(b.nombre));
  el.innerHTML = `<div class="aviso info" style="margin-bottom:14px">Variables disponibles: <span class="mono">{{nombre}}</span> <span class="mono">{{empresa}}</span> <span class="mono">{{negocio}}</span> <span class="mono">{{yo}}</span> <span class="mono">{{fecha}}</span>. Se rellenan solas al enviar desde la ficha de un contacto.</div>
  <div class="rejilla r-3">${ps.map((p) => `<div class="tarjeta pila"><div class="fila entre"><h3>${esc(p.nombre)}</h3><span class="etiqueta">${esc({ whatsapp: 'WhatsApp', email: 'Email', cualquiera: 'Cualquiera' }[p.canal] || p.canal)}</span></div><p class="suave" style="margin:0;white-space:pre-wrap">${esc(p.texto)}</p><div class="fila"><button class="btn peq" data-ed="${p.id}">${icono('editar')}Editar</button></div></div>`).join('') || `<div class="tarjeta">${vacio('plantillas', 'Sin plantillas.')}</div>`}</div>`;
  $$('[data-ed]', el).forEach((b) => b.addEventListener('click', () => editarPlantilla(ctx, ps.find((p) => p.id === b.dataset.ed))));
}

export function editarPlantilla(ctx, p = null) {
  const nuevo = !p;
  p = p || { nombre: '', canal: 'whatsapp', texto: 'Hola {{nombre}}, ' };
  modal({
    titulo: nuevo ? 'Nueva plantilla' : 'Editar plantilla',
    cuerpo: `<div class="form"><label class="campo"><span>Nombre *</span><input name="nombre" required value="${esc(p.nombre)}"></label>
      <label class="campo"><span>Canal</span><select name="canal">${opciones([['whatsapp', 'WhatsApp'], ['email', 'Email'], ['cualquiera', 'Cualquiera']], p.canal)}</select></label>
      <label class="campo todo"><span>Texto *</span><textarea name="texto" required rows="6">${esc(p.texto)}</textarea></label></div>`,
    pie: `${nuevo ? '' : `<button type="button" class="btn peligro" data-borrar style="margin-right:auto">${icono('papelera')}Borrar</button>`}<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>`,
    alAbrir: (dlg) => dlg.querySelector('[data-borrar]')?.addEventListener('click', async () => { if (await confirmar('¿Borrar esta plantilla?')) { await db.borrar('plantillas', p.id); dlg.close(); ctx.pintar(); } }),
    alGuardar: async (form) => { await db.guardar('plantillas', { ...p, ...datosForm(form) }); aviso('Plantilla guardada'); ctx.pintar(); },
  });
}

export async function variablesDe(c) {
  return { nombre: (c.nombre || '').split(' ')[0], empresa: c.empresa || '', negocio: (await db.ajuste('negocio')) || '', yo: (await db.ajuste('yo')) || '', fecha: fecha(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' }) };
}

export async function enviarPlantilla(ctx, c, canal = 'whatsapp', textoInicial = '') {
  const ps = (await db.todos('plantillas')).filter((p) => p.canal === canal || p.canal === 'cualquiera');
  const vars = await variablesDe(c);
  modal({
    titulo: canal === 'email' ? `Email a ${c.nombre}` : `WhatsApp a ${c.nombre}`,
    ancho: true,
    cuerpo: `<div class="pila">
      <label class="campo"><span>Plantilla</span><select id="sel-pl"><option value="">Escribir a mano</option>${ps.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label>
      <label class="campo"><span>Mensaje</span><textarea id="txt-pl" rows="6">${esc(textoInicial)}</textarea></label>
      <p class="tenue" style="margin:0">Se abrirá ${canal === 'email' ? 'tu programa de correo' : 'WhatsApp'} con el mensaje listo. Tú decides si lo envías.</p></div>`,
    pie: `<button type="button" class="btn" data-copiar>${icono('copiar')}Copiar</button><button class="btn prim">${icono('enviar')}Abrir ${canal === 'email' ? 'correo' : 'WhatsApp'}</button>`,
    alAbrir: (dlg) => {
      const txt = dlg.querySelector('#txt-pl');
      dlg.querySelector('#sel-pl').addEventListener('change', (e) => { const p = ps.find((x) => x.id === e.target.value); if (p) txt.value = rellenar(p.texto, vars); });
      dlg.querySelector('[data-copiar]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(txt.value); aviso('Copiado'); } catch { txt.select(); } });
    },
    alGuardar: async (form) => {
      const texto = form.querySelector('#txt-pl').value.trim();
      if (!texto) { aviso('Escribe el mensaje'); return false; }
      const url = canal === 'email' ? `mailto:${c.email}?body=${encodeURIComponent(texto)}` : enlaceWhatsApp(c.telefono, texto);
      window.open(url, '_blank', 'noopener');
      await registrar(c.id, canal === 'email' ? 'email' : 'mensaje', texto);
    },
  });
}

/* ───────────── IMPORTAR / EXPORTAR CSV ───────────── */
const CAMPOS = { nombre: /^(nombre|name|full ?name|cliente|contacto)$/i, apellidos: /^(apellidos?|last ?name|surname)$/i, telefono: /(tel|phone|m[oó]vil|celular|whats)/i, email: /(e-?mail|correo)/i, empresa: /(empresa|company|organi[sz]a)/i, ciudad: /(ciudad|city|localidad|poblaci)/i, origen: /(origen|source|canal)/i, etiquetas: /(etiquet|tags?)/i, notas: /(nota|notes|coment)/i };

export async function importarCSV(ctx) {
  const archivo = await elegirArchivo('.csv,text/csv');
  if (!archivo) return;
  const filas = leerCSV(await archivo.text());
  if (filas.length < 2) { aviso('El archivo no tiene filas.'); return; }
  const cab = filas[0].map((h) => h.trim());
  const mapa = {};
  cab.forEach((h, i) => { for (const [k, re] of Object.entries(CAMPOS)) if (mapa[k] === undefined && re.test(h)) { mapa[k] = i; break; } });
  if (mapa.nombre === undefined && mapa.telefono === undefined && mapa.email === undefined) { aviso('No encuentro columnas de nombre, teléfono o email.'); return; }
  const existentes = ctx.datos.contactos;
  const vistos = [];
  const nuevos = []; let duplicados = 0; let vacios = 0;
  for (const f of filas.slice(1)) {
    const v = (k) => (mapa[k] !== undefined ? (f[mapa[k]] || '').trim() : '');
    const c = { nombre: [v('nombre'), v('apellidos')].filter(Boolean).join(' '), telefono: v('telefono'), email: v('email'), empresa: v('empresa'), ciudad: v('ciudad'), origen: v('origen'), notas: v('notas'), etiquetas: v('etiquetas').split(/[,|]/).map((x) => x.trim()).filter(Boolean) };
    if (!c.nombre) c.nombre = c.email || c.telefono;
    if (!c.nombre) { vacios++; continue; }
    if (buscarDuplicado(existentes, c) || buscarDuplicado(vistos, c)) { duplicados++; continue; }
    vistos.push(c); nuevos.push(c);
  }
  modal({
    titulo: 'Importar contactos',
    ancho: true,
    cuerpo: `<div class="pila"><p style="margin:0"><b>${nuevos.length}</b> contactos nuevos · <span class="suave">${duplicados} ya existían (no se duplican) · ${vacios} filas vacías</span></p>
      <p class="tenue" style="margin:0">Columnas reconocidas: ${Object.keys(mapa).map((k) => `<span class="etiqueta">${k} ← ${esc(cab[mapa[k]])}</span>`).join(' ')}</p>
      <div class="tarjeta plana desliza"><table class="tabla"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Empresa</th></tr></thead><tbody>
      ${nuevos.slice(0, 8).map((c) => `<tr><td>${esc(c.nombre)}</td><td>${esc(c.telefono)}</td><td>${esc(c.email)}</td><td>${esc(c.empresa)}</td></tr>`).join('')}</tbody></table></div>
      ${nuevos.length > 8 ? `<p class="tenue" style="margin:0">…y ${nuevos.length - 8} más.</p>` : ''}
      <label class="campo"><span>Etiqueta para todos (opcional)</span><input name="etiqueta" placeholder="p. ej. importados-${new Date().getFullYear()}"></label></div>`,
    pie: `<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim" ${nuevos.length ? '' : 'disabled'}>Importar ${nuevos.length}</button>`,
    alGuardar: async (form) => {
      const et = form.etiqueta.value.trim();
      const ahora = new Date().toISOString();
      await db.guardarVarios('contactos', nuevos.map((c) => ({ ...c, etiquetas: et ? [...c.etiquetas, et] : c.etiquetas, creado: ahora })));
      aviso(`${nuevos.length} contactos importados`);
      ctx.ir('contactos');
    },
  });
}

export function exportarCSV(ctx) {
  const filas = [['nombre', 'telefono', 'email', 'empresa', 'ciudad', 'origen', 'etiquetas', 'segmento', 'puntuacion', 'compras', 'gastado', 'ultima_actividad', 'notas']];
  for (const c of ctx.datos.contactos) filas.push([c.nombre, c.telefono, c.email, c.empresa, c.ciudad, c.origen, (c.etiquetas || []).join(', '), SEGMENTOS[c._segmento]?.nombre, c._puntuacion, c._compras, c._gastado, c._ultimaActividad?.slice(0, 10), c.notas]);
  descargar(`contactos-${hoyISO()}.csv`, aCSV(filas), 'text/csv;charset=utf-8');
  aviso('CSV descargado');
}
