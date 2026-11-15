// Conexiones fáciles (Ajustes → Conexiones): WhatsApp, correo, calendario e importar contactos.
// Sin servidores ni claves: el CRM abre tus propias apps con todo listo y tú decides qué se envía.
import * as db from './db.js';
import { $, esc, icono, aviso, modal, datosForm, descargar, hoyISO, fecha, conexion, enlaceWhatsApp, enlaceCorreo, archivoICS } from './util.js';
import { importarCSV } from './vistas.js';
import { conexionesPlataforma, conectarPlataforma, quitarPlataforma } from './plataforma.js';

const PREFIJOS = [['34', 'España (+34)'], ['351', 'Portugal (+351)'], ['52', 'México (+52)'], ['57', 'Colombia (+57)'], ['54', 'Argentina (+54)'], ['56', 'Chile (+56)'], ['51', 'Perú (+51)'], ['593', 'Ecuador (+593)'], ['58', 'Venezuela (+58)'], ['1', 'EE. UU. (+1)'], ['44', 'Reino Unido (+44)'], ['33', 'Francia (+33)'], ['49', 'Alemania (+49)'], ['39', 'Italia (+39)']];
const VIAS = { app: 'La app de correo del dispositivo', gmail: 'Gmail', outlook: 'Outlook / Hotmail' };

export async function leerConexiones() {
  return { whatsapp: {}, correo: {}, calendario: {}, contactos: {}, ...((await db.ajuste('conexiones')) || {}) };
}

// Pasa la configuración a las utilidades que abren WhatsApp y el correo.
export async function aplicarConexiones() {
  const c = await leerConexiones();
  conexion.prefijo = c.whatsapp.prefijo || '34';
  conexion.correoVia = c.correo.via || 'app';
  conexion.firma = c.correo.firma || '';
}

async function guardar(clave, datos) {
  const c = await leerConexiones();
  c[clave] = { ...c[clave], ...datos };
  await db.fijar('conexiones', c);
  await aplicarConexiones();
}

const pasos = (l) => `<ol class="pasos">${l.map((x) => `<li>${x}</li>`).join('')}</ol>`;

const CONEXIONES = {
  whatsapp: {
    nombre: 'WhatsApp', icono: 'whatsapp',
    resumen: 'Escribe a tus clientes con el mensaje ya preparado y recibe clientes nuevos con tu enlace.',
    estado: (c) => (c.whatsapp.numero ? `Conectado · +${c.whatsapp.prefijo || '34'} ${c.whatsapp.numero}` : ''),
    cuerpo: (c) => `<div class="pila">
      <p class="tenue" style="margin:0">Al pulsar <b>WhatsApp</b> en un contacto, en una plantilla o en un mensaje de tus agentes se abre tu WhatsApp (o WhatsApp Business) con el texto escrito. Tú lo revisas y lo envías. No hace falta API ni pagar nada.</p>
      ${pasos(['Instala <b>WhatsApp Business</b> (recomendado) o WhatsApp en tu móvil. En el ordenador, abre sesión en <b>WhatsApp Web</b>.', 'Escribe aquí tu número y el país: así los teléfonos que guardes sin prefijo (p. ej. 612 345 678) funcionan igual.', 'Copia <b>tu enlace</b> y ponlo en la bio de Instagram, en Google Maps y en tu web: quien lo pulse te escribe directamente. Guárdalo en el CRM con origen «WhatsApp».'])}
      <div class="form"><label class="campo"><span>País</span><select name="prefijo">${PREFIJOS.map(([v, t]) => `<option value="${v}" ${v === (c.whatsapp.prefijo || '34') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo"><span>Tu número de WhatsApp</span><input name="numero" inputmode="tel" value="${esc(c.whatsapp.numero || '')}" placeholder="612 345 678"></label>
      <label class="campo todo"><span>Mensaje con el que te escriben (opcional)</span><input name="saludo" value="${esc(c.whatsapp.saludo || '')}" placeholder="Hola, quiero información"></label></div>
      <div class="fila"><button type="button" class="btn peq" data-copiar-wa>${icono('copiar')}Copiar mi enlace</button><button type="button" class="btn peq" data-probar-wa>${icono('whatsapp')}Probar</button></div></div>`,
    alAbrir: (d) => {
      const enlace = () => { const f = datosForm(d.querySelector('form')); conexion.prefijo = f.prefijo; return f.numero.trim() ? enlaceWhatsApp(f.numero, f.saludo.trim()) : ''; };
      d.querySelector('[data-copiar-wa]').addEventListener('click', async () => { const u = enlace(); if (!u) return aviso('Escribe tu número'); try { await navigator.clipboard.writeText(u); aviso('Enlace copiado: ' + u.split('?')[0]); } catch { aviso(u); } });
      d.querySelector('[data-probar-wa]').addEventListener('click', () => { const u = enlace(); if (!u) return aviso('Escribe tu número'); window.open(u, '_blank', 'noopener'); });
    },
    guardar: (f) => ({ prefijo: f.prefijo, numero: f.numero.trim(), saludo: f.saludo.trim() }),
  },
  correo: {
    nombre: 'Correo', icono: 'mail',
    resumen: 'Los emails a clientes se abren en Gmail, Outlook o tu app de correo, con tu firma.',
    estado: (c) => (c.correo.email ? `Conectado · ${c.correo.email} · ${VIAS[c.correo.via || 'app']}` : ''),
    cuerpo: (c) => `<div class="pila">
      <p class="tenue" style="margin:0">Al pulsar <b>Email</b> en un contacto o enviar una plantilla por correo, se abre un correo nuevo con el destinatario y el texto listos en el programa que elijas. Se envía desde tu propia cuenta, así que las respuestas te llegan a ti.</p>
      ${pasos(['Elige con qué lo abres. <b>Gmail</b> u <b>Outlook</b> se abren en el navegador con tu sesión; «app de correo» usa la que tengas en el móvil u ordenador (Mail, Outlook, Gmail…).', 'Escribe tu correo y, si quieres, una firma: se añade sola al final de cada mensaje.', 'Pulsa <b>Probar</b>: te llega un correo de prueba a ti mismo.'])}
      <div class="form"><label class="campo"><span>Abrir con</span><select name="via">${Object.entries(VIAS).map(([v, t]) => `<option value="${v}" ${v === (c.correo.via || 'app') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="campo"><span>Tu correo</span><input name="email" type="email" value="${esc(c.correo.email || '')}" placeholder="hola@minegocio.com"></label>
      <label class="campo todo"><span>Firma (opcional)</span><textarea name="firma" rows="2" placeholder="Ana · Mi negocio · 612 345 678">${esc(c.correo.firma || '')}</textarea></label></div>
      <div class="fila"><button type="button" class="btn peq" data-probar-mail>${icono('mail')}Probar</button></div></div>`,
    alAbrir: (d) => d.querySelector('[data-probar-mail]').addEventListener('click', () => {
      const f = datosForm(d.querySelector('form'));
      if (!f.email.trim()) return aviso('Escribe tu correo');
      Object.assign(conexion, { correoVia: f.via, firma: f.firma.trim() });
      window.open(enlaceCorreo(f.email.trim(), { asunto: 'Prueba de CRM HUGLE', cuerpo: 'Si ves este correo, la conexión funciona.' }), '_blank', 'noopener');
    }),
    guardar: (f) => ({ via: f.via, email: f.email.trim(), firma: f.firma.trim() }),
  },
  calendario: {
    nombre: 'Calendario', icono: 'agenda',
    resumen: 'Lleva tus tareas y citas a Google Calendar, iPhone o Outlook con aviso 15 min antes.',
    estado: (c) => (c.calendario.ultima ? `Exportado el ${fecha(c.calendario.ultima, { day: 'numeric', month: 'short' })}` : ''),
    cuerpo: (c, ctx) => {
      const n = ctx.datos.tareas.filter((t) => !t.hecha && t.vence && t.vence >= hoyISO()).length;
      return `<div class="pila">
      <p class="tenue" style="margin:0">Descarga un archivo de calendario (.ics) con tus <b>${n}</b> tareas pendientes con fecha y ábrelo en tu calendario. Cada una lleva un aviso 15 minutos antes. Repítelo cuando quieras pasar las nuevas (no se duplican).</p>
      ${pasos(['<b>Google Calendar:</b> en el ordenador, calendar.google.com → ⚙ Configuración → Importar y exportar → elige el archivo → Importar.', '<b>iPhone / Mac:</b> abre el archivo descargado y pulsa «Añadir todo».', '<b>Outlook:</b> Calendario → Añadir calendario → Cargar desde archivo.'])}
      <div class="fila"><button type="button" class="btn peq prim" data-ics ${n ? '' : 'disabled'}>${icono('bajar')}Descargar calendario (.ics)</button></div></div>`;
    },
    alAbrir: (d, ctx) => d.querySelector('[data-ics]').addEventListener('click', async () => {
      const nombres = new Map(ctx.datos.contactos.map((x) => [x.id, x.nombre]));
      const ev = ctx.datos.tareas.filter((t) => !t.hecha && t.vence && t.vence >= hoyISO()).map((t) => ({ id: t.id, fecha: t.vence, hora: t.hora, titulo: t.titulo + (nombres.get(t.contacto) ? ` · ${nombres.get(t.contacto)}` : ''), nota: t.notas || '' }));
      descargar(`crm-hugle-calendario-${hoyISO()}.ics`, archivoICS(ev, (await db.ajuste('negocio')) || 'CRM HUGLE'), 'text/calendar;charset=utf-8');
      await guardar('calendario', { ultima: new Date().toISOString() });
      aviso(`${ev.length} tareas en el archivo de calendario`);
    }),
  },
  contactos: {
    nombre: 'Importar contactos', icono: 'contactos',
    resumen: 'Trae tus clientes de Google, Excel, Shopify, WooCommerce u Outlook sin duplicados.',
    estado: (c) => (c.contactos.ultima ? `Importado el ${fecha(c.contactos.ultima, { day: 'numeric', month: 'short' })}` : ''),
    cuerpo: () => `<div class="pila">
      <p class="tenue" style="margin:0">Exporta tu lista a un archivo <b>CSV</b> desde donde la tengas y súbela aquí. El CRM reconoce solo las columnas (nombre, teléfono, email, empresa…) y no duplica a quien ya tengas.</p>
      ${pasos(['<b>Contactos de Google / Android:</b> contacts.google.com → Exportar → «CSV de Google».', '<b>iPhone:</b> en icloud.com/contacts selecciona todo → Exportar vCard; o pásalos a Google y exporta desde ahí.', '<b>Excel o Google Sheets:</b> Archivo → Guardar como / Descargar → CSV.', '<b>Shopify:</b> Clientes → Exportar → CSV. <b>WooCommerce:</b> Clientes → Descargar. <b>Outlook:</b> Personas → Administrar → Exportar contactos.'])}
      <div class="fila"><button type="button" class="btn peq prim" data-importar>${icono('subir')}Importar CSV</button></div></div>`,
    alAbrir: (d, ctx) => d.querySelector('[data-importar]').addEventListener('click', async () => { d.close(); await guardar('contactos', { ultima: new Date().toISOString() }); importarCSV(ctx); }),
  },
};

// WhatsApp Business automático (por la cuenta HUGLE): estado real en la API
async function estadoWA() {
  try {
    const s = (await conexionesPlataforma()).servicios.find((x) => x.id === 'whatsapp') || null;
    // Guardar solo si cambia: cada escritura repinta la vista y, si no, Ajustes entraba en un bucle sin fin
    if ((await db.ajuste('waConectado', false)) !== !!s?.conectada) await db.fijar('waConectado', !!s?.conectada);
    if (JSON.stringify(await db.ajuste('waEstado', null)) !== JSON.stringify(s)) await db.fijar('waEstado', s);
    return s;
  } catch { return undefined; } // sin respuesta: se queda el último estado conocido
}
function cuerpoWA(s, auto) {
  return `<div class="pila">
    <p class="tenue" style="margin:0">Conecta el número de <b>WhatsApp Business</b> de tu negocio y tus agentes leerán cada mensaje nuevo: Nora crea o encuentra el contacto, entiende qué quiere y prepara la respuesta. Tú la envías con un toque desde la Bandeja, o dejas que responda sola.</p>
    ${pasos(['Pulsa <b>Conectar con Meta</b> y entra con la cuenta de Facebook que administra tu negocio.', 'Elige o registra el número de WhatsApp Business (si ya lo usas en el móvil, Meta te deja seguir usándolo).', 'Vuelve aquí: los mensajes nuevos aparecen en la <b>Bandeja</b> de tus agentes cada minuto con el CRM abierto.'])}
    ${s?.conectada ? `<div class="aviso">Conectado · ${esc(s.perfil || 'WhatsApp Business')}</div>
      <label class="opcion"><input type="checkbox" name="auto" ${auto ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--marca)"> Nora responde sola (las quejas y las bajas siempre esperan tu visto bueno)</label>
      <div class="fila"><button type="button" class="btn peq" data-wa-quitar>Desconectar</button></div>`
      : s && !s.disponible ? '<div class="aviso">La conexión automática de WhatsApp aún no está activada en HUGLE. Muy pronto.</div>'
      : s ? `<div class="fila"><button type="button" class="btn peq prim" data-wa-conectar>${icono('whatsapp')}Conectar con Meta</button></div>`
      : '<div class="aviso">Conéctate a internet para conectar WhatsApp Business.</div>'}</div>`;
}

// Se pinta al momento con el último estado guardado de WhatsApp (sin esperar a la API, que movía la columna
// entera hacia abajo al llegar) y se repinta solo si la respuesta trae algo distinto.
export async function tarjetaConexiones(el, ctx, waFresco) {
  const c = await leerConexiones();
  const m = location.hash.match(/conexion=whatsapp&(ok=1|error=([^&]*))/);
  if (m) { history.replaceState(null, '', location.pathname + location.search); aviso(m[2] ? 'WhatsApp: ' + decodeURIComponent(m[2]) : 'WhatsApp Business conectado'); }
  const wa = waFresco !== undefined ? waFresco : await db.ajuste('waEstado', null);
  if (waFresco === undefined) estadoWA().then((n) => { if (n !== undefined && el.isConnected && JSON.stringify(n) !== JSON.stringify(wa)) tarjetaConexiones(el, ctx, n); });
  CONEXIONES.wabusiness = {
    nombre: 'WhatsApp Business automático', icono: 'whatsapp',
    resumen: 'Tus agentes de IA leen y responden los WhatsApp de tus clientes.',
    estado: () => (wa?.conectada ? `Conectado · ${wa.perfil || 'WhatsApp Business'}` : ''),
    cuerpo: () => cuerpoWA(wa, c.wabusiness?.auto),
    alAbrir: (d) => {
      d.querySelector('[data-wa-conectar]')?.addEventListener('click', async () => { try { const r = await conectarPlataforma('whatsapp'); location.href = r.enlace; } catch (e) { aviso(e.message); } });
      d.querySelector('[data-wa-quitar]')?.addEventListener('click', async () => { try { await quitarPlataforma('whatsapp'); await db.fijar('waConectado', false); aviso('WhatsApp desconectado'); d.close(); } catch (e) { aviso(e.message); } });
    },
    guardar: wa?.conectada ? (f) => ({ auto: !!f.auto }) : undefined,
  };
  el.innerHTML = `<div class="tarjeta"><h2>Conexiones</h2>
    <p class="tenue">Conecta tus herramientas en un minuto. No hay claves ni servidores: el CRM abre tus apps con todo preparado y tú decides qué se envía.</p>
    <ul class="lista" style="margin:0 -18px -18px">${Object.entries(CONEXIONES).map(([k, x]) => {
      const est = x.estado(c);
      return `<li class="clic" data-con="${k}"><span class="con-ico">${icono(x.icono)}</span><div class="crece" style="min-width:0"><div class="tit">${x.nombre} ${est ? '<span class="etiqueta verde">Listo</span>' : ''}</div><div class="sub">${esc(est || x.resumen)}</div></div><span class="btn peq">${est ? 'Cambiar' : 'Conectar'}</span></li>`;
    }).join('')}</ul></div>`;
  el.querySelectorAll('[data-con]').forEach((li) => li.addEventListener('click', () => abrir(li.dataset.con, ctx, () => tarjetaConexiones(el, ctx))));
}

async function abrir(k, ctx, repintar) {
  const x = CONEXIONES[k];
  const c = await leerConexiones();
  modal({
    titulo: x.nombre,
    cuerpo: x.cuerpo(c, ctx),
    pie: x.guardar ? `<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim">Guardar</button>` : `<button type="button" class="btn" data-cerrar>Cerrar</button>`,
    alAbrir: (d) => { x.alAbrir?.(d, ctx); d.addEventListener('close', () => { aplicarConexiones(); repintar(); }); },
    alGuardar: x.guardar ? async (form) => { const v = x.guardar(datosForm(form)); await guardar(k, v); if (k === 'wabusiness') await db.fijar('waAuto', !!v.auto); aviso(`${x.nombre}: guardado`); } : undefined,
  });
}
