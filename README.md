<p align="center"><img src="img/icono-512.png" width="96" alt="CRM HUGLE"></p>

<h1 align="center">CRM HUGLE</h1>

<p align="center"><b>El CRM gratuito y de código abierto con IA que funciona dentro de tu dispositivo.</b><br>
Clientes, oportunidades, tareas y resultados en tu portátil o tu móvil. Sin servidores, sin cuentas, sin cuotas.</p>

<p align="center">
<a href="https://hugleluxury.github.io/crm-hugle/"><b>▶ Abrir CRM HUGLE</b></a> ·
<a href="#instalación">Instalación</a> ·
<a href="#hglmini11flash-la-ia-del-crm">IA HGLmini1.1flash</a> ·
<a href="https://oficina-hugle.pages.dev">HUGLE PLATFORM 2.0</a>
</p>

---

CRM HUGLE es una de las tres aplicaciones de **HUGLE PLATFORM 2.0** y la única **gratis y abierta**: cualquier negocio (una clínica, un taller, una tienda online, una academia, un autónomo…) puede usarla sin pagar nada.

- **Tus datos no salen de tu dispositivo.** Todo se guarda en tu navegador (IndexedDB). No hay base de datos en la nube ni registro.
- **IA local incluida: HGLmini1.1flash.** Se descarga una vez (192 MB) y funciona sin conexión, en el propio dispositivo.
- **Funciona en portátil y móvil.** Se instala como una app desde el navegador (Chrome, Edge, Safari), sin tiendas.
- **Sin instalar nada técnico.** Ni Docker, ni bases de datos, ni claves de API.

## Qué incluye

| | |
|---|---|
| **Inicio «Para hoy»** | Tareas vencidas, oportunidades con la fecha de cierre pasada, leads que llevan días sin noticias y clientes en riesgo, por orden de prioridad. |
| **Contactos** | Búsqueda, filtros por segmento, etiquetas, origen, puntuación 0–100 y archivo. **Importar CSV** con vista previa y sin duplicados (por teléfono o email). Exportar a CSV. |
| **Ficha 360°** | Historial (notas, llamadas, mensajes, reuniones), oportunidades, tareas y compras. Llamar, WhatsApp o email con un toque. Resumen y siguiente paso automáticos. |
| **Segmentación automática** | Campeón, leal, cliente nuevo, en riesgo, dormido y lead, calculados con las compras (estilo RFM). |
| **Embudo de ventas (kanban)** | Arrastra las oportunidades entre etapas. Etapas, colores y tipo (abierta / ganada / perdida) configurables. |
| **Agenda y tareas** | Llamadas, mensajes, reuniones y tareas con fecha y hora: vencidas, hoy, mañana, próximos días. |
| **Resultados** | Contactos nuevos, oportunidades ganadas, valor cerrado y tareas completadas frente al periodo anterior (7, 30, 90 días o 1 año), embudo y **origen de las ventas**. |
| **Plantillas** | Mensajes con variables (`{{nombre}}`, `{{negocio}}`, `{{yo}}`, `{{fecha}}`…) que se abren listos en WhatsApp o en el correo. Tú decides si los envías. |
| **HGLmini1.1flash** | Chat con tu CRM, redactar mensajes, clasificar mensajes de clientes y sacar contactos de un texto (ver abajo). |
| **Tu marca** | Nombre del negocio, color y logo. Tema claro y oscuro. |
| **Copias de seguridad** | Descarga y restaura todos tus datos en un archivo. Sirve también para pasar el CRM a otro dispositivo. |
| **Datos de ejemplo** | Pruébalo con un negocio ficticio y bórralo con un clic. |

## Instalación

### Opción 1 · Usarlo ya (recomendado, también en el móvil)

Abre **https://hugleluxury.github.io/crm-hugle/** y, para tenerlo como app:

- **Android / ordenador (Chrome o Edge):** menú del navegador → **Instalar app**.
- **iPhone / iPad (Safari):** Compartir → **Añadir a pantalla de inicio**.

Aunque la abras desde internet, la app y tus datos viven en tu dispositivo y funciona sin conexión.

### Opción 2 · En tu ordenador, sin internet

1. Descarga el código: botón verde **Code → Download ZIP** y descomprímelo.
2. Ten instalado [Node.js](https://nodejs.org) (versión 18 o superior).
3. Haz doble clic en **`Abrir CRM HUGLE.bat`** (Windows) o ejecuta `./abrir-crm.sh` (macOS / Linux).

O desde la terminal:

```bash
node servidor.mjs
```

Se abre en `http://localhost:4800`. Con `node servidor.mjs --red` también lo abres desde el móvil en la misma wifi.

### Opción 3 · Tu propio alojamiento

Es una web estática: sube la carpeta a GitHub Pages, Cloudflare Pages, Netlify o cualquier hosting. El archivo `_headers` ya activa el aislamiento entre orígenes (COOP/COEP) que permite a la IA usar varios hilos; donde no se pueden poner cabeceras, el service worker lo hace solo.

## HGLmini1.1flash, la IA del CRM

HGLmini1.1flash funciona **dentro del navegador** con WebAssembly (y WebGPU si el equipo lo permite). Nada de lo que escribes se envía a ningún servidor.

- **Modelo base:** [MNN-Pocket-0.3B Instruct](https://huggingface.co/taobao-mnn/MNN-Pocket-0.3B-GGUF) (Alibaba / Taobao, Apache-2.0), cuantizado Q4_1: **192 MB**, contexto de 32K.
- **Motor:** [wllama](https://github.com/ngxson/wllama) (llama.cpp en WebAssembly, MIT), incluido en `vendor/`.
- La primera vez se descarga desde Hugging Face y queda guardado en el navegador. Después funciona **sin conexión**.
- También puedes cargar un archivo `.gguf` desde tu equipo o cambiar el origen del modelo en **Ajustes → IA**.

### Qué hace

| Función | Cómo trabaja |
|---|---|
| **Chat con tu CRM** | HGLmini entiende qué preguntas («¿qué hago hoy?», «clientes en riesgo», «cómo va el embudo», «ventas del mes», el nombre de un contacto, tus preguntas frecuentes…) y el CRM responde con **tus datos reales**. |
| **Redactar mensajes** | Seguimiento, cita, agradecimiento, reactivación, oferta o cobro, rellenado con los datos del contacto y tu tono (tú o usted). |
| **Clasificar mensajes** | Pega lo que te escribe un cliente: detecta si quiere comprar, pregunta precio, pide cita, se queja, necesita ayuda o no le interesa; marca la urgencia, propone respuesta (con tu información del negocio) y crea la oportunidad en la etapa adecuada. |
| **Sacar un contacto de un texto** | De una firma de email, un mensaje o una tarjeta saca nombre, teléfono, email, empresa, ciudad e interés. |
| **Resumen y siguiente paso** | En cada ficha, un resumen del cliente y la acción recomendada. |

### Diseño híbrido (y por qué)

Un modelo de 0,3B parámetros es rapidísimo, privado y cabe en un móvil, pero se equivoca a menudo, y MNN-Pocket está entrenado sobre todo en inglés y chino. Por eso cada función combina **reglas en español** (resultado seguro), **el modelo** (enruta preguntas, desempata clasificaciones dudosas, completa extracciones y, si lo pides, escribe borradores) y **validación** de su respuesta: si la IA no devuelve algo fiable, se usa el resultado de las reglas. Así el CRM nunca te da una respuesta inventada sobre tus clientes.

Si cambias el modelo por otro GGUF pequeño con mejor español (Ajustes → IA → origen del modelo), el mismo código aprovecha más la IA automáticamente.

**Requisitos de la IA:** navegador actual (Chrome, Edge, Safari 17+, Firefox) y unos 600 MB de memoria libre. En móviles antiguos puede tardar más.

## Privacidad

- Los datos se guardan solo en el navegador del dispositivo (IndexedDB). Si borras los datos del navegador, se borran: **haz copias de seguridad** desde Ajustes.
- El CRM pide al navegador almacenamiento persistente para que no se borre solo.
- La única conexión externa es la descarga del modelo de IA desde Hugging Face (la primera vez). Puedes evitarla cargando el `.gguf` desde un archivo.
- Sin analítica, sin cookies de seguimiento, sin cuentas.

## Estructura del código

Sin compilación ni dependencias: HTML, CSS y JavaScript moderno (módulos ES).

```
index.html            · estructura y iconos
css/app.css           · estilos (HUGLE Design System 2.0, claro y oscuro)
js/app.js             · arranque, navegación y marca
js/db.js              · almacén local (IndexedDB) y copias de seguridad
js/negocio.js         · etapas, segmentos, puntuación, «para hoy», resultados, datos de ejemplo
js/vistas.js          · inicio, contactos, ficha, embudo, agenda, resultados, plantillas, CSV
js/vistas-ia.js       · pantallas de HGLmini1.1flash y ajustes
js/ia.js              · motor de la IA (wllama) y descarga/caché del modelo
js/herramientas-ia.js · tareas de IA híbridas (enrutador, clasificador, extractor, redacción)
sw.js                 · funcionamiento sin conexión y COOP/COEP
servidor.mjs          · servidor local opcional (Node, sin dependencias)
vendor/wllama/        · wllama 3.8.1 (MIT)
```

## Hoja de ruta

- Conexión opcional con WhatsApp Business, Shopify y email.
- Sincronización cifrada entre dispositivos.
- Recordatorios con notificaciones.
- Modelo HGLmini ajustado en español.

¿Ideas o errores? Abre un *issue*. Las contribuciones son bienvenidas.

## Créditos y licencias

- **CRM HUGLE** · © 2026 HUGLE · [MIT](LICENSE).
- **MNN-Pocket-0.3B** · Alibaba Taobao MNN · Apache-2.0 (se descarga aparte; no se incluye en este repositorio). Ver [NOTICE](NOTICE).
- **wllama** · © Xuan Son Nguyen · MIT (`vendor/wllama/LICENSE`), sobre **llama.cpp** (MIT).
- Algunas ideas de producto (importación de CSV con vista previa, panel de resultados frente al periodo anterior, alertas de leads en silencio, PWA instalable) se inspiran en [Vocero CRM](https://github.com/kevinrivm/vocero-crm) (MIT). No se ha copiado su código.

<p align="center">Hecho por <a href="https://oficina-hugle.pages.dev">HUGLE PLATFORM 2.0</a> · <i>Una infraestructura. Tres productos. Un motor inteligente.</i></p>
