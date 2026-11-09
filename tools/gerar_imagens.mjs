// Gera os ícones PNG e a imagem de compartilhamento (og.png) a partir de HTML/SVG locais.
// Uso: node tools/gerar_imagens.mjs   (precisa do Playwright com Chromium)
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const navegador = await chromium.launch();
const TIPOS = { '.css': 'text/css', '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8' };
const servidor = createServer(async (req, res) => {
  const arquivo = join(RAIZ, normalize(new URL(req.url, 'http://x').pathname).replace(/^(\.\.[/\\])+/, ''));
  try { res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] || 'text/html' }); res.end(await readFile(arquivo)); } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/`;

const svg = await readFile(join(RAIZ, 'assets/img/icone.svg'), 'utf8');
for (const tam of [192, 512]) {
  const p = await navegador.newPage({ viewport: { width: tam, height: tam } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${tam}" height="${tam}" `)}</body></html>`);
  await p.screenshot({ path: join(RAIZ, `assets/img/icone-${tam}.png`), omitBackground: true });
  await p.close();
}

const bolha = (l, estado) => `<span class="b ${estado}">${l}</span>`;
const linha = (n, marcada, correta) => `<div class="l"><span class="n">${n}</span>${'ABCDE'.split('').map((l) => bolha(l, l === marcada ? (marcada === correta ? 'cheia certo' : 'cheia errado') : l === correta ? 'anel' : '')).join('')}</div>`;
const p = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(`${BASE}index.html`);
await p.setContent(`<!doctype html><html lang="pt-BR" data-tema="claro"><head><link rel="stylesheet" href="assets/css/app.css">
<style>
  body { margin: 0; width: 1200px; height: 630px; background: #f4f5f7; display: block; overflow: hidden; }
  .topo-og { height: 16px; display: grid; grid-template-columns: repeat(4, 1fr); }
  .topo-og i:nth-child(1) { background: #2f6fd6 } .topo-og i:nth-child(2) { background: #f2c230 } .topo-og i:nth-child(3) { background: #e2e3de } .topo-og i:nth-child(4) { background: #17834a }
  .og { display: grid; grid-template-columns: 1fr 420px; gap: 56px; padding: 0 72px; height: 614px; align-items: center; }
  h1 { font-size: 84px !important; }
  h1 { font-size: 76px; letter-spacing: -0.035em; line-height: 1; }
  p { font-size: 28px; color: #434a55; margin-top: 26px; line-height: 1.35; }
  .selo { display: inline-block; margin-top: 30px; font: 700 22px var(--mono); padding: 8px 16px; border-radius: 999px; background: #14171c; color: #fff; }
  .cartao-og { background: #fff; border: 1px solid #d5d9e0; border-radius: 22px; padding: 26px 26px 18px; box-shadow: 0 16px 40px rgb(20 23 28 / 0.14); transform: rotate(-2deg); }
  .l { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
  .n { width: 40px; text-align: right; font: 700 22px var(--mono); color: #434a55; }
  .b { position: relative; width: 52px; height: 52px; border-radius: 50%; border: 2.5px solid #14171c; display: grid; place-items: center; font: 700 22px var(--mono); color: #14171c; }
  .b.cheia { background: #14171c; color: #fff; }
  .b.anel { box-shadow: 0 0 0 4px #fff, 0 0 0 7px #14773a; }
  .b.certo::after, .b.errado::after { position: absolute; inset: -8px; content: ''; background-repeat: no-repeat; background-size: contain; }
  .b.certo::after { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M14 34 L27 47 L52 16' fill='none' stroke='%2314773a' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); }
  .b.errado::after { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M16 16 L48 48 M48 16 L16 48' fill='none' stroke='%23bf2626' stroke-width='7' stroke-linecap='round'/%3E%3C/svg%3E"); }
</style></head><body>
<div class="topo-og"><i></i><i></i><i></i><i></i></div>
<div class="og"><div><h1>Gabarito ENEM 2026</h1><p>Corrija sua prova com o consenso de 7 correções, veja as questões em disputa e estime sua nota pela TRI.</p><span class="selo">1º dia já disponível</span></div>
<div class="cartao-og">${linha(31, 'C', 'C')}${linha(32, 'A', 'D')}${linha(33, 'E', 'E')}${linha(34, 'B', 'B')}${linha(35, 'D', 'D')}</div></div>
</body></html>`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: join(RAIZ, 'assets/img/og.png') });
const fontes = await p.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
await navegador.close();
servidor.close();
console.log('imagens geradas; fontes carregadas:', [...new Set(fontes)].join(', '));
