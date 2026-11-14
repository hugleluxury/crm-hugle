// Configuración de la plataforma HUGLE.
// CRM HUGLE es gratis, pero para usarlo hace falta una cuenta HUGLE (se crea gratis en el Control Center).
// La cuenta solo sirve para entrar: tus clientes siguen guardados únicamente en tu dispositivo.
export const PLATAFORMA = {
  api: 'https://hgl-api.hugleluxury.workers.dev',
  panel: 'https://oficina-hugle.pages.dev/cuenta',
  requiereCuenta: true,
  diasSinConexion: 30, // días que el CRM funciona sin internet antes de volver a comprobar la cuenta
};

// Solo en desarrollo (localhost): permite apuntar a una API y un panel locales.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  try {
    PLATAFORMA.api = localStorage.getItem('crm-api') || PLATAFORMA.api;
    PLATAFORMA.panel = localStorage.getItem('crm-panel') || PLATAFORMA.panel;
  } catch {}
}
