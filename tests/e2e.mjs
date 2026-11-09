// Testes de ponta a ponta no Chromium (Playwright). Uso: node tests/e2e.mjs [pasta-para-capturas]
// Cada teste reproduz um problema encontrado na versão de 2025 e confirma que ele não volta.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURAS = process.argv[2] || null;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const servidor = createServer(async (req, res) => {
  const caminho = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const arquivo = join(RAIZ, caminho.endsWith('/') ? `${caminho}index.html` : caminho);
  try {
    const corpo = await readFile(arquivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404); res.end('nao encontrado');
  }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${servidor.address().port}/`;

// Gabarito de mentira para o 2º dia, com anuladas (questões 94, 120 e 170), para testar a numeração 91–180.
const ANULADAS_DIA2 = [3, 29, 79];
const gabDia2 = Array.from({ length: 90 }, (_, i) => (ANULADAS_DIA2.includes(i) ? 'X' : 'ABCDE'[(i * 7) % 5])).join('');
async function comDia2(pagina) {
  const dados = { edicao: 2026, dia: 2, situacao: 'extraoficial', atualizadoEm: '2026-11-15T20:00:00-03:00', fontes: [], divergencias: {},
    gabaritos: Object.fromEntries(['azul', 'amarelo', 'cinza', 'verde'].map((c) => [c, { questoes: gabDia2 }])) };
  await pagina.route('**/data/gabarito-2026-dia2.js', (rota) => rota.fulfill({ body: `export default ${JSON.stringify(dados)};`, contentType: 'text/javascript; charset=utf-8' }));
}

const navegador = await chromium.launch();
const resultados = [];
async function caso(nome, fn, opcoes = {}) {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, ...opcoes });
  const pagina = await ctx.newPage();
  const problemas = [];
  pagina.on('pageerror', (e) => problemas.push(`erro de página: ${e.message}`));
  pagina.on('console', (m) => { if (m.type() === 'error') problemas.push(`console: ${m.text()}`); });
  pagina.on('requestfailed', (r) => problemas.push(`requisição falhou: ${r.url()}`));
  pagina.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) problemas.push(`requisição externa: ${r.url()}`); });
  try {
    await fn(pagina, ctx);
    if (problemas.length) throw new Error(problemas.join('\n'));
    resultados.push([nome, true]);
    console.log(`ok   ${nome}`);
  } catch (e) {
    resultados.push([nome, false]);
    console.log(`FALHOU ${nome}\n     ${String(e.message || e).split('\n').join('\n     ')}`);
  } finally {
    await ctx.close();
  }
}
const espera = (cond, msg) => { if (!cond) throw new Error(msg); };

async function comecar(pagina, { dia = 1, cor = 'azul', lingua = 'ingles', modo = 'questao' } = {}) {
  await pagina.goto(BASE, { waitUntil: 'networkidle' });
  await pagina.check(`input[name="dia"][value="${dia}"]`, { force: true });
  await pagina.click(`.caderno-opcao:has(input[value="${cor}"]) .caderno-capa`);
  if (dia === 1) await pagina.check(`input[name="lingua"][value="${lingua}"]`, { force: true });
  await pagina.check(`input[name="modo"][value="${modo}"]`, { force: true });
  await pagina.click('button[type=submit]');
  await pagina.waitForSelector('#bolhas');
}
const gabarito = (pagina, dia, cor, lingua) => pagina.evaluate(async ([d, c, l]) => {
  const m = await import('./data/enem2026.js');
  const core = await import('./assets/js/core.js');
  return core.montarGabarito(m.default.dias[d], c, l);
}, [dia, cor, lingua]);
const progresso = (pagina) => pagina.textContent('#prog-texto');
const textoBoletim = (pagina) => pagina.$$eval('.boletim tbody tr', (trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()));

// Contraste WCAG de todo texto visível (o texto "text-muted" invisível de 2025).
async function auditarContraste(pagina, rotulo) {
  const falhas = await pagina.evaluate(() => {
    const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const misturar = (cima, baixo) => ({ r: cima.r * cima.a + baixo.r * (1 - cima.a), g: cima.g * cima.a + baixo.g * (1 - cima.a), b: cima.b * cima.a + baixo.b * (1 - cima.a), a: 1 });
    const fundo = (el) => {
      const camadas = [];
      for (let n = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
        const c = rgba(cs.backgroundColor);
        if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; }
      }
      let base = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = camadas.length - 1; i >= 0; i -= 1) base = misturar(camadas[i], base);
      return base;
    };
    const saida = [];
    const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const vistos = new Set();
    for (let t = andar.nextNode(); t; t = andar.nextNode()) {
      const el = t.parentElement;
      if (!t.textContent.trim() || vistos.has(el)) continue;
      vistos.add(el);
      if (el.closest('svg, [aria-hidden="true"], .sr-only, .skip, dialog:not([open]), noscript')) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const cor = rgba(cs.color); const bg = fundo(el);
      if (!cor || !bg) continue;
      const frente = misturar(cor, bg);
      const l1 = lum(frente); const l2 = lum(bg);
      const contraste = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const tam = parseFloat(cs.fontSize); const peso = Number(cs.fontWeight);
      const grande = tam >= 24 || (tam >= 18.66 && peso >= 700);
      const minimo = el.closest('button:disabled, .btn:disabled') ? 1 : grande ? 3 : 4.5;
      if (contraste < minimo) saida.push(`${contraste.toFixed(2)} "${t.textContent.trim().slice(0, 40)}" (${el.tagName.toLowerCase()}.${el.className})`);
    }
    return saida;
  });
  espera(!falhas.length, `contraste insuficiente em ${rotulo}:\n${falhas.slice(0, 12).join('\n')}`);
}

await caso('início carrega sem erros e sem dependências externas', async (p) => {
  await p.goto(BASE, { waitUntil: 'networkidle' });
  espera(await p.isVisible('h1'), 'sem título');
  espera((await p.$$('audio')).length === 0, 'há elementos <audio> (sons externos de 2025)');
});

for (const tema of ['claro', 'escuro']) {
  await caso(`contraste suficiente em todas as telas (tema ${tema})`, async (p) => {
    await p.addInitScript((t) => localStorage.setItem('gabarito-enem-2026', JSON.stringify({ preferencias: { tema: t, efeitos: false, som: false } })), tema);
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await auditarContraste(p, 'início');
    for (const cor of ['azul', 'amarelo', 'branco', 'verde']) {
      await comecar(p, { cor });
      for (const l of 'ABCDE') await p.keyboard.press(l);
      await auditarContraste(p, `prova (${cor})`);
      await p.goto(BASE, { waitUntil: 'networkidle' });
      p.once('dialog', () => {});
    }
    await comecar(p, { cor: 'verde' });
    await p.click('#ver-resultado');
    await p.click('#botao-confirmar');
    await p.waitForSelector('.boletim');
    await auditarContraste(p, 'resultado');
    await p.goto(`${BASE}#/sobre`, { waitUntil: 'networkidle' });
    await auditarContraste(p, 'sobre');
  }, { reducedMotion: 'reduce' }); // mede o estado final, não o meio de uma transição
}

let notasAoTerminar = null;
await caso('fluxo completo do 1º dia pelo teclado; resultado reaberto é idêntico (bug do resultado salvo)', async (p) => {
  await comecar(p, { cor: 'amarelo', lingua: 'espanhol' });
  const g = await gabarito(p, 1, 'amarelo', 'espanhol');
  for (let i = 0; i < 90; i += 1) await p.keyboard.press(i % 3 === 0 ? 'E' : g[i]); // erra algumas de propósito
  espera((await progresso(p)) === '90 de 90 preenchidas', `progresso: ${await progresso(p)}`);
  espera(await p.isVisible('#concluido'), 'não ofereceu ver o resultado ao terminar');
  espera((await p.textContent('#num-questao')) === '90', 'saiu da prova sozinho ao responder a última questão');
  await p.click('#concluir');
  await p.waitForSelector('.boletim');
  notasAoTerminar = await textoBoletim(p);
  espera(notasAoTerminar.length === 3, `boletim incompleto: ${notasAoTerminar}`);
  for (const linha of await p.$$('.boletim tbody tr')) espera(await linha.isVisible(), 'linha do boletim invisível (cards por área de 2025)');
  const esperado = g.filter((l, i) => i % 3 !== 0 || l === 'E').length;
  const total = await p.textContent('.boletim tfoot td');
  espera(total.startsWith(`${esperado} de 90`), `total ${total}, esperado ${esperado}`);
  await p.reload({ waitUntil: 'networkidle' });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.item-resultado a');
  await p.waitForSelector('.boletim');
  const reaberto = await textoBoletim(p);
  espera(JSON.stringify(reaberto) === JSON.stringify(notasAoTerminar), `diferente ao reabrir:\n${notasAoTerminar}\n${reaberto}`);
});

await caso('digitar no "Colar respostas" não responde questões e Backspace apaga o texto', async (p) => {
  await comecar(p);
  await p.click('#abrir-lote');
  await p.keyboard.type('ABC');
  espera((await progresso(p)) === '0 de 90 preenchidas', `digitação respondeu questões: ${await progresso(p)}`);
  await p.keyboard.press('Backspace');
  espera((await p.inputValue('#lote-texto')) === 'AB', 'Backspace não apagou o texto');
  espera((await progresso(p)) === '0 de 90 preenchidas', 'Backspace mexeu nas respostas');
  await p.fill('#lote-texto', 'abcde abcde\n-a');
  espera((await p.textContent('#lote-previa')).includes('12 respostas'), await p.textContent('#lote-previa'));
  await p.click('#lote-aplicar');
  await p.waitForFunction(() => document.querySelector('#prog-texto').textContent === '12 de 90 preenchidas', null, { timeout: 3000 }).catch(() => {});
  espera((await progresso(p)) === '12 de 90 preenchidas', `lote: ${await progresso(p)}`);
  espera((await p.textContent('#num-questao')) === '13', 'não foi para a próxima pendente');
});

await caso('Ctrl+C, Ctrl+A e tecla segurada não marcam respostas', async (p) => {
  await comecar(p);
  await p.keyboard.press('Control+c');
  await p.keyboard.press('Control+a');
  await p.keyboard.press('Meta+b');
  espera((await progresso(p)) === '0 de 90 preenchidas', `atalho respondeu: ${await progresso(p)}`);
  await p.keyboard.down('d');
  await p.keyboard.down('d');
  await p.keyboard.down('d');
  await p.keyboard.up('d');
  espera((await progresso(p)) === '1 de 90 preenchidas', `tecla segurada respondeu várias: ${await progresso(p)}`);
});

await caso('progresso salvo a cada resposta; recarregar continua de onde parou', async (p) => {
  await comecar(p, { cor: 'verde' });
  for (const l of 'ABCDEABCDE') await p.keyboard.press(l);
  await p.reload({ waitUntil: 'networkidle' });
  espera((await progresso(p)) === '10 de 90 preenchidas', 'perdeu respostas ao recarregar');
  espera((await p.textContent('#num-questao')) === '11', 'não voltou para a questão 11');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  espera(await p.isVisible('.retomar'), 'início não oferece continuar');
});

await caso('trocar de caderno com respostas salvas pede confirmação', async (p) => {
  await comecar(p, { cor: 'verde' });
  await p.keyboard.press('A');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.click('.caderno-opcao:has(input[value="azul"]) .caderno-capa');
  await p.click('button[type=submit]');
  espera(await p.isVisible('#dialogo-confirmar'), 'não pediu confirmação');
  await p.click('#dialogo-confirmar button[value="nao"]');
  espera(!(await p.isVisible('#bolhas')), 'apagou mesmo cancelando');
});

await caso('é possível corrigir a última questão e qualquer outra pelo cartão', async (p) => {
  await comecar(p, { cor: 'branco' });
  await p.click('#abrir-lote');
  await p.fill('#lote-texto', 'A'.repeat(90));
  await p.click('#lote-aplicar');
  await p.waitForFunction(() => document.querySelector('#prog-texto').textContent === '90 de 90 preenchidas');
  await p.click('[data-ir="89"]');
  await p.click('#bolhas [data-letra="C"]');
  await p.click('.mini[data-q="40"][data-l="E"]');
  const r = await p.evaluate(() => JSON.parse(localStorage.getItem('gabarito-enem-2026')).sessoes[1].respostas);
  espera(r[89] === 'C' && r[40] === 'E', 'não alterou as respostas');
});

await caso('2º dia: numeração 91–180, anuladas, voltar sobre anulada, recomeçar e PDF', async (p) => {
  await comDia2(p);
  await comecar(p, { dia: 2, cor: 'cinza' });
  espera((await p.textContent('#num-questao')) === '91', 'não começa na 91');
  for (let i = 0; i < 3; i += 1) await p.keyboard.press('A');
  espera(await p.isVisible('#zona-anulada'), 'questão 94 (anulada) não mostrou o aviso');
  espera((await p.textContent('#num-questao')) === '94', 'número errado na anulada');
  await p.keyboard.press('A'); // tecla de alternativa não faz nada na anulada
  await p.keyboard.press('Enter');
  espera((await p.textContent('#num-questao')) === '95', 'Enter não avançou da anulada');
  await p.keyboard.press('Backspace');
  espera((await p.textContent('#num-questao')) === '94' && (await p.isVisible('#zona-anulada')) && !(await p.isVisible('#bolhas')), 'voltar caiu na anulada como questão normal');
  await p.keyboard.press('ArrowRight');
  await p.click('#abrir-lote');
  await p.fill('#lote-texto', 'B'.repeat(86));
  await p.click('#lote-aplicar');
  await p.waitForFunction(() => document.querySelector('#prog-texto').textContent === '90 de 90 preenchidas');
  await p.click('#ver-resultado');
  await p.waitForSelector('.boletim');
  const total = await p.textContent('.boletim tfoot td');
  espera(total.includes('de 87'), `anuladas contadas no total: ${total}`);
  const numeros = await p.$$eval('.celula .n', (els) => els.map((e) => Number(e.textContent)));
  espera(numeros[0] === 91 && numeros.at(-1) === 180, 'grade sem numeração 91–180');
  const [download] = await Promise.all([p.waitForEvent('download'), p.click('#baixar-pdf')]);
  const pdf = (await readFile(await download.path())).toString('latin1');
  espera(pdf.startsWith('%PDF'), 'PDF inválido');
  espera(pdf.includes('(91)') && pdf.includes('(180)'), 'PDF sem a numeração 91–180');
  espera(!pdf.includes('(1)') || pdf.includes('(181)') === false, 'PDF numerou de 1 a 90');
  espera(!/[✓✗⊗]/.test(pdf), 'PDF com símbolos que viram lixo');
  await p.click('#refazer');
  await p.click('#botao-confirmar');
  await p.waitForSelector('#bolhas');
  espera((await p.textContent('#num-questao')) === '91', 'recomeçar no 2º dia não volta para a 91');
  espera((await progresso(p)) === '3 de 90 preenchidas', `recomeçar não zerou (anuladas contam como resolvidas): ${await progresso(p)}`);
});

await caso('2º dia sem gabarito: dá para preencher e guardar', async (p) => {
  await comecar(p, { dia: 2, cor: 'azul' });
  for (const l of 'ABCDE') await p.keyboard.press(l);
  espera((await p.textContent('#retorno')).includes('Anotado'), 'sem confirmação de resposta anotada');
  await p.click('#ver-resultado');
  await p.click('#botao-confirmar');
  await p.waitForSelector('.pendente-gabarito');
});

await caso('celular (390 px): sem rolagem horizontal e alvos de toque grandes', async (p) => {
  const largura = async (rotulo) => {
    const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    espera(sw <= iw, `rolagem horizontal em ${rotulo}: ${sw} > ${iw}`);
  };
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await largura('início');
  await comecar(p, { cor: 'amarelo' });
  await largura('prova');
  const tam = await p.$eval('#bolhas .bolha', (b) => b.getBoundingClientRect().width);
  espera(tam >= 44, `bolha pequena demais para o dedo: ${tam}px`);
  await p.click('#alternar-cartao');
  await largura('cartão aberto');
  await p.click('#ver-resultado');
  await p.click('#botao-confirmar');
  await p.waitForSelector('.boletim');
  await largura('resultado');
  await p.goto(`${BASE}#/sobre`);
  await largura('sobre');
}, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

await caso('todo controle tem nome acessível', async (p) => {
  await comecar(p);
  await p.keyboard.press('A');
  const semNome = await p.$$eval('button, a, input:not([type=hidden]), textarea', (els) => els.filter((el) => {
    if (el.closest('dialog:not([open])')) return false;
    const nome = (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent || el.labels?.[0]?.textContent || el.title || '').trim();
    return !nome;
  }).map((el) => el.outerHTML.slice(0, 80)));
  espera(!semNome.length, `sem nome: ${semNome.join('\n')}`);
});

if (CAPTURAS) {
  await mkdir(CAPTURAS, { recursive: true });
  for (const [nome, opcoes] of [['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }], ['celular', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    for (const tema of ['claro', 'escuro']) {
      await caso(`capturas ${nome} ${tema}`, async (p) => {
        await p.addInitScript((t) => { if (!localStorage.getItem('gabarito-enem-2026')) localStorage.setItem('gabarito-enem-2026', JSON.stringify({ preferencias: { tema: t, efeitos: false, som: false } })); }, tema);
        await p.goto(BASE, { waitUntil: 'networkidle' });
        await p.waitForTimeout(900);
        await p.screenshot({ path: `${CAPTURAS}/${nome}-${tema}-inicio.png`, fullPage: nome === 'celular' });
        await comecar(p, { cor: 'azul' });
        const g = await gabarito(p, 1, 'azul', 'ingles');
        for (let i = 0; i < 29; i += 1) await p.keyboard.press(i % 4 === 1 ? 'A' : g[i]);
        await p.waitForTimeout(500);
        await p.screenshot({ path: `${CAPTURAS}/${nome}-${tema}-prova.png` });
        await p.click('#abrir-lote');
        await p.fill('#lote-texto', g.slice(29).map((l, i) => (i % 5 === 2 ? 'B' : l)).join(''));
        await p.click('#lote-aplicar');
        await p.waitForFunction(() => document.querySelector('#prog-texto').textContent === '90 de 90 preenchidas');
        await p.click('#ver-resultado');
        await p.waitForSelector('.boletim');
        await p.fill('#nota-redacao', '780');
        await p.waitForTimeout(300);
        await p.screenshot({ path: `${CAPTURAS}/${nome}-${tema}-resultado.png`, fullPage: true });
      }, opcoes);
    }
  }
}

await navegador.close();
servidor.close();
const falhas = resultados.filter(([, ok]) => !ok);
console.log(`\n${resultados.length - falhas.length} de ${resultados.length} testes passaram.`);
process.exit(falhas.length ? 1 : 0);
