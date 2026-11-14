// HGLmini1.1flash · la IA del CRM, ejecutada dentro del navegador (WebAssembly / WebGPU).
// Motor: wllama (llama.cpp en WebAssembly). Modelo base: MNN-Pocket-0.3B Instruct Q4_1 (Apache-2.0).
// Nada sale del dispositivo: el modelo se descarga una vez, queda en la caché del navegador y responde sin conexión.
import { Wllama, ModelManager } from '../vendor/wllama/wllama.js';

export const NOMBRE_IA = 'HGLmini1.1flash';
export const MODELO_POR_DEFECTO = 'https://huggingface.co/taobao-mnn/MNN-Pocket-0.3B-GGUF/resolve/main/MNN-Pocket-0.3B-Instruct-Q4_1.gguf';
export const TAMANO_MB = 192;

const RUTAS_WASM = { default: new URL('../vendor/wllama/wllama.wasm', import.meta.url).href };
const silencioso = { debug() {}, log() {}, warn: console.warn, error: console.error };

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

// ¿El modelo ya está en la caché del navegador?
export async function enCache(url = MODELO_POR_DEFECTO) {
  try {
    const modelos = await new ModelManager({ logger: silencioso }).getModels();
    return modelos.some((m) => m.url === url);
  } catch { return false; }
}

const PARAMS = { n_ctx: 4096, n_batch: 512 };

// Descarga (la primera vez) y carga el modelo.
export function encender(url = MODELO_POR_DEFECTO) {
  if (estado.fase === 'lista') return Promise.resolve();
  if (cargando) return cargando;
  cargando = (async () => {
    try {
      cambiar({ fase: 'descargando', progreso: 0, error: '', fuente: url });
      motor = new Wllama(RUTAS_WASM, { logger: silencioso, allowOffline: true, suppressNativeLog: true });
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
    motor = new Wllama(RUTAS_WASM, { logger: silencioso, suppressNativeLog: true });
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
  try { await new ModelManager({ logger: silencioso }).clear(); } catch {}
}

function explicar(e) {
  const m = String(e?.message || e);
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
