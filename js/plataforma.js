// Cuenta HUGLE y conexión con la plataforma (15-11-2026).
// 1. Acceso: el CRM se abre desde el Control Center (oficina-hugle.pages.dev), que manda un pase de un solo uso en el
//    #fragmento de la URL. El CRM lo canjea por su propia sesión. Sin sesión válida se muestra la pantalla de acceso.
// 2. Equipo: con BUSINESS HUGLE, la Jefa de personal deja órdenes para los 3 agentes; el CRM las recoge, las hace con
//    los datos del dispositivo y devuelve un informe corto (sin teléfonos ni correos; los nombres, abreviados salvo
//    que el usuario diga lo contrario).
import * as db from './db.js';
import { PLATAFORMA } from './config.js';
import { ejecutar, aplicarAccion, agente } from './agentes.js';

const CLAVE = 'crm-cuenta';
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; } };
const escribir = (v) => { try { v ? localStorage.setItem(CLAVE, JSON.stringify(v)) : localStorage.removeItem(CLAVE); } catch {} };
const oyentes = new Set();
export function alCambiarCuenta(f) { oyentes.add(f); return () => oyentes.delete(f); }
const avisar = () => { for (const f of oyentes) f(cuenta()); };

export const cuenta = () => leer()?.cuenta || null;
export const tieneApp = (app) => !!cuenta()?.apps?.includes(app);
export const urlPanel = (extra = '') => `${PLATAFORMA.panel}?app=crm&volver=${encodeURIComponent(location.origin + location.pathname)}${extra}`;

async function api(ruta, { metodo = 'GET', cuerpo, sesion = leer()?.sesion, tiempo = 8000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), tiempo);
  try {
    const r = await fetch(PLATAFORMA.api + ruta, {
      method: metodo, signal: ctl.signal,
      headers: { 'content-type': 'application/json', ...(sesion ? { authorization: 'Bearer ' + sesion } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error?.mensaje || `Error ${r.status}`); e.estado = r.status; e.codigo = j.error?.codigo; throw e; }
    return j;
  } finally { clearTimeout(t); }
}

/* ───────── Acceso ───────── */
export async function comprobarAcceso() {
  if (!PLATAFORMA.requiereCuenta) return true;
  // ¿Venimos del Control Center con un pase?
  const m = location.hash.match(/acceso=(hglt_[a-f0-9]{32})/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    try {
      const r = await api('/v1/canjear', { metodo: 'POST', cuerpo: { ticket: m[1], app: 'crm' }, sesion: null });
      const viejo = leer();
      if (viejo?.sesion && viejo.sesion !== r.sesion) api('/v1/salir', { metodo: 'POST', sesion: viejo.sesion }).catch(() => {});
      escribir({ sesion: r.sesion, cuenta: r.cuenta, comprobado: Date.now() });
      avisar();
      return true;
    } catch (e) { return pantallaAcceso(e.message); }
  }
  const g = leer();
  if (!g?.sesion) return pantallaAcceso();
  try {
    const r = await api('/v1/yo');
    escribir({ ...g, cuenta: r.cuenta, comprobado: Date.now() });
    avisar();
    return true;
  } catch (e) {
    if (e.estado === 401 || e.estado === 403) { escribir(null); return pantallaAcceso(e.message); }
    // Sin conexión: se puede seguir usando unos días con la última comprobación buena
    if (Date.now() - (g.comprobado || 0) < PLATAFORMA.diasSinConexion * 864e5) return true;
    return pantallaAcceso('Conéctate a internet un momento para comprobar tu cuenta HUGLE.');
  }
}

function pantallaAcceso(error = '') {
  const capa = document.createElement('div');
  capa.className = 'acceso';
  capa.innerHTML = `<div class="acceso-caja">
    <img src="img/logo.svg" alt="" width="64" height="64">
    <h1>CRM HUGLE</h1>
    <p>Tu CRM gratis, con 3 agentes de IA que funcionan dentro de tu dispositivo.</p>
    <p class="tenue">Para usarlo necesitas una cuenta HUGLE gratuita. Créala o entra en tu <b>Control Center</b> y vuelve aquí con un clic. Tus clientes se quedan siempre en este dispositivo.</p>
    ${error ? `<div class="aviso">${error.replace(/[<>&]/g, '')}</div>` : ''}
    <a class="btn grad grande" href="${urlPanel()}">Crear cuenta gratis o entrar</a>
    <small class="tenue">Te llevará a oficina-hugle.pages.dev</small>
  </div>`;
  document.body.append(capa);
  return new Promise(() => {}); // la app no arranca: el usuario sale al Control Center
}

export async function salir() {
  const g = leer();
  if (g?.sesion) await api('/v1/salir', { metodo: 'POST' }).catch(() => {});
  escribir(null);
  location.reload();
}

/* ───────── Órdenes de la Jefa de personal (BUSINESS HUGLE) ───────── */
const abreviar = (texto, d) => {
  let t = texto;
  for (const c of d.contactos) {
    const [n, ...ap] = c.nombre.split(' ');
    if (c.nombre.length > 2) t = t.split(c.nombre).join(`${n}${ap.length ? ' ' + ap[0][0] + '.' : ''}`);
  }
  return t.replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '[correo]').replace(/\+?\d[\d\s.-]{7,}\d/g, '[teléfono]');
};

let sincronizando = false;
export async function recogerOrdenes(cargar) {
  if (sincronizando || !tieneApp('business') || !navigator.onLine) return 0;
  sincronizando = true;
  let n = 0;
  try {
    const { ordenes } = await api('/v1/equipo/ordenes?estado=pendiente');
    if (!ordenes.length) return 0;
    const [auto, nombres] = await Promise.all([db.ajuste('jefaAutoTareas', false), db.ajuste('jefaNombres', false)]);
    for (const o of ordenes.reverse()) {
      await api(`/v1/equipo/ordenes/${o.id}`, { metodo: 'POST', cuerpo: { estado: 'recibida' } });
      const d = await cargar();
      const quien = await agente(o.agente);
      let informe; let estado = 'hecha'; let acciones = [];
      try {
        const r = await ejecutar(o.agente, o.instruccion, d);
        acciones = r.acciones || [];
        let creadas = 0;
        if (auto) for (const a of acciones) if (await aplicarAccion(a)) { a.hecha = true; creadas++; }
        informe = `${r.texto}${acciones.length ? `\n\n${auto ? `He creado ${creadas} tareas en el CRM.` : `He propuesto ${acciones.length} tareas; esperan la aprobación del usuario en la Bandeja.`}` : ''}`;
      } catch (e) { estado = 'fallida'; informe = `No he podido hacerlo: ${e.message || e}`; }
      await api(`/v1/equipo/ordenes/${o.id}`, { metodo: 'POST', cuerpo: { estado, informe: nombres ? informe : abreviar(informe, d) } });
      await db.guardar('ordenes', { remota: o.id, agente: o.agente, instruccion: o.instruccion, estado, informe, fecha: new Date().toISOString() });
      await db.guardar('bandeja', { agente: o.agente, titulo: `Orden de la Jefa para ${quien.nombre}: ${o.instruccion.slice(0, 80)}`, texto: informe, acciones, fecha: new Date().toISOString(), leida: false, origen: 'jefa' });
      n++;
    }
  } catch (e) {
    if (e.estado === 401) { escribir(null); location.reload(); }
  } finally { sincronizando = false; }
  return n;
}

// Órdenes que el propio usuario manda a su equipo desde el CRM (pasan por la Jefa, que las reparte)
export async function encargarAJefa(objetivo) {
  return api('/v1/equipo/jefa', { metodo: 'POST', cuerpo: { objetivo } });
}
