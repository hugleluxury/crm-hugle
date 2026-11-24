// Utilidades de interfaz compartidas.
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Ajustes regionales (se cambian en Ajustes → Negocio)
export const region = { moneda: 'EUR', idioma: 'es-ES' };
export const dinero = (n) => new Intl.NumberFormat(region.idioma, { style: 'currency', currency: region.moneda, maximumFractionDigits: 0 }).format(Number(n) || 0);
export const numero = (n) => new Intl.NumberFormat(region.idioma).format(Number(n) || 0);
export const fecha = (iso, opc = { day: 'numeric', month: 'short' }) => (iso ? new Date(iso).toLocaleDateString(region.idioma, opc) : '—');
export const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString(region.idioma, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
// Fecha local (no UTC): cerca de medianoche, toISOString() daría el día anterior o el siguiente
export const hoyISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);

export function hace(iso) {
  const d = dias(iso);
  if (d === null) return 'nunca';
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  if (d < 365) { const m = Math.round(d / 30); return m === 1 ? 'hace 1 mes' : `hace ${m} meses`; }
  const a = Math.round(d / 365); return a === 1 ? 'hace 1 año' : `hace ${a} años`;
}

const PALETA = ['#4285F4', '#20B8FF', '#9B7BDB', '#28B995', '#E3A64B', '#F16B75', '#5B8DEF', '#3FB6A8'];
export function avatar(nombre = '?', clase = '') {
  const ini = nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';
  let h = 0; for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar ${clase}" style="background:${PALETA[h % PALETA.length]}">${esc(ini)}</span>`;
}

export function icono(nombre) { return `<svg class="i" aria-hidden="true"><use href="#i-${nombre}"/></svg>`; }

let temporizador;
export function aviso(texto) {
  const t = $('#toast');
  t.textContent = texto;
  t.classList.add('ver');
  clearTimeout(temporizador);
  temporizador = setTimeout(() => t.classList.remove('ver'), 2600);
}

// Ventana modal. Devuelve el <dialog>; `alGuardar(form)` se llama al enviar el formulario.
export function modal({ titulo, cuerpo, pie = '', ancho = false, alAbrir, alGuardar }) {
  const d = document.createElement('dialog');
  d.className = 'modal' + (ancho ? ' ancho' : '');
  d.innerHTML = `<form method="dialog" novalidate>
    <div class="modal-cab"><h2>${esc(titulo)}</h2><button type="button" class="btn fant ico" data-cerrar aria-label="Cerrar">${icono('x')}</button></div>
    <div class="modal-cuerpo">${cuerpo}</div>
    ${pie ? `<div class="modal-pie">${pie}</div>` : ''}
  </form>`;
  document.body.append(d);
  const form = d.querySelector('form');
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => d.close()));
  form.addEventListener('submit', async (e) => {
    if (!alGuardar) return;
    e.preventDefault();
    const req = [...form.querySelectorAll('[required]')].find((c) => !c.value.trim());
    if (req) { req.focus(); aviso('Rellena los campos obligatorios.'); return; }
    const r = await alGuardar(form, e.submitter);
    if (r !== false) d.close();
  });
  d.showModal();
  alAbrir?.(d);
  return d;
}

export function confirmar(texto, boton = 'Borrar') {
  return new Promise((ok) => {
    const d = modal({
      titulo: 'Confirmar',
      cuerpo: `<p style="margin:0">${esc(texto)}</p>`,
      pie: `<button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn prim" value="si">${esc(boton)}</button>`,
      alGuardar: () => { ok(true); },
    });
    d.addEventListener('close', () => ok(false));
  });
}

export function datosForm(form) {
  const o = {};
  for (const [k, v] of new FormData(form)) o[k] = typeof v === 'string' ? v.trim() : v;
  return o;
}

export function descargar(nombre, contenido, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function elegirArchivo(accept) {
  return new Promise((ok) => {
    const i = Object.assign(document.createElement('input'), { type: 'file', accept });
    i.onchange = () => ok(i.files[0] || null);
    i.click();
  });
}

// CSV: admite comas o punto y coma, comillas y saltos de línea dentro de comillas.
export function leerCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const primera = texto.split(/\r?\n/)[0] || '';
  const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const filas = []; let fila = []; let celda = ''; let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(celda); celda = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(celda); filas.push(fila); fila = []; celda = '';
    } else celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter((f) => f.some((x) => x.trim()));
}

export function aCSV(filas) {
  return '﻿' + filas.map((f) => f.map((v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\n');
}

export const normTel = (t) => String(t || '').replace(/[^\d+]/g, '').replace(/^00/, '+');
export const normEmail = (e) => String(e || '').trim().toLowerCase();

// Rellena {{variables}} de una plantilla.
export function rellenar(texto, vars) {
  return String(texto || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (vars[k] ?? m));
}

// Conexiones (Ajustes → Conexiones): prefijo de país para WhatsApp y cómo se abre el correo.
export const conexion = { prefijo: '34', correoVia: 'app', firma: '' };

export function enlaceWhatsApp(tel, texto) {
  let n = normTel(tel);
  // Números sin prefijo internacional (p. ej. 612 345 678): se les pone el de tu país.
  if (n && !n.startsWith('+') && n.length <= 10 && conexion.prefijo) n = conexion.prefijo + n.replace(/^0+/, '');
  return `https://wa.me/${n.replace('+', '')}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

// Abre un correo nuevo con la app de correo del dispositivo, Gmail u Outlook (según Conexiones).
export function enlaceCorreo(email, { asunto = '', cuerpo = '' } = {}) {
  const texto = conexion.firma && cuerpo ? `${cuerpo}\n\n${conexion.firma}` : cuerpo;
  const q = (o) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  if (conexion.correoVia === 'gmail') return `https://mail.google.com/mail/?${q({ view: 'cm', fs: '1', to: email, su: asunto, body: texto })}`;
  if (conexion.correoVia === 'outlook') return `https://outlook.office.com/mail/deeplink/compose?${q({ to: email, subject: asunto, body: texto })}`;
  const p = q({ subject: asunto, body: texto });
  return `mailto:${email}${p ? '?' + p : ''}`;
}

// Calendario: archivo .ics (Google Calendar, iPhone/Mac, Outlook) a partir de tareas con fecha.
export function archivoICS(eventos, nombre = 'CRM HUGLE', firma = '') {
  const l = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const filas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HUGLE//CRM HUGLE//ES', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${l(nombre)}`];
  for (const ev of eventos) {
    const dia = ev.fecha.replace(/-/g, '');
    filas.push('BEGIN:VEVENT', `UID:${ev.id}@crm-hugle`, `DTSTAMP:${sello}`);
    if (ev.hora) {
      const [h, m] = ev.hora.split(':');
      const ini = `${dia}T${h.padStart(2, '0')}${(m || '00').padStart(2, '0')}00`;
      const fin = new Date(+ev.fecha.slice(0, 4), +ev.fecha.slice(5, 7) - 1, +ev.fecha.slice(8, 10), +h, +(m || 0) + 30);
      const f2 = `${fin.getFullYear()}${String(fin.getMonth() + 1).padStart(2, '0')}${String(fin.getDate()).padStart(2, '0')}T${String(fin.getHours()).padStart(2, '0')}${String(fin.getMinutes()).padStart(2, '0')}00`;
      filas.push(`DTSTART:${ini}`, `DTEND:${f2}`);
    } else {
      const sig = new Date(+ev.fecha.slice(0, 4), +ev.fecha.slice(5, 7) - 1, +ev.fecha.slice(8, 10) + 1);
      filas.push(`DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${sig.getFullYear()}${String(sig.getMonth() + 1).padStart(2, '0')}${String(sig.getDate()).padStart(2, '0')}`);
    }
    filas.push(`SUMMARY:${l(ev.titulo)}`);
    const desc = [ev.nota, firma].filter(Boolean).join('\n\n');
    if (desc) filas.push(`DESCRIPTION:${l(desc)}`);
    filas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${l(ev.titulo)}`, 'TRIGGER:-PT15M', 'END:VALARM', 'END:VEVENT');
  }
  filas.push('END:VCALENDAR');
  return filas.join('\r\n');
}
