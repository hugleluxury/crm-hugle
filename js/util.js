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
export const hoyISO = () => new Date().toISOString().slice(0, 10);
export const dias = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null);

export function hace(iso) {
  const d = dias(iso);
  if (d === null) return 'nunca';
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  if (d < 365) return `hace ${Math.round(d / 30)} meses`;
  return `hace ${Math.round(d / 365)} años`;
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

export function enlaceWhatsApp(tel, texto) {
  const n = normTel(tel).replace('+', '');
  return `https://wa.me/${n}?text=${encodeURIComponent(texto || '')}`;
}
