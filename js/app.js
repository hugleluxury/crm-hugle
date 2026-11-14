// CRM HUGLE · arranque, navegación y elementos comunes.
import * as db from './db.js';
import { $, $$, aviso, modal, icono, region } from './util.js';
import { cargarTodo, pendientesDeHoy, PLANTILLAS_INICIALES } from './negocio.js';
import { alCambiarIA, encender, enCache, estadoIA } from './ia.js';
import * as V from './vistas.js';
import * as VIA from './vistas-ia.js';
import { comprobarAcceso, recogerOrdenes } from './plataforma.js';
import { revisarRutinas } from './agentes.js';

export const VERSION = '1.1.0';

const RUTAS = {
  inicio: { titulo: 'Inicio', pintar: V.inicio },
  contactos: { titulo: 'Contactos', pintar: V.contactos },
  contacto: { titulo: 'Contacto', pintar: V.ficha, menu: 'contactos' },
  embudo: { titulo: 'Embudo de ventas', pintar: V.embudo },
  agenda: { titulo: 'Agenda y tareas', pintar: V.agenda },
  asistente: { titulo: 'Agentes IA', pintar: VIA.asistente },
  resultados: { titulo: 'Resultados', pintar: V.resultados },
  plantillas: { titulo: 'Plantillas', pintar: V.plantillas },
  ajustes: { titulo: 'Ajustes', pintar: VIA.ajustes },
};

export const ctx = {
  datos: null,
  ruta: 'inicio',
  param: null,
  async recargar() { ctx.datos = await cargarTodo(); return ctx.datos; },
  ir(ruta, param = null) { location.hash = param ? `#/${ruta}/${encodeURIComponent(param)}` : `#/${ruta}`; },
  pintar: () => pintar(),
};

let pintando = false;
let pendiente = false;
async function pintar() {
  if (pintando) { pendiente = true; return; }
  pintando = true;
  try {
    const [, ruta = 'inicio', param = null] = location.hash.split('/');
    const r = RUTAS[ruta] ? ruta : 'inicio';
    if (r !== ctx.ruta) ctx.limpiar?.();
    ctx.ruta = r; ctx.param = param ? decodeURIComponent(param) : null;
    await ctx.recargar();
    const def = RUTAS[r];
    $('#titulo').textContent = def.titulo;
    document.title = `${def.titulo} · ${(await db.ajuste('negocio')) || 'CRM HUGLE'}`;
    const activa = def.menu || r;
    $$('[data-ir]').forEach((a) => a.classList.toggle('activo', a.dataset.ir === activa));
    const vista = $('#vista');
    await def.pintar(vista, ctx);
    const n = pendientesDeHoy(ctx.datos).total;
    $('#n-hoy').textContent = n ? String(n) : '';
    contarBandeja();
  } catch (e) {
    console.error(e);
    $('#vista').innerHTML = `<div class="tarjeta aviso">Algo ha fallado al mostrar esta pantalla: ${String(e.message || e)}</div>`;
  } finally {
    pintando = false;
    if (pendiente) { pendiente = false; pintar(); }
  }
}

async function contarBandeja() {
  const n = (await db.todos('bandeja')).filter((x) => !x.leida).length;
  $('#n-bandeja').textContent = n ? String(n) : '';
}
ctx.contarBandeja = contarBandeja;

// Trabajo en segundo plano de los agentes: rutinas programadas y órdenes de la Jefa de personal (BUSINESS)
async function trabajoDeFondo() {
  const n = (await revisarRutinas(ctx.recargar).catch(() => 0)) + (await recogerOrdenes(ctx.recargar).catch(() => 0));
  if (n) { contarBandeja(); aviso(`Tus agentes han dejado ${n} ${n === 1 ? 'aviso' : 'avisos'} en la Bandeja`); }
}

// Repintar cuando cambian los datos (también desde otra pestaña), salvo si el usuario está escribiendo.
let espera;
db.alCambiar((tabla) => {
  if (['chat', 'memoria', 'habilidades', 'rutinas', 'ordenes'].includes(tabla)) return;
  if (tabla === 'bandeja') { contarBandeja(); return; }
  clearTimeout(espera);
  espera = setTimeout(() => {
    const foco = document.activeElement;
    if (document.querySelector('dialog[open]') || (foco && /INPUT|TEXTAREA|SELECT/.test(foco.tagName) && foco.closest('#vista'))) return;
    pintar();
  }, 120);
});

async function aplicarMarca() {
  const [nombre, color, logo, moneda] = await Promise.all([db.ajuste('negocio'), db.ajuste('color'), db.ajuste('logo'), db.ajuste('moneda', 'EUR')]);
  $('#marca-nombre').textContent = nombre || 'CRM HUGLE';
  $('#marca-logo').src = logo || 'img/logo.svg';
  region.moneda = moneda || 'EUR';
  const raiz = document.documentElement.style;
  if (color) { raiz.setProperty('--marca', color); raiz.setProperty('--marca-2', color); } else { raiz.removeProperty('--marca'); raiz.removeProperty('--marca-2'); }
}
ctx.aplicarMarca = aplicarMarca;

function tema(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('crm-tema', t); } catch {}
  $('#btn-tema use').setAttribute('href', t === 'dark' ? '#i-sol' : '#i-luna');
  document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#0B0F14' : '#F3F6FB';
}

function menuMovil() {
  const enlaces = [...$$('#nav a')].map((a) => `<a class="btn fant" style="justify-content:flex-start;width:100%" data-ir="${a.dataset.ir}">${a.innerHTML}</a>`).join('');
  const d = modal({ titulo: 'Menú', cuerpo: `<div class="nav">${enlaces}</div>` });
  d.querySelectorAll('[data-ir]').forEach((a) => a.addEventListener('click', () => { d.close(); ctx.ir(a.dataset.ir); }));
}

function nuevo() {
  const r = ctx.ruta;
  if (r === 'embudo') return V.editarTrato(ctx);
  if (r === 'agenda') return V.editarTarea(ctx);
  if (r === 'plantillas') return V.editarPlantilla(ctx);
  if (r === 'contacto' && ctx.param) return V.menuNuevoContacto(ctx, ctx.param);
  return V.editarContacto(ctx);
}

async function primeraVez() {
  if (await db.ajuste('iniciado')) return;
  if (!(await db.todos('plantillas')).length) await db.guardarVarios('plantillas', PLANTILLAS_INICIALES.map((p) => ({ ...p })));
  await db.fijar('iniciado', new Date().toISOString());
}

async function arrancar() {
  await comprobarAcceso(); // sin cuenta HUGLE válida se queda en la pantalla de acceso
  await primeraVez();
  await aplicarMarca();
  tema(document.documentElement.dataset.theme || 'dark');

  $$('[data-ir]').forEach((a) => a.addEventListener('click', () => ctx.ir(a.dataset.ir)));
  $('#btn-menu').addEventListener('click', menuMovil);
  $('#btn-tema').addEventListener('click', () => tema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#btn-nuevo').addEventListener('click', nuevo);
  $('#chip-ia').addEventListener('click', () => ctx.ir('asistente'));
  const buscar = $('#buscar');
  buscar.addEventListener('input', () => { ctx.busqueda = buscar.value; if (ctx.ruta !== 'contactos') ctx.ir('contactos'); else pintar(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) { e.preventDefault(); buscar.focus(); }
  });

  alCambiarIA((s) => {
    const txt = { apagada: 'Apagada · pulsa para activar', descargando: `Descargando ${s.progreso}%`, cargando: 'Preparando…', lista: 'Activa en este dispositivo', error: 'Error · pulsa para ver' }[s.fase];
    const clase = { lista: 'ok', descargando: 'va', cargando: 'va', error: 'mal' }[s.fase] || '';
    $('#chip-ia-txt').innerHTML = `<i class="punto ${clase}"></i> ${txt}`;
  });

  window.addEventListener('hashchange', pintar);
  await pintar();
  setTimeout(trabajoDeFondo, 1500);
  setInterval(trabajoDeFondo, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) trabajoDeFondo(); });

  // Si el modelo ya está descargado y el usuario lo dejó encendido, se carga solo.
  if ((await db.ajuste('iaAuto', true)) && (await db.ajuste('iaUsada')) && (await enCache((await db.ajuste('iaModelo')) || undefined))) {
    encender((await db.ajuste('iaModelo')) || undefined).catch(() => {});
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // El service worker añade COOP/COEP: una sola recarga deja la página aislada y la IA puede usar varios hilos.
    const aislar = () => {
      let recargado = false;
      try { recargado = sessionStorage.getItem('crm-coi') === '1'; } catch {}
      if (!self.crossOriginIsolated && navigator.serviceWorker.controller && !recargado && estadoIA().fase === 'apagada' && !document.querySelector('dialog[open]')) {
        try { sessionStorage.setItem('crm-coi', '1'); } catch {}
        location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', aislar);
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(aislar).catch(() => {});
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

arrancar().catch((e) => {
  console.error(e);
  $('#vista').innerHTML = `<div class="tarjeta aviso">No se pudo abrir la base de datos local. Si estás en modo incógnito, abre el CRM en una ventana normal. (${e.message || e})</div>`;
});

export { icono, aviso };
