// HGL-mini2.0flash · la IA del CRM, ejecutada dentro del navegador (WebAssembly / WebGPU).
// Motor: wllama (llama.cpp en WebAssembly). Modelo: MNN-Pocket-0.3B Instruct (Apache-2.0) destilado en Kaggle con Qwen3.6-35B-A3B, Q4_1.
// El modelo viene DENTRO de la app (carpeta modelo/, en 4 partes): se instala solo la primera vez que se abre
// el CRM, queda guardado en el dispositivo y desde entonces la IA funciona sin ninguna conexión a internet.
// Nada sale del dispositivo.
import { Wllama, ModelManager } from '../vendor/wllama/wllama.js';

export const NOMBRE_IA = 'HGL-mini2.0flash';
export const MODELO_POR_DEFECTO = 'incluido'; // el modelo que trae la app (también se admite una URL .gguf propia)
export const TAMANO_MB = 192;
// HGL-mini2.0flash: MNN-Pocket-0.3B Instruct (Apache-2.0) destilado para las tareas del CRM, Q4_1, mismo tamaño; troceado en partes de 48 MB para alojarlo junto a la app.
const MODELO = {
  version: 'hglmini-1.2-flash',
  partes: [1, 2, 3, 4].map((n) => new URL(`../modelo/hglmini-1.2-flash.parte${n}`, import.meta.url).href),
  bytes: 191896544,
};
const CACHE_MODELO = 'hglmini-modelo-' + MODELO.version;
const esIncluido = (url) => !url || url === MODELO_POR_DEFECTO;

const RUTAS_WASM = { default: new URL('../vendor/wllama/wllama.wasm', import.meta.url).href };
// Navegadores sin JSPI/Memory64 (Safari y algunos móviles) usan el modo compatible, también incluido en la app.
const COMPAT = {
  worker: new URL('../vendor/wllama-compat/wllama.js', import.meta.url).href,
  wasm: new URL('../vendor/wllama-compat/wllama.wasm', import.meta.url).href,
};
const necesitaCompat = () => {
  if (!globalThis.WebAssembly?.Suspending) return true;
  try { new WebAssembly.Memory({ address: 'i64', initial: 1n }); return false; } catch { return true; }
};
const silencioso = { debug() {}, log() {}, warn: console.warn, error: console.error };
function nuevoMotor(extra = {}) {
  const m = new Wllama(RUTAS_WASM, { logger: silencioso, suppressNativeLog: true, ...extra });
  try { m.setCompat(COMPAT); } catch {}
  return m;
}

let motor = null;
let cargando = null;
const estado = { fase: 'apagada', progreso: 0, error: '', hilos: 0, gpu: false, fuente: '' };
const oyentes = new Set();

function cambiar(datos) {
  Object.assign(estado, datos);
  for (const f of oyentes) f({ ...estado });
}
export function alCambiarIA(f) { oyentes.add(f); f({ ...estado }); return () => oyentes.delete(f); }
export function estadoIA() { return { ...estado }; }
export const lista = () => estado.fase === 'lista';

// ¿Está instalada en este dispositivo la IA que trae la app?
export async function instalada() {
  try {
    const c = await caches.open(CACHE_MODELO);
    for (const u of MODELO.partes) if (!(await c.match(u))) return false;
    return true;
  } catch { return false; }
}

// Instala (copia al dispositivo) la IA incluida. Si se corta, continúa por la parte que faltaba.
let instalando = null;
export function instalar() {
  if (instalando) return instalando;
  instalando = (async () => {
    // Borra versiones anteriores de la IA para no ocupar el doble.
    try { for (const k of await caches.keys()) if (k.startsWith('hglmini-modelo-') && k !== CACHE_MODELO) await caches.delete(k); } catch {}
    if (await instalada()) return;
    if (navigator.storage?.persist) await navigator.storage.persist().catch(() => {});
    cambiar({ fase: 'instalando', progreso: 0, error: '' });
    try {
      const c = await caches.open(CACHE_MODELO);
      let hechos = 0;
      for (const u of MODELO.partes) {
        const ya = await c.match(u);
        if (ya) { hechos += (await ya.blob()).size; continue; }
        const r = await fetch(u, { cache: 'no-store' });
        if (!r.ok) throw new Error('instalar: ' + r.status);
        const lector = r.body.getReader();
        const trozos = [];
        let n = 0;
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          trozos.push(value); n += value.length;
          const p = Math.min(99, Math.floor(((hechos + n) / MODELO.bytes) * 100));
          if (p !== estado.progreso) cambiar({ progreso: p });
        }
        const blob = new Blob(trozos);
        await c.put(u, new Response(blob, { headers: { 'content-type': 'application/octet-stream' } }));
        hechos += blob.size;
      }
      if (hechos !== MODELO.bytes) { await caches.delete(CACHE_MODELO); throw new Error('instalar: tamaño'); }
      // El modo compatible solo lo usan algunos navegadores: se guarda también para que funcione sin internet.
      if (necesitaCompat()) await Promise.all([COMPAT.worker, COMPAT.wasm].map((u) => fetch(u).catch(() => {})));
      // Copias descargadas de internet con el CRM 1.0: ya no hacen falta.
      try { await new ModelManager({ logger: silencioso }).clear(); } catch {}
      cambiar({ fase: 'apagada', progreso: 0 });
    } catch (e) {
      cambiar({ fase: 'error', error: explicar(e) });
      throw e;
    }
  })().finally(() => { instalando = null; });
  return instalando;
}

async function modeloInstalado() {
  const c = await caches.open(CACHE_MODELO);
  const partes = [];
  for (const u of MODELO.partes) {
    const r = await c.match(u);
    if (!r) throw new Error('instalar: falta una parte');
    partes.push(await r.blob());
  }
  return new Blob(partes);
}

// ¿El modelo ya está en este dispositivo?
export async function enCache(url = MODELO_POR_DEFECTO) {
  if (esIncluido(url)) return instalada();
  try {
    const modelos = await new ModelManager({ logger: silencioso }).getModels();
    return modelos.some((m) => m.url === url);
  } catch { return false; }
}

const PARAMS = { n_ctx: 4096, n_batch: 512 };

// Carga el modelo (si la IA incluida aún no está instalada, la instala antes).
export function encender(url = MODELO_POR_DEFECTO) {
  if (estado.fase === 'lista') return Promise.resolve();
  if (cargando) return cargando;
  cargando = (async () => {
    try {
      if (esIncluido(url)) {
        await instalar();
        cambiar({ fase: 'cargando', progreso: 100, error: '', fuente: NOMBRE_IA });
        motor = nuevoMotor();
        await motor.loadModel([await modeloInstalado()], PARAMS);
        cambiar({ fase: 'lista', progreso: 100, hilos: motor.getNumThreads?.() || 1, gpu: !!motor.isSupportWebGPU?.() });
        return;
      }
      cambiar({ fase: 'descargando', progreso: 0, error: '', fuente: url });
      motor = nuevoMotor({ allowOffline: true });
      await motor.loadModelFromUrl(url, {
        ...PARAMS,
        useCache: true,
        progressCallback: ({ loaded, total }) => {
          const p = total ? Math.round((loaded / total) * 100) : 0;
          if (p !== estado.progreso) cambiar({ progreso: p });
          if (p >= 100 && estado.fase === 'descargando') cambiar({ fase: 'cargando' });
        },
      });
      cambiar({ fase: 'lista', progreso: 100, hilos: motor.getNumThreads?.() || 1, gpu: !!motor.isSupportWebGPU?.() });
    } catch (e) {
      motor = null;
      cambiar({ fase: 'error', error: explicar(e) });
      throw e;
    } finally { cargando = null; }
  })();
  return cargando;
}

// Cargar un .gguf que el usuario tiene en su equipo (sin internet).
export async function encenderDesdeArchivo(archivo) {
  if (cargando) await cargando.catch(() => {});
  await apagar();
  cambiar({ fase: 'cargando', progreso: 100, error: '', fuente: archivo.name });
  try {
    motor = nuevoMotor();
    await motor.loadModel([archivo], PARAMS);
    cambiar({ fase: 'lista', hilos: motor.getNumThreads?.() || 1, gpu: !!motor.isSupportWebGPU?.() });
  } catch (e) {
    motor = null;
    cambiar({ fase: 'error', error: explicar(e) });
    throw e;
  }
}

export async function apagar() {
  try { await motor?.exit(); } catch {}
  motor = null;
  cambiar({ fase: 'apagada', progreso: 0 });
}

export async function borrarModelo() {
  await apagar();
  try { await caches.delete(CACHE_MODELO); } catch {}
  try { await new ModelManager({ logger: silencioso }).clear(); } catch {}
}

function explicar(e) {
  const m = String(e?.message || e);
  if (/quota/i.test(m)) return `No hay espacio libre suficiente en el dispositivo para la IA (${TAMANO_MB} MB).`;
  if (/instalar/i.test(m)) return 'La IA no terminó de instalarse. Se completará sola la próxima vez que abras el CRM con conexión.';
  if (/fetch|network|Failed to/i.test(m)) return 'No se pudo descargar el modelo. Revisa la conexión e inténtalo de nuevo.';
  if (/memory|OOM|allocate/i.test(m)) return 'El dispositivo se quedó sin memoria. Cierra otras pestañas y vuelve a intentarlo.';
  return m.slice(0, 220);
}

const limpiar = (t) => t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?think>/g, '').replace(/<\|im_(start|end)\|>/g, '').trim();

// Conversación con respuesta en directo. onTexto recibe el texto acumulado.
export async function conversar(mensajes, { onTexto, senal, max = 400, temperatura = 0.3 } = {}) {
  if (!lista()) await encender();
  let texto = '';
  await motor.createChatCompletion({
    messages: mensajes,
    stream: true,
    max_tokens: max,
    temperature: temperatura,
    top_p: 0.8,
    top_k: 20,
    penalty_repeat: 1.1,
    abortSignal: senal,
    chat_template_kwargs: { enable_thinking: false },
    onData: (trozo) => {
      const d = trozo?.choices?.[0]?.delta?.content;
      if (d) { texto += d; onTexto?.(limpiar(texto)); }
    },
  });
  return limpiar(texto);
}

// Pide JSON y lo interpreta con tolerancia (los modelos pequeños a veces añaden texto alrededor).
export async function pedirJSON(sistema, usuario, opciones = {}) {
  const t = await conversar([{ role: 'system', content: sistema }, { role: 'user', content: usuario }], { max: 260, temperatura: 0.1, ...opciones });
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return { _texto: t };
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return { _texto: t }; }
}
