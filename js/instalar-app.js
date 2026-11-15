// Instalar CRM HUGLE en el dispositivo (15-11-2026, Eduardo: botón «Descargar» en la tarjeta del Control Center).
// El Control Center abre el CRM con #acceso=…&instalar=1; aquí se guarda la petición antes de que se limpie el hash
// y, ya dentro, se ofrece instalarla (Chrome, Edge, Android) o se explica cómo hacerlo (iPhone, Safari, Firefox).
const pedida = /(^|[#&])instalar=1/.test(location.hash);
let aviso = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; });

const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function panel(html, conBoton) {
  document.getElementById('hg-instalar')?.remove();
  const d = document.createElement('div');
  d.id = 'hg-instalar';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-label', 'Instalar CRM HUGLE');
  d.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:440px;margin:0 auto;padding:18px;border-radius:16px;background:var(--sup-2,#17243A);color:var(--texto,#F5F7FA);border:1px solid var(--borde-f,rgba(170,181,197,.3));box-shadow:0 18px 50px rgba(0,0,0,.45);font-size:15px;line-height:1.45;font-family:inherit';
  d.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start"><img src="img/icono-180.png" alt="" width="44" height="44" style="border-radius:11px;flex:none">
    <div style="flex:1"><b style="font-size:16px">Instala CRM HUGLE</b><div style="color:var(--texto-2,#AAB5C5);margin-top:4px">${html}</div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${conBoton ? '<button type="button" class="btn peq prim" data-si>Instalar</button>' : ''}<button type="button" class="btn peq" data-no>${conBoton ? 'Ahora no' : 'Entendido'}</button></div></div></div>`;
  d.querySelector('[data-no]').onclick = () => d.remove();
  d.querySelector('[data-si]')?.addEventListener('click', async () => {
    const e = aviso; aviso = null;
    if (!e) return d.remove();
    e.prompt();
    const r = await e.userChoice.catch(() => null);
    d.remove();
    if (r?.outcome === 'accepted') panel('Listo: la tienes en tu escritorio o pantalla de inicio. Funciona también sin internet.', false);
  });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') d.remove(); });
  document.body.append(d);
  (d.querySelector('[data-si]') || d.querySelector('[data-no]')).focus();
}

export function ofrecerInstalar() {
  if (!pedida) return;
  if (instalada()) return panel('Ya está instalada en este dispositivo. Ábrela desde tu escritorio o pantalla de inicio.', false);
  const mostrar = () => {
    if (aviso) return panel('Tenla como una app más, con su icono y a pantalla completa. Tus datos se quedan en este dispositivo.', true);
    if (ios()) return panel('En Safari pulsa <b>Compartir</b> <span aria-hidden="true">⬆︎</span> y después <b>Añadir a pantalla de inicio</b>.', false);
    panel('Abre el menú del navegador (⋮) y elige <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>. En Firefox de escritorio, ábrelo con Chrome o Edge para instalarlo.', false);
  };
  // El navegador avisa de que se puede instalar poco después de cargar
  if (aviso) mostrar(); else setTimeout(mostrar, 1500);
}
