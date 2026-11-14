#!/usr/bin/env node
// CRM HUGLE · servidor local sin dependencias. Solo sirve los archivos de la app:
// los datos viven en el navegador y la IA se ejecuta en el propio dispositivo.
//   node servidor.mjs          → http://localhost:4800 (solo este equipo)
//   node servidor.mjs --red    → también accesible desde el móvil en la misma wifi
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { exec } from 'node:child_process';

const RAIZ = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const RED = args.includes('--red');
const PUERTO = Number(args.find((a) => /^\d+$/.test(a)) || process.env.PORT || 4800);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.gguf': 'application/octet-stream', '.md': 'text/plain; charset=utf-8',
};
const PRIVADO = /(^|\/)(\.git|node_modules|servidor\.mjs)/;

const servidor = http.createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ) || PRIVADO.test(ruta)) { res.writeHead(403).end(); return; }
    const info = await stat(archivo).catch(() => null);
    if (!info?.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('No encontrado'); return; }
    res.writeHead(200, {
      'content-type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      // Aislamiento entre orígenes: permite a la IA usar varios hilos.
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
    });
    res.end(await readFile(archivo));
  } catch (e) {
    res.writeHead(500).end(String(e.message));
  }
});

servidor.listen(PUERTO, RED ? '0.0.0.0' : '127.0.0.1', () => {
  const local = `http://localhost:${PUERTO}`;
  console.log(`\n  CRM HUGLE en marcha → ${local}`);
  if (RED) {
    for (const lista of Object.values(networkInterfaces())) for (const n of lista || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`  Desde el móvil (misma wifi) → http://${n.address}:${PUERTO}`);
    }
    console.log('  Nota: en el móvil, para instalarlo como app y usar la IA, es mejor abrir la versión publicada con https.');
  }
  console.log('  Para cerrarlo, pulsa Ctrl+C.\n');
  if (!args.includes('--sin-abrir')) {
    const abrir = process.platform === 'win32' ? `start "" "${local}"` : process.platform === 'darwin' ? `open "${local}"` : `xdg-open "${local}"`;
    exec(abrir, () => {});
  }
});
servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') console.log(`El puerto ${PUERTO} está ocupado. ¿Ya está abierto el CRM? Prueba: node servidor.mjs ${PUERTO + 1}`);
  else console.error(e);
  process.exit(1);
});
