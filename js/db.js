// CRM HUGLE · almacén local (IndexedDB). Todo se guarda en el dispositivo del usuario.
const NOMBRE = 'crm-hugle';
const VERSION = 2;
// v2 (15-11-2026): memoria, habilidades y rutinas de los agentes, bandeja de avisos y órdenes de la Jefa de personal.
export const TABLAS = ['contactos', 'tratos', 'tareas', 'actividades', 'ventas', 'plantillas', 'conocimiento', 'chat', 'ajustes', 'memoria', 'habilidades', 'rutinas', 'bandeja', 'ordenes'];

let conexion;

function abrir() {
  if (conexion) return conexion;
  conexion = new Promise((ok, mal) => {
    const pet = indexedDB.open(NOMBRE, VERSION);
    pet.onupgradeneeded = () => {
      const db = pet.result;
      for (const t of TABLAS) {
        if (db.objectStoreNames.contains(t)) continue;
        const almacen = db.createObjectStore(t, { keyPath: t === 'ajustes' ? 'clave' : 'id' });
        if (['tratos', 'tareas', 'actividades', 'ventas'].includes(t)) almacen.createIndex('contacto', 'contacto');
      }
    };
    pet.onsuccess = () => ok(pet.result);
    pet.onerror = () => mal(pet.error);
  });
  return conexion;
}

function promesa(pet) {
  return new Promise((ok, mal) => { pet.onsuccess = () => ok(pet.result); pet.onerror = () => mal(pet.error); });
}

async function almacen(tabla, modo = 'readonly') {
  const db = await abrir();
  return db.transaction(tabla, modo).objectStore(tabla);
}

export const id = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
export const ahora = () => new Date().toISOString();

export async function todos(tabla) { return promesa((await almacen(tabla)).getAll()); }
export async function uno(tabla, clave) { return promesa((await almacen(tabla)).get(clave)); }
export async function porContacto(tabla, contacto) { return promesa((await almacen(tabla)).index('contacto').getAll(contacto)); }

export async function guardar(tabla, obj) {
  if (tabla !== 'ajustes') {
    if (!obj.id) { obj.id = id(); obj.creado = obj.creado || ahora(); }
    obj.actualizado = ahora();
  }
  await promesa((await almacen(tabla, 'readwrite')).put(obj));
  avisar(tabla);
  return obj;
}

export async function guardarVarios(tabla, lista) {
  const db = await abrir();
  const tx = db.transaction(tabla, 'readwrite');
  const st = tx.objectStore(tabla);
  for (const obj of lista) {
    if (tabla !== 'ajustes' && !obj.id) { obj.id = id(); obj.creado = obj.creado || ahora(); }
    if (tabla !== 'ajustes') obj.actualizado = obj.actualizado || ahora();
    st.put(obj);
  }
  await new Promise((ok, mal) => { tx.oncomplete = ok; tx.onerror = () => mal(tx.error); });
  avisar(tabla);
}

export async function borrar(tabla, clave) {
  await promesa((await almacen(tabla, 'readwrite')).delete(clave));
  avisar(tabla);
}

export async function vaciar(tabla) {
  await promesa((await almacen(tabla, 'readwrite')).clear());
  avisar(tabla);
}

// Borra un contacto y todo lo que cuelga de él.
export async function borrarContacto(cid) {
  for (const t of ['tratos', 'tareas', 'actividades', 'ventas']) {
    for (const x of await porContacto(t, cid)) await borrar(t, x.id);
  }
  await borrar('contactos', cid);
}

// Ajustes clave → valor
export async function ajuste(clave, porDefecto = null) {
  const fila = await uno('ajustes', clave);
  return fila ? fila.valor : porDefecto;
}
export async function fijar(clave, valor) { return guardar('ajustes', { clave, valor }); }

// Copia de seguridad completa
export async function exportar() {
  const datos = { app: 'crm-hugle', version: 1, fecha: ahora(), tablas: {} };
  for (const t of TABLAS) datos.tablas[t] = await todos(t);
  return datos;
}
export async function importar(datos, { reemplazar = true } = {}) {
  if (!datos || datos.app !== 'crm-hugle' || !datos.tablas) throw new Error('El archivo no es una copia de CRM HUGLE.');
  for (const t of TABLAS) {
    const filas = datos.tablas[t];
    if (!Array.isArray(filas)) continue;
    if (reemplazar) await vaciar(t);
    await guardarVarios(t, filas);
  }
}

// Cambios en vivo (entre pestañas también)
const oyentes = new Set();
const canal = 'BroadcastChannel' in self ? new BroadcastChannel('crm-hugle') : null;
function avisar(tabla) { for (const f of oyentes) f(tabla); canal?.postMessage(tabla); }
canal && (canal.onmessage = (e) => { for (const f of oyentes) f(e.data); });
export function alCambiar(f) { oyentes.add(f); return () => oyentes.delete(f); }
