import edicao, { CORES } from '../../data/enem2026.js';
import tabelaTri from '../../data/tri.js';
import {
  ANULADA, BRANCO, LETRAS, TOTAL_QUESTOES,
  corrigir, estimarNota, formatarNota, formatarPercentual, ganhoPossivelNasDisputas, interpretarLote,
  media, montarGabarito, numeroQuestao, indiceDaQuestao, proximaPendente, quantasRespondidas,
  questoesEmDisputa, textoCompartilhamento,
} from './core.js';
import { icone, marcaCorrecao } from './icones.js';
import { tocar } from './som.js';

const CHAVE = 'gabarito-enem-2026';
const URL_SITE = 'https://guilhermevieirao.github.io/GabaritoEnem2026/';
const app = document.getElementById('app');

/* ------------------------------------------------------------------ estado */

const PADRAO = {
  preferencias: { som: true, efeitos: true, correcaoImediata: true, tema: 'auto' },
  sessoes: {},
  redacao: null,
};

function carregar() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (!bruto || typeof bruto !== 'object') return structuredClone(PADRAO);
    return {
      preferencias: { ...PADRAO.preferencias, ...(bruto.preferencias || {}) },
      sessoes: bruto.sessoes && typeof bruto.sessoes === 'object' ? bruto.sessoes : {},
      redacao: typeof bruto.redacao === 'number' ? bruto.redacao : null,
    };
  } catch {
    return structuredClone(PADRAO);
  }
}

const estado = carregar();
let armazenamentoOk = true;

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    armazenamentoOk = true;
  } catch {
    if (armazenamentoOk) avisar('Não deu para salvar neste navegador (modo privado?). Suas respostas valem só até fechar a aba.');
    armazenamentoOk = false;
  }
}

function sessaoValida(s) {
  return s && (s.dia === 1 || s.dia === 2) && Array.isArray(s.respostas) && s.respostas.length === TOTAL_QUESTOES && CORES[s.cor];
}

function sessao(dia) {
  const s = estado.sessoes[dia];
  return sessaoValida(s) ? s : null;
}

function novaSessao({ dia, cor, lingua, modo }) {
  const agora = new Date().toISOString();
  estado.sessoes[dia] = {
    dia, cor, lingua: dia === 1 ? lingua : null, modo,
    respostas: Array(TOTAL_QUESTOES).fill(null),
    atual: 0, criadaEm: agora, atualizadaEm: agora, concluidaEm: null,
  };
  salvar();
  return estado.sessoes[dia];
}

const dadosDia = (dia) => edicao.dias[dia];
const gabaritoDa = (s) => montarGabarito(dadosDia(s.dia), s.cor, s.lingua);

/* ---------------------------------------------------------------- utilitários */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nomeCor = (cor) => CORES[cor]?.nome ?? cor;
const nomeLingua = (l) => (l === 'espanhol' ? 'Espanhol' : 'Inglês');
const BRASILIA = { timeZone: 'America/Sao_Paulo' };
const dataCurta = (iso, opcoes = {}) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', ...opcoes });
const horaCurta = (iso, opcoes = {}) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...opcoes });
const reduzirMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function avisar(texto, ms = 3600) {
  const caixa = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.textContent = texto;
  caixa.append(el);
  setTimeout(() => el.remove(), ms);
}

function confirmar(texto, rotulo = 'Confirmar') {
  const dlg = document.getElementById('dialogo-confirmar');
  document.getElementById('texto-confirmar').textContent = texto;
  document.getElementById('botao-confirmar').textContent = rotulo;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolve) => dlg.addEventListener('close', () => resolve(dlg.returnValue === 'sim'), { once: true }));
}

function aplicarCaderno(cor) {
  if (cor) document.documentElement.dataset.caderno = cor;
  else delete document.documentElement.dataset.caderno;
}

function aplicarTema() {
  const t = estado.preferencias.tema;
  if (t === 'claro' || t === 'escuro') document.documentElement.dataset.tema = t;
  else delete document.documentElement.dataset.tema;
  const escuro = t === 'escuro' || (t !== 'claro' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#0d0f12' : '#f4f5f7');
}

function confete(qtd = 26) {
  if (reduzirMovimento() || !estado.preferencias.efeitos) return;
  const camada = document.createElement('div');
  camada.className = 'confete';
  const cores = ['#2f6fd6', '#f2c230', '#17834a', '#f4f4f1', '#8b919a'];
  for (let i = 0; i < qtd; i += 1) {
    const b = document.createElement('i');
    b.style.left = `${Math.random() * 100}%`;
    b.style.setProperty('--cor', cores[i % cores.length]);
    b.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
    b.style.setProperty('--dur', `${1200 + Math.random() * 1200}ms`);
    b.style.animationDelay = `${Math.random() * 300}ms`;
    camada.append(b);
  }
  document.body.append(camada);
  setTimeout(() => camada.remove(), 3000);
}

/* ------------------------------------------------------------------- rotas */

let rota = { nome: 'inicio' };

function lerRota() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (partes[0] === 'prova' && (partes[1] === '1' || partes[1] === '2')) return { nome: 'prova', dia: Number(partes[1]) };
  if (partes[0] === 'resultado' && (partes[1] === '1' || partes[1] === '2')) return { nome: 'resultado', dia: Number(partes[1]) };
  if (partes[0] === 'sobre') return { nome: 'sobre' };
  return { nome: 'inicio' };
}

function ir(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function render() {
  rota = lerRota();
  if ((rota.nome === 'prova' || rota.nome === 'resultado') && !sessao(rota.dia)) {
    history.replaceState(null, '', '#/');
    rota = { nome: 'inicio' };
  }
  const titulos = {
    inicio: 'Gabarito ENEM 2026 — corrija sua prova e estime sua nota TRI',
    prova: `Corrigindo o ${rota.dia}º dia — Gabarito ENEM 2026`,
    resultado: `Resultado do ${rota.dia}º dia — Gabarito ENEM 2026`,
    sobre: 'Como funciona — Gabarito ENEM 2026',
  };
  document.title = titulos[rota.nome];
  if (rota.nome === 'prova') telaProva(rota.dia);
  else if (rota.nome === 'resultado') telaResultado(rota.dia);
  else if (rota.nome === 'sobre') telaSobre();
  else telaInicio();
  window.scrollTo({ top: 0 });
  const main = document.getElementById('conteudo');
  if (document.activeElement && document.activeElement !== document.body && !main.contains(document.activeElement)) main.focus({ preventScroll: true });
}

/* ------------------------------------------------------------------- início */

function situacaoDia(dia) {
  const d = dadosDia(dia);
  const data = new Date(`${d.data}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', ...BRASILIA });
  if (d.gabaritos) {
    const n = d.fontes.length;
    const quando = d.atualizadoEm ? `${dataCurta(d.atualizadoEm, BRASILIA)}, ${horaCurta(d.atualizadoEm, BRASILIA).replace(':', 'h')} (horário de Brasília)` : '';
    const tipo = d.situacao === 'oficial' ? 'gabarito oficial do INEP' : `gabarito extraoficial, consenso de ${n} correções`;
    return `<li><span class="ok">${icone.certo}</span><span><strong>${dia}º dia (${data}):</strong> ${tipo}${quando ? `, atualizado em ${quando}` : ''}.</span></li>`;
  }
  return `<li><span class="aguardando">${icone.relogio}</span><span><strong>${dia}º dia (${data}):</strong> o gabarito sai depois da prova. Você já pode preencher e guardar suas respostas; a correção aparece sozinha quando o gabarito entrar aqui.</span></li>`;
}

function resumoSessao(s) {
  const gab = gabaritoDa(s);
  const r = corrigir({ dia: s.dia, gabarito: gab, respostas: s.respostas, areas: dadosDia(s.dia).areas });
  return { gab, r, respondidas: quantasRespondidas(gab, s.respostas) };
}

// Trecho de cartão-resposta corrigido a caneta: mostra o que o site faz antes de qualquer clique.
function ilustracaoCartao() {
  const linhas = [
    { n: 31, marcada: 'C', correta: 'C' },
    { n: 32, marcada: 'A', correta: 'D' },
    { n: 33, marcada: 'E', correta: 'E' },
    { n: 34, marcada: 'B', correta: 'B' },
  ];
  const cx = (k) => 64 + k * 40;
  const corpo = linhas.map((l, j) => {
    const y = 30 + j * 44;
    const bolhas = LETRAS.map((letra, k) => {
      const cheia = letra === l.marcada;
      const anel = letra === l.correta && l.marcada !== l.correta;
      return `<circle cx="${cx(k)}" cy="${y}" r="13" class="${cheia ? 'il-cheia' : 'il-vazia'}${anel ? ' il-anel' : ''}"/><text x="${cx(k)}" y="${y + 4.5}" class="${cheia ? 'il-letra-cheia' : 'il-letra'}">${letra}</text>`;
    }).join('');
    const k = LETRAS.indexOf(l.marcada);
    const marca = l.marcada === l.correta
      ? `<path class="il-certo" d="M${cx(k) - 11} ${y + 1} l7 7 l15 -17"/>`
      : `<path class="il-errado" d="M${cx(k) - 10} ${y - 10} l20 20 M${cx(k) + 10} ${y - 10} l-20 20"/>`;
    return `<text x="22" y="${y + 5}" class="il-num">${l.n}</text>${bolhas}${marca}`;
  }).join('');
  return `<figure class="ilustracao" aria-hidden="true"><svg viewBox="0 0 260 186">${corpo}</svg></figure>`;
}

function telaInicio() {
  aplicarCaderno(null);
  const emAndamento = [1, 2].map(sessao).filter((s) => s && !s.concluidaEm && s.respostas.some((x) => x != null));
  const concluidas = [1, 2].map(sessao).filter((s) => s && s.concluidaEm);
  const diaPadrao = emAndamento[0]?.dia ?? (dadosDia(1).gabaritos ? 1 : 2);

  const retomar = emAndamento.map((s) => {
    const { respondidas } = resumoSessao(s);
    return `<section class="retomar" data-caderno="${s.cor}" aria-label="Correção em andamento">
      <div><h2>Continuar de onde parou</h2>
      <p class="secundario">${s.dia}º dia · caderno ${nomeCor(s.cor)}${s.lingua ? ` · ${nomeLingua(s.lingua)}` : ''} · ${respondidas} de 90 preenchidas · questão ${numeroQuestao(s.dia, s.atual)}</p></div>
      <div class="acoes"><a class="btn btn-caderno" href="#/prova/${s.dia}">Continuar</a>
      <button class="btn btn-fantasma" type="button" data-descartar="${s.dia}">Descartar</button></div>
    </section>`;
  }).join('');

  const salvos = concluidas.length ? `<section class="pilha" style="--espaco:12px" aria-labelledby="t-salvos">
      <h2 id="t-salvos">Seus resultados</h2>
      <ul class="lista-resultados">${concluidas.map((s) => {
        const { gab, r } = resumoSessao(s);
        const notas = gab ? dadosDia(s.dia).areas.map((a) => {
          const e = estimarNota(tabelaTri, a.id, r.porArea[a.id].acertos, r.porArea[a.id].validas);
          return e ? `${a.curto} ~${Math.round(e.mediana)}` : null;
        }).filter(Boolean).join(' · ') : 'aguardando gabarito';
        return `<li class="item-resultado"><span class="selo" style="--c:${CORES[s.cor].hex}" aria-hidden="true"></span>
          <span><strong>${s.dia}º dia · ${nomeCor(s.cor)}${gab ? ` · ${r.total.acertos} acertos` : ''}</strong><span class="terciario">${notas} · corrigido em ${dataCurta(s.concluidaEm)}</span></span>
          <a class="btn" href="#/resultado/${s.dia}">Abrir</a></li>`;
      }).join('')}</ul></section>` : '';

  app.innerHTML = `
    <div class="pilha">
      ${retomar}
      <section class="abertura">
        <div class="abertura-texto">
          <h1>Corrija sua prova do ENEM 2026</h1>
          <p class="lede">Marque as alternativas do seu caderno e veja os acertos por área, as questões em que os cursinhos discordam e uma estimativa da nota pela TRI.</p>
          <ul class="situacoes">${situacaoDia(1)}${situacaoDia(2)}</ul>
          ${ilustracaoCartao()}
        </div>
        <div class="painel config">
          <form id="form-config" novalidate>
            <fieldset>
              <legend>Dia da prova</legend>
              <div class="opcoes opcoes-2">
                ${[1, 2].map((dia) => `<label class="opcao"><input type="radio" name="dia" value="${dia}" ${dia === diaPadrao ? 'checked' : ''}>
                  <span class="opcao-caixa"><strong>${dia}º dia</strong><span>${dadosDia(dia).titulo}</span></span></label>`).join('')}
              </div>
            </fieldset>
            <fieldset>
              <legend>Cor do caderno</legend>
              <div class="cadernos" id="cadernos"></div>
              <p class="erro-campo" id="erro-cor" hidden>Escolha a cor que aparece na capa do seu caderno.</p>
            </fieldset>
            <fieldset id="campo-lingua">
              <legend>Língua estrangeira</legend>
              <div class="opcoes opcoes-2">
                <label class="opcao"><input type="radio" name="lingua" value="ingles" checked><span class="opcao-caixa"><strong>Inglês</strong><span>Questões 1 a 5</span></span></label>
                <label class="opcao"><input type="radio" name="lingua" value="espanhol"><span class="opcao-caixa"><strong>Espanhol</strong><span>Questões 1 a 5</span></span></label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Como você quer preencher</legend>
              <div class="opcoes opcoes-2">
                <label class="opcao"><input type="radio" name="modo" value="questao" checked><span class="opcao-caixa"><strong>Uma por vez</strong><span>Correção a cada resposta</span></span></label>
                <label class="opcao"><input type="radio" name="modo" value="cartao"><span class="opcao-caixa"><strong>Cartão-resposta</strong><span>Preenche tudo e corrige no fim</span></span></label>
              </div>
            </fieldset>
            <div><button class="btn btn-primario btn-grande" type="submit">Começar a correção</button></div>
          </form>
        </div>
      </section>
      ${salvos}
    </div>`;

  const form = document.getElementById('form-config');
  const desenharCadernos = () => {
    const dia = Number(form.dia.value);
    const atual = form.querySelector('input[name="cor"]:checked')?.value;
    document.getElementById('cadernos').innerHTML = dadosDia(dia).cores.map((cor) => `
      <label class="caderno-opcao"><input type="radio" name="cor" value="${cor}" ${cor === atual ? 'checked' : ''}>
        <span class="caderno-capa" style="--c:${CORES[cor].hex}"><span class="caderno-check">${icone.certo}</span><span class="caderno-nome">${nomeCor(cor)}</span></span></label>`).join('');
    document.getElementById('campo-lingua').hidden = !dadosDia(dia).temLinguaEstrangeira;
  };
  desenharCadernos();
  form.addEventListener('change', (e) => {
    if (e.target.name === 'dia') desenharCadernos();
    if (e.target.name === 'cor') { document.getElementById('erro-cor').hidden = true; aplicarCaderno(e.target.value); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dia = Number(form.dia.value);
    const cor = form.querySelector('input[name="cor"]:checked')?.value;
    if (!cor) {
      document.getElementById('erro-cor').hidden = false;
      document.querySelector('#cadernos input')?.focus();
      return;
    }
    const lingua = form.querySelector('input[name="lingua"]:checked')?.value ?? 'ingles';
    const modo = form.querySelector('input[name="modo"]:checked')?.value ?? 'questao';
    const existente = sessao(dia);
    if (existente && existente.respostas.some((x) => x != null)) {
      const igual = existente.cor === cor && (dia === 2 || existente.lingua === lingua);
      if (igual) {
        existente.modo = modo;
        salvar();
        ir(`#/prova/${dia}`);
        return;
      }
      const ok = await confirmar(`Você já tem respostas salvas do ${dia}º dia (caderno ${nomeCor(existente.cor)}). Começar de novo com o caderno ${nomeCor(cor)} apaga essas respostas.`, 'Apagar e começar');
      if (!ok) return;
    }
    novaSessao({ dia, cor, lingua, modo });
    ir(`#/prova/${dia}`);
  });
  app.querySelectorAll('[data-descartar]').forEach((b) => b.addEventListener('click', async () => {
    const dia = Number(b.dataset.descartar);
    if (await confirmar(`Apagar as respostas do ${dia}º dia salvas neste aparelho?`, 'Apagar')) {
      delete estado.sessoes[dia];
      salvar();
      telaInicio();
      avisar('Respostas apagadas.');
    }
  }));
}

/* -------------------------------------------------------------------- prova */

let prova = null; // { s, gab, disputas, imediata, ultimo }

function feedbackImediato() {
  return Boolean(prova.gab) && prova.s.modo !== 'cartao' && estado.preferencias.correcaoImediata;
}

function rotuloArea(dia, indice) {
  const numero = numeroQuestao(dia, indice);
  const area = dadosDia(dia).areas.find((a) => numero >= a.inicio && numero <= a.fim);
  const sub = area?.sub?.find((x) => numero >= x.inicio && numero <= x.fim);
  const posicao = numero - area.inicio + 1;
  return `${area.curto}${sub ? ` · ${sub.curto}` : ''} · ${posicao} de ${area.fim - area.inicio + 1}`;
}

function telaProva(dia) {
  const s = sessao(dia);
  aplicarCaderno(s.cor);
  const gab = gabaritoDa(s);
  const disputas = questoesEmDisputa(dadosDia(dia).divergencias?.[s.cor], s.lingua);
  prova = { s, gab, disputas: new Map(disputas.map((d) => [d.indice, d])), ultimo: null };
  if (s.atual < 0 || s.atual >= TOTAL_QUESTOES) s.atual = 0;

  const areas = dadosDia(dia).areas;
  const linhas = (area) => {
    let html = '';
    for (let n = area.inicio; n <= area.fim; n += 1) {
      const i = indiceDaQuestao(dia, n);
      html += `<div class="linha" data-linha="${i}" role="radiogroup" aria-label="Questão ${n}">
        <button type="button" class="linha-num" data-ir="${i}" aria-label="Ir para a questão ${n}">${n}</button>
        ${LETRAS.map((l) => `<button type="button" class="mini" role="radio" aria-checked="false" data-q="${i}" data-l="${l}" aria-label="Questão ${n}, alternativa ${l}">${l}</button>`).join('')}
        <span class="linha-estado" data-estado="${i}"></span></div>`;
    }
    return html;
  };

  app.innerHTML = `
    <div class="barra-prova">
      <div class="barra-prova-linha">
        <span class="etiqueta-caderno"><i aria-hidden="true"></i>${dia}º dia · ${nomeCor(s.cor)}${s.lingua ? `<span class="so-largo"> · ${nomeLingua(s.lingua)}</span>` : ''}</span>
        <div class="progresso" aria-hidden="true">
          <div class="progresso-texto"><span id="prog-texto"></span><span id="prog-acertos"></span></div>
          <div class="progresso-trilho"><div class="progresso-valor" id="prog-valor"></div></div>
        </div>
        <div class="acoes">
          <button class="btn btn-fantasma" type="button" id="abrir-lote">${icone.colar}<span class="rotulo-largo">Colar respostas</span></button>
          <button class="btn btn-primario" type="button" id="ver-resultado">${icone.resultado}<span class="rotulo-largo">Ver resultado</span></button>
        </div>
      </div>
    </div>
    <div class="mesa">
      <section class="painel foco" aria-labelledby="titulo-questao">
        <div class="tinta" id="tinta"></div>
        <div class="foco-cabeca">
          <div><h2 id="titulo-questao">Questão <span class="num" id="num-questao"></span></h2>
          <p class="foco-area" id="area-questao"></p></div>
          <span class="etiqueta disputa" id="selo-disputa" hidden>Em disputa</span>
        </div>
        <div id="zona-resposta">
          <div class="bolhas" role="radiogroup" aria-labelledby="titulo-questao" id="bolhas">
            ${LETRAS.map((l) => `<button type="button" class="bolha" role="radio" aria-checked="false" data-letra="${l}" aria-label="Alternativa ${l}">${l}</button>`).join('')}
          </div>
          <div class="controles-questao">
            <button class="btn" type="button" id="anterior">${icone.anterior}<span class="rotulo-largo">Anterior</span></button>
            <button class="btn" type="button" id="em-branco">${icone.branco}<span>Deixei em branco</span></button>
            <button class="btn" type="button" id="proxima"><span class="rotulo-largo">Próxima</span>${icone.proxima}</button>
          </div>
        </div>
        <div class="aviso-anulada" id="zona-anulada" hidden>
          <p><strong>Questão anulada.</strong> Ela não conta para ninguém, então não precisa responder.</p>
          <div class="acoes" style="margin-top:12px"><button class="btn" type="button" id="anulada-voltar">${icone.anterior}<span>Anterior</span></button><button class="btn btn-primario" type="button" id="anulada-avancar"><span>Avançar</span>${icone.proxima}</button></div>
        </div>
        <div class="retorno" id="retorno" aria-live="polite"></div>
        <div class="concluido" id="concluido" hidden>
          <p><strong>Tudo preenchido.</strong> Confira o cartão ao lado se quiser e veja o resultado.</p>
          <div><button class="btn btn-primario" type="button" id="concluir">${icone.resultado}<span>Ver resultado</span></button></div>
        </div>
        <p class="dica-teclado">Teclado: <kbd>A</kbd>–<kbd>E</kbd> ou <kbd>1</kbd>–<kbd>5</kbd> respondem · <kbd>-</kbd> em branco · <kbd>←</kbd> <kbd>→</kbd> navegam · <kbd>Backspace</kbd> volta uma questão</p>
      </section>
      <section class="painel cartao ${s.modo === 'cartao' ? '' : 'recolhido'}" id="cartao" aria-labelledby="titulo-cartao">
        <div class="cartao-cabeca">
          <h3 id="titulo-cartao">Cartão-resposta</h3>
          <button class="btn btn-fantasma" type="button" id="alternar-cartao" aria-expanded="${s.modo === 'cartao'}" aria-controls="cartao-corpo">${icone.cartao}<span>${s.modo === 'cartao' ? 'Recolher' : 'Mostrar'}</span></button>
        </div>
        <div class="cartao-corpo" id="cartao-corpo">
          ${areas.map((a) => `<div class="cartao-area"><h4><span>${a.curto}</span><span class="num">${a.inicio}–${a.fim}</span></h4><div class="cartao-linhas">${linhas(a)}</div></div>`).join('')}
        </div>
      </section>
    </div>`;

  const largo = window.matchMedia('(min-width: 1000px)');
  const ajustarBotaoCartao = () => {
    const botao = document.getElementById('alternar-cartao');
    if (!botao) return;
    botao.hidden = largo.matches;
  };
  ajustarBotaoCartao();
  largo.addEventListener?.('change', ajustarBotaoCartao, { once: true });

  document.getElementById('bolhas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-letra]');
    if (b) responder(b.dataset.letra, { origem: 'foco' });
  });
  document.getElementById('cartao-corpo').addEventListener('click', (e) => {
    const mini = e.target.closest('.mini');
    if (mini) { responder(mini.dataset.l, { indice: Number(mini.dataset.q), origem: 'cartao' }); return; }
    const irPara = e.target.closest('[data-ir]');
    if (irPara) {
      mover(Number(irPara.dataset.ir));
      if (!largo.matches) document.getElementById('titulo-questao').scrollIntoView({ behavior: reduzirMovimento() ? 'auto' : 'smooth', block: 'center' });
    }
  });
  document.getElementById('anterior').addEventListener('click', () => mover(prova.s.atual - 1));
  document.getElementById('proxima').addEventListener('click', () => mover(prova.s.atual + 1));
  document.getElementById('anulada-voltar').addEventListener('click', () => mover(prova.s.atual - 1));
  document.getElementById('anulada-avancar').addEventListener('click', () => mover(prova.s.atual + 1));
  document.getElementById('em-branco').addEventListener('click', () => responder(BRANCO, { origem: 'foco' }));
  document.getElementById('ver-resultado').addEventListener('click', concluir);
  document.getElementById('concluir').addEventListener('click', concluir);
  document.getElementById('abrir-lote').addEventListener('click', abrirLote);
  document.getElementById('alternar-cartao').addEventListener('click', (e) => {
    const cartao = document.getElementById('cartao');
    const recolhido = cartao.classList.toggle('recolhido');
    e.currentTarget.setAttribute('aria-expanded', String(!recolhido));
    e.currentTarget.querySelector('span').textContent = recolhido ? 'Mostrar' : 'Recolher';
  });

  atualizarProva({ tudo: true });
}

function atualizarLinha(i) {
  const { s, gab } = prova;
  const linha = app.querySelector(`[data-linha="${i}"]`);
  if (!linha) return;
  const correta = gab?.[i];
  const marcada = s.respostas[i];
  const anulada = correta === ANULADA;
  const mostrar = feedbackImediato() && marcada && marcada !== BRANCO && !anulada;
  linha.classList.toggle('anulada', anulada);
  linha.classList.toggle('atual', i === s.atual);
  linha.querySelectorAll('.mini').forEach((b) => {
    const l = b.dataset.l;
    const marcadaAqui = marcada === l;
    b.setAttribute('aria-checked', String(marcadaAqui));
    b.classList.toggle('mini-acerto', Boolean(mostrar && marcadaAqui && l === correta));
    b.classList.toggle('mini-erro', Boolean(mostrar && marcadaAqui && l !== correta));
    b.classList.toggle('mini-correta', Boolean(mostrar && l === correta && marcada !== correta));
  });
  const estadoEl = linha.querySelector('.linha-estado');
  const disputa = prova.disputas.has(i) && feedbackImediato() ? '<span class="ponto-disputa" title="Questão em disputa entre as correções"></span>' : '';
  if (anulada) estadoEl.textContent = 'anulada';
  else if (marcada === BRANCO) estadoEl.innerHTML = `<span class="branco">em branco</span>${disputa}`;
  else estadoEl.innerHTML = disputa;
}

function atualizarProva({ tudo = false, anterior = null } = {}) {
  const { s, gab } = prova;
  const i = s.atual;
  const numero = numeroQuestao(s.dia, i);
  document.getElementById('num-questao').textContent = numero;
  document.getElementById('area-questao').textContent = rotuloArea(s.dia, i);
  const anulada = gab?.[i] === ANULADA;
  document.getElementById('zona-resposta').hidden = anulada;
  document.getElementById('zona-anulada').hidden = !anulada;
  document.getElementById('selo-disputa').hidden = !(feedbackImediato() && prova.disputas.has(i));
  document.getElementById('anterior').disabled = i === 0;
  document.getElementById('proxima').disabled = i === TOTAL_QUESTOES - 1;
  document.getElementById('anulada-voltar').disabled = i === 0;
  document.getElementById('anulada-avancar').disabled = i === TOTAL_QUESTOES - 1;
  document.getElementById('bolhas').querySelectorAll('.bolha').forEach((b) => {
    b.setAttribute('aria-checked', String(s.respostas[i] === b.dataset.letra));
    b.classList.remove('correta-revelada');
    b.querySelector('.marca-correcao')?.remove();
  });
  document.getElementById('em-branco').setAttribute('aria-pressed', String(s.respostas[i] === BRANCO));

  const respondidas = quantasRespondidas(gab, s.respostas);
  document.getElementById('prog-texto').innerHTML = `${respondidas} de 90<span class="so-largo"> preenchidas</span>`;
  document.getElementById('prog-valor').style.width = `${(respondidas / TOTAL_QUESTOES) * 100}%`;
  if (feedbackImediato()) {
    const r = corrigir({ dia: s.dia, gabarito: gab, respostas: s.respostas, areas: dadosDia(s.dia).areas });
    document.getElementById('prog-acertos').innerHTML = `${r.total.acertos} acertos<span class="so-largo"> até aqui</span>`;
  } else {
    document.getElementById('prog-acertos').innerHTML = gab ? '' : 'sem gabarito<span class="so-largo"> ainda</span>';
  }
  document.getElementById('concluido').hidden = respondidas < TOTAL_QUESTOES;

  if (tudo) for (let k = 0; k < TOTAL_QUESTOES; k += 1) atualizarLinha(k);
  else {
    atualizarLinha(i);
    if (anterior != null && anterior !== i) atualizarLinha(anterior);
  }
  if (!tudo) {
    // No computador o cartão rola sozinho, sem mexer na página.
    const linhaAtual = app.querySelector(`[data-linha="${i}"]`);
    const cartao = document.getElementById('cartao');
    if (linhaAtual && cartao && window.matchMedia('(min-width: 1000px)').matches) {
      const caixa = cartao.getBoundingClientRect();
      const r = linhaAtual.getBoundingClientRect();
      const cabeca = cartao.querySelector('.cartao-cabeca')?.offsetHeight ?? 0;
      const visivelAte = Math.min(caixa.bottom, window.innerHeight);
      if (r.top < caixa.top + cabeca) cartao.scrollTop -= caixa.top + cabeca - r.top + 8;
      else if (r.bottom > visivelAte) cartao.scrollTop += r.bottom - visivelAte + 12;
    }
  }
  desenharRetorno();
}

function desenharRetorno() {
  const caixa = document.getElementById('retorno');
  const u = prova.ultimo;
  caixa.className = 'retorno';
  if (!u) {
    caixa.innerHTML = prova.gab
      ? `<span>${icone.info}</span><span>${feedbackImediato() ? 'Responda e a correção aparece aqui.' : 'A correção aparece no resultado, quando você terminar.'}</span>`
      : `<span>${icone.relogio}</span><span>O gabarito deste dia ainda não saiu. Preencha e guarde: a correção aparece quando ele for publicado.</span>`;
    return;
  }
  const numero = numeroQuestao(prova.s.dia, u.indice);
  const correta = prova.gab?.[u.indice];
  const marcadaTexto = u.marcada === BRANCO ? 'deixou em branco' : `marcou <strong class="mono">${u.marcada}</strong>`;
  if (!feedbackImediato() || correta === ANULADA) {
    caixa.innerHTML = `<span>${icone.certo}</span><span>Questão ${numero}: você ${marcadaTexto}. Anotado.</span>`;
    return;
  }
  const d = prova.disputas.get(u.indice);
  const notaDisputa = d ? `<span class="disputa-nota">Em disputa: ${Object.entries(d.votos).map(([l, f]) => `${f.length} ${f.length === 1 ? 'correção diz' : 'correções dizem'} ${l}`).join(', ')}.</span>` : '';
  if (u.marcada === correta) {
    caixa.classList.add('acerto');
    caixa.innerHTML = `<span>${icone.certo}</span><span>Questão ${numero}: você ${marcadaTexto}. <strong>Acertou.</strong>${notaDisputa}</span>`;
  } else {
    caixa.classList.add('erro');
    caixa.innerHTML = `<span>${icone.errado}</span><span>Questão ${numero}: você ${marcadaTexto}. Gabarito: <strong class="mono">${correta}</strong>.${notaDisputa}</span>`;
  }
}

function efeito(tipo, indice) {
  if (estado.preferencias.som) tocar(tipo);
  if (!estado.preferencias.efeitos || reduzirMovimento()) return;
  const tinta = document.getElementById('tinta');
  if (tinta) {
    tinta.className = 'tinta';
    void tinta.offsetWidth;
    tinta.className = `tinta ${tipo}`;
  }
  const linha = app.querySelector(`[data-linha="${indice}"] .mini[aria-checked="true"]`);
  linha?.animate?.([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
}

function responder(letra, { indice = prova.s.atual, origem = 'foco', avancar = true, silencioso = false } = {}) {
  const { s, gab } = prova;
  if (gab?.[indice] === ANULADA) return;
  s.respostas[indice] = letra;
  s.atualizadaEm = new Date().toISOString();
  const anterior = s.atual;
  prova.ultimo = { indice, marcada: letra };
  if (!silencioso) {
    if (feedbackImediato() && letra !== BRANCO) efeito(letra === gab[indice] ? 'acerto' : 'erro', indice);
    else if (estado.preferencias.som) tocar('neutro');
  }
  if (origem === 'foco' && avancar && indice < TOTAL_QUESTOES - 1) s.atual = indice + 1;
  else if (origem === 'cartao') s.atual = indice;
  salvar();
  atualizarProva({ anterior });
  if (!silencioso && origem === 'foco' && feedbackImediato() && letra !== BRANCO && s.atual === indice) mostrarMarcaNaBolha(indice);
}

function mostrarMarcaNaBolha(indice) {
  const { s, gab } = prova;
  const marcada = s.respostas[indice];
  const bolha = document.querySelector(`#bolhas [data-letra="${marcada}"]`);
  if (!bolha) return;
  const tipo = marcada === gab[indice] ? 'acerto' : 'erro';
  bolha.insertAdjacentHTML('beforeend', marcaCorrecao(tipo));
  if (tipo === 'erro') document.querySelector(`#bolhas [data-letra="${gab[indice]}"]`)?.classList.add('correta-revelada');
}

function mover(indice) {
  if (indice < 0 || indice >= TOTAL_QUESTOES) return;
  const anterior = prova.s.atual;
  prova.s.atual = indice;
  salvar();
  atualizarProva({ anterior });
  const { s, gab } = prova;
  if (feedbackImediato() && s.respostas[indice] && s.respostas[indice] !== BRANCO && gab[indice] !== ANULADA) mostrarMarcaNaBolha(indice);
}

async function concluir() {
  const { s, gab } = prova;
  const faltam = TOTAL_QUESTOES - quantasRespondidas(gab, s.respostas);
  if (faltam > 0) {
    const ok = await confirmar(`Faltam ${faltam} ${faltam === 1 ? 'questão sem resposta' : 'questões sem resposta'}. ${faltam === 1 ? 'Ela conta' : 'Elas contam'} como em branco no resultado, e você pode voltar e completar depois.`, 'Ver resultado assim');
    if (!ok) {
      const p = proximaPendente(gab, s.respostas, 0);
      if (p >= 0) mover(p);
      return;
    }
  }
  s.concluidaEm = new Date().toISOString();
  salvar();
  ir(`#/resultado/${s.dia}`);
}

/* ---------------------------------------------------------- colar em lote */

function abrirLote() {
  const dlg = document.getElementById('dialogo-lote');
  const texto = document.getElementById('lote-texto');
  const inicio = document.getElementById('lote-inicio');
  const { s } = prova;
  texto.value = '';
  inicio.min = String(numeroQuestao(s.dia, 0));
  inicio.max = String(numeroQuestao(s.dia, TOTAL_QUESTOES - 1));
  const primeira = proximaPendente(prova.gab, s.respostas, 0);
  inicio.value = String(numeroQuestao(s.dia, primeira >= 0 ? primeira : 0));
  previaLote();
  dlg.returnValue = '';
  dlg.showModal();
  texto.focus();
}

function lerLote() {
  const { s } = prova;
  const inicioNum = Number(document.getElementById('lote-inicio').value) || numeroQuestao(s.dia, 0);
  const inicio = Math.min(Math.max(indiceDaQuestao(s.dia, inicioNum), 0), TOTAL_QUESTOES - 1);
  return interpretarLote(document.getElementById('lote-texto').value, { dia: s.dia, inicio });
}

function previaLote() {
  const previa = document.getElementById('lote-previa');
  const aplicar = document.getElementById('lote-aplicar');
  const { respostas, ignorados, formato } = lerLote();
  const indices = [...respostas.keys()].sort((a, b) => a - b);
  previa.className = 'previa';
  if (!indices.length) {
    previa.textContent = ignorados.length ? `Nada reconhecido. Use só as letras A a E (ou - para em branco).` : 'Nada reconhecido ainda.';
    if (ignorados.length) previa.classList.add('alerta');
    aplicar.disabled = true;
    return;
  }
  const dia = prova.s.dia;
  const anuladas = indices.filter((i) => prova.gab?.[i] === ANULADA).length;
  const sobrescreve = indices.filter((i) => prova.s.respostas[i] != null && prova.s.respostas[i] !== respostas.get(i)).length;
  const partes = [`${indices.length} ${indices.length === 1 ? 'resposta reconhecida' : 'respostas reconhecidas'}${formato === 'sequencia' ? `, da questão ${numeroQuestao(dia, indices[0])} à ${numeroQuestao(dia, indices.at(-1))}` : ''}.`];
  if (sobrescreve) partes.push(`${sobrescreve} ${sobrescreve === 1 ? 'substitui uma resposta' : 'substituem respostas'} já marcadas.`);
  if (anuladas) partes.push(`${anuladas} cai${anuladas === 1 ? '' : 'em'} em questão anulada e será ignorada.`);
  if (ignorados.length) partes.push(`${ignorados.length} ${ignorados.length === 1 ? 'caractere ignorado' : 'caracteres ignorados'}.`);
  previa.textContent = partes.join(' ');
  previa.classList.add(ignorados.length ? 'alerta' : 'ok');
  aplicar.disabled = false;
}

function aplicarLote() {
  const { respostas } = lerLote();
  let n = 0;
  let ultimo = null;
  for (const [i, letra] of [...respostas.entries()].sort((a, b) => a[0] - b[0])) {
    if (prova.gab?.[i] === ANULADA) continue;
    prova.s.respostas[i] = letra;
    ultimo = i;
    n += 1;
  }
  if (!n) return;
  const proxima = proximaPendente(prova.gab, prova.s.respostas, ultimo);
  prova.s.atual = proxima >= 0 ? proxima : ultimo;
  prova.s.atualizadaEm = new Date().toISOString();
  prova.ultimo = null;
  salvar();
  atualizarProva({ tudo: true });
  avisar(`${n} ${n === 1 ? 'resposta preenchida' : 'respostas preenchidas'}.`);
}

/* ---------------------------------------------------------------- resultado */

function faixaTri(e) {
  const escala = [250, 1000];
  const pos = (v) => `${((Math.min(Math.max(v, escala[0]), escala[1]) - escala[0]) / (escala[1] - escala[0])) * 100}%`;
  const larg = (a, b) => `calc(${pos(b)} - ${pos(a)})`;
  return `<div class="faixa-tri" role="img" aria-label="Faixa de notas de quem teve ${e.acertos} acertos: metade entre ${Math.round(e.p25)} e ${Math.round(e.p75)}, 80% entre ${Math.round(e.p10)} e ${Math.round(e.p90)}">
    <span class="eixo"></span>
    <span class="extremos" style="left:${pos(e.min)};width:${larg(e.min, e.max)}"></span>
    <span class="ampla" style="left:${pos(e.p10)};width:${larg(e.p10, e.p90)}"></span>
    <span class="provavel" style="left:${pos(e.p25)};width:${larg(e.p25, e.p75)}"></span>
    <span class="marcador" style="left:${pos(e.mediana)}"></span>
    ${[400, 600, 800].map((v) => `<span class="escala" style="left:${pos(v)}" aria-hidden="true">${v}</span>`).join('')}
  </div>
  <span class="faixa-legenda" aria-hidden="true">metade entre <span class="num">${Math.round(e.p25)}</span> e <span class="num">${Math.round(e.p75)}</span> · 80% entre <span class="num">${Math.round(e.p10)}</span> e <span class="num">${Math.round(e.p90)}</span></span>`;
}

function estimativasDa(s, r) {
  return dadosDia(s.dia).areas.map((a) => {
    const c = r.porArea[a.id];
    const e = estimarNota(tabelaTri, a.id, c.acertos, c.validas);
    return e ? { ...e, nome: a.curto, id: a.id } : null;
  });
}

function notasDisponiveis() {
  const notas = [];
  for (const dia of [1, 2]) {
    const s = sessao(dia);
    if (!s || !s.concluidaEm) continue;
    const gab = gabaritoDa(s);
    if (!gab) continue;
    const r = corrigir({ dia, gabarito: gab, respostas: s.respostas, areas: dadosDia(dia).areas });
    for (const e of estimativasDa(s, r)) if (e) notas.push({ id: e.id, nome: e.nome, nota: e.mediana });
  }
  return notas;
}

function telaResultado(dia) {
  const s = sessao(dia);
  aplicarCaderno(s.cor);
  const d = dadosDia(dia);
  const gab = gabaritoDa(s);
  const r = corrigir({ dia, gabarito: gab, respostas: s.respostas, areas: d.areas });
  const meta = `<div class="meta"><span>Caderno ${nomeCor(s.cor)}</span>${s.lingua ? `<span>${nomeLingua(s.lingua)}</span>` : ''}<span>${gab ? (d.situacao === 'oficial' ? 'Gabarito oficial do INEP' : `Gabarito extraoficial · consenso de ${d.fontes.length} correções`) : 'Gabarito ainda não publicado'}</span></div>`;

  if (!gab) {
    app.innerHTML = `<div class="pilha">
      <header class="resultado-cabeca"><h1>${dia}º dia: respostas guardadas</h1>${meta}</header>
      <section class="painel pendente-gabarito"><h2>O gabarito ainda não saiu</h2>
        <p>Suas ${quantasRespondidas(null, s.respostas)} respostas estão salvas neste aparelho. Quando o gabarito do ${dia}º dia for publicado aqui (previsão: depois das 19h de ${new Date(d.liberacaoPrevista || d.data).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', ...BRASILIA })}, horário de Brasília), é só abrir esta página que a correção aparece.</p>
        <div class="acoes"><a class="btn" href="#/prova/${dia}">${icone.editar}<span>Revisar respostas</span></a><a class="btn btn-fantasma" href="#/">${icone.inicio}<span>Início</span></a></div>
      </section></div>`;
    return;
  }

  const estimativas = estimativasDa(s, r);
  const disputas = questoesEmDisputa(d.divergencias?.[s.cor], s.lingua);
  const ganho = ganhoPossivelNasDisputas(disputas, s.respostas);
  const nomesFonte = Object.fromEntries((d.fontes || []).map((f) => [f.id, f.nome]));
  const linhasArea = d.areas.map((a, k) => {
    const c = r.porArea[a.id];
    const e = estimativas[k];
    const sub = (a.sub || []).map((x) => {
      const cs = r.porArea[x.id];
      return `<tr class="area-sub"><th scope="row" class="area-nome">${x.nome}</th><td class="num">${cs.acertos} de ${cs.validas}</td><td class="num nota-cel">—</td><td class="faixa-cel terciario">Entra na nota de ${a.curto}</td></tr>`;
    }).join('');
    return `<tr><th scope="row" class="area-nome">${a.nome}</th>
      <td class="num"><span class="acertos-grande">${c.acertos}<small> de ${c.validas}</small></span></td>
      <td class="num nota-cel"><span class="rotulo-celula">Nota provável</span>${e ? `<span class="nota-grande">${Math.round(e.mediana)}</span>` : '—'}</td>
      <td class="faixa-cel">${e ? faixaTri(e) : '<span class="terciario">Sem dados para estimar</span>'}</td></tr>${sub}`;
  }).join('');

  const notas = notasDisponiveis();
  const outroDia = dia === 1 ? 2 : 1;

  app.innerHTML = `<div class="pilha">
    <header class="resultado-cabeca"><h1>Resultado do ${dia}º dia</h1>${meta}</header>

    <section class="painel" aria-labelledby="t-boletim">
      <div class="boletim-rolagem"><table class="boletim">
        <caption id="t-boletim">Boletim estimado</caption>
        <thead><tr><th scope="col">Área</th><th scope="col" class="num">Acertos</th><th scope="col" class="num">Nota provável</th><th scope="col">Faixa de quem teve os mesmos acertos</th></tr></thead>
        <tbody>${linhasArea}</tbody>
        <tfoot><tr><th scope="row">Total</th><td class="num">${r.total.acertos} de ${r.total.validas}</td><td class="num">${formatarPercentual(r.total.percentual)}</td><td class="terciario">${r.total.erros} erros · ${r.total.brancos + r.total.pendentes} em branco${r.total.anuladas ? ` · ${r.total.anuladas} anuladas` : ''}</td></tr></tfoot>
      </table></div>
      <p class="terciario" style="padding:0 20px 18px">A nota provável é a mediana das notas oficiais de quem teve o mesmo número de acertos no ENEM ${tabelaTri.anos.join(' e ')}. A barra escura mostra onde ficou metade dessas pessoas; a clara, 80%. Quem acerta as questões mais fáceis fica mais perto do topo da faixa. <a href="#/sobre">Entenda o cálculo</a>.</p>
    </section>

    <section class="painel media-redacao" aria-labelledby="t-media">
      <div class="pilha" style="--espaco:10px">
        <h2 id="t-media">Sua média</h2>
        <div class="campo"><label for="nota-redacao">Nota da redação (opcional, 0 a 1000)</label>
          <input id="nota-redacao" type="number" inputmode="numeric" min="0" max="1000" step="20" value="${estado.redacao ?? ''}" placeholder="ex.: 760"></div>
        <p class="terciario" id="explica-media"></p>
      </div>
      <div><span class="terciario">Média simples</span><div class="media-valor" id="media-valor">—</div></div>
    </section>

    ${disputas.length ? `<section class="painel" aria-labelledby="t-disputas">
      <div class="painel-corpo" style="padding-bottom:8px"><h2 id="t-disputas">Questões em disputa</h2>
      <p class="secundario" style="margin-top:6px">Nestas questões as correções não concordam. Usamos a alternativa da maioria; o gabarito oficial pode decidir diferente.</p></div>
      ${ganho.ganho ? `<p class="ganho">Se as disputas forem decididas a favor do que você marcou, são <strong>+${ganho.ganho} ${ganho.ganho === 1 ? 'acerto' : 'acertos'}</strong>.</p>` : ''}
      <ul class="disputas">${disputas.map((x) => {
        const marcada = s.respostas[x.indice];
        const etiqueta = !marcada || marcada === BRANCO ? '<span class="etiqueta">em branco</span>'
          : marcada === x.escolhida ? '<span class="etiqueta acerto">você marcou a da maioria</span>'
          : `<span class="etiqueta ${x.votos[marcada]?.length >= 2 ? 'disputa' : 'erro'}">você marcou ${marcada}</span>`;
        return `<li><span><strong>Questão ${numeroQuestao(dia, x.indice)}</strong> ${etiqueta}</span>
          <span class="secundario">${Object.entries(x.votos).map(([l, fs]) => `<span class="voto">${l}</span>: ${fs.map((f) => esc(nomesFonte[f] || f)).join(', ')}`).join(' · ')}</span></li>`;
      }).join('')}</ul></section>` : ''}

    <section class="painel" aria-labelledby="t-cartao">
      <div class="painel-corpo" style="padding-bottom:0"><h2 id="t-cartao">Cartão corrigido</h2>
      <p class="terciario" style="margin-top:6px">Toque em uma questão para mudar a resposta.</p></div>
      <div class="grade-corrigida">${r.porQuestao.map((q) => {
        const disputa = disputas.some((x) => x.indice === q.indice) ? '<span class="ponto-disputa" aria-hidden="true"></span>' : '';
        let corpo;
        if (q.situacao === 'anulada') corpo = '<span class="m">anulada</span>';
        else if (q.situacao === 'acerto') corpo = `<span class="m">${icone.certo}${q.marcada}</span><span class="c">&nbsp;</span>`;
        else if (q.situacao === 'erro') corpo = `<span class="m">${icone.errado}${q.marcada}</span><span class="c">era ${q.correta}</span>`;
        else corpo = `<span class="m">${icone.branco}</span><span class="c">era ${q.correta}</span>`;
        const rotulo = { acerto: 'acertou', erro: `marcou ${q.marcada}, gabarito ${q.correta}`, branco: `em branco, gabarito ${q.correta}`, pendente: `sem resposta, gabarito ${q.correta}`, anulada: 'anulada' }[q.situacao];
        return `<a class="celula ${q.situacao}" href="#/prova/${dia}" data-editar="${q.indice}" aria-label="Questão ${q.numero}: ${rotulo}${disputa ? ', em disputa' : ''}"><span class="n">${q.numero}</span>${corpo}${disputa}</a>`;
      }).join('')}</div>
      <div class="legenda"><span><i style="background:var(--acerto-bg);border-color:var(--acerto)"></i>Acerto</span><span><i style="background:var(--erro-bg);border-color:var(--erro)"></i>Erro (mostra o gabarito)</span><span><i></i>Em branco</span>${r.total.anuladas ? '<span><i style="background:var(--anulada-bg)"></i>Anulada</span>' : ''}${disputas.length ? '<span><span class="ponto-disputa"></span>Em disputa</span>' : ''}</div>
    </section>

    <div class="acoes">
      <button class="btn btn-primario" type="button" id="baixar-pdf">${icone.baixar}<span>Baixar PDF</span></button>
      <button class="btn" type="button" id="compartilhar">${icone.compartilhar}<span>Compartilhar</span></button>
      <a class="btn" href="#/prova/${dia}">${icone.editar}<span>Editar respostas</span></a>
      <button class="btn" type="button" id="refazer">${icone.refazer}<span>Corrigir de novo</span></button>
      ${!sessao(outroDia)?.concluidaEm ? `<a class="btn btn-fantasma" href="#/">${icone.inicio}<span>Corrigir o ${outroDia}º dia</span></a>` : `<a class="btn btn-fantasma" href="#/resultado/${outroDia}">${icone.resultado}<span>Ver o ${outroDia}º dia</span></a>`}
    </div>
  </div>`;

  const atualizarMedia = () => {
    const campo = document.getElementById('nota-redacao');
    const bruto = campo.value.trim();
    const valor = bruto === '' ? null : Number(bruto);
    const valido = valor === null || (Number.isFinite(valor) && valor >= 0 && valor <= 1000);
    campo.setAttribute('aria-invalid', String(!valido));
    if (valido) { estado.redacao = valor; salvar(); }
    const lista = [...notas.map((n) => n.nota), ...(valido && valor !== null ? [valor] : [])];
    const m = media(lista);
    document.getElementById('media-valor').textContent = m == null ? '—' : formatarNota(m);
    const nomes = [...notas.map((n) => n.nome), ...(valido && valor !== null ? ['Redação'] : [])];
    const falta = 5 - nomes.length;
    document.getElementById('explica-media').textContent = !valido ? 'A nota da redação vai de 0 a 1000.'
      : `Média de ${nomes.join(', ')}${falta > 0 ? `. Faltam ${falta} ${falta === 1 ? 'nota' : 'notas'} para a média completa do ENEM.` : ' — as cinco notas do ENEM.'} Cada curso no Sisu usa pesos próprios.`;
  };
  document.getElementById('nota-redacao').addEventListener('input', atualizarMedia);
  atualizarMedia();

  app.querySelectorAll('[data-editar]').forEach((a) => a.addEventListener('click', () => {
    s.atual = Number(a.dataset.editar);
    salvar();
  }));
  document.getElementById('refazer').addEventListener('click', async () => {
    if (!(await confirmar(`Isso apaga as respostas do ${dia}º dia e começa de novo com o mesmo caderno (${nomeCor(s.cor)}${s.lingua ? `, ${nomeLingua(s.lingua)}` : ''}).`, 'Apagar e recomeçar'))) return;
    novaSessao({ dia, cor: s.cor, lingua: s.lingua, modo: s.modo });
    ir(`#/prova/${dia}`);
  });
  document.getElementById('compartilhar').addEventListener('click', async () => {
    const texto = textoCompartilhamento({ edicao: edicao.edicao, dia, corNome: nomeCor(s.cor), resultado: r, estimativas: estimativas.filter(Boolean), url: URL_SITE });
    try {
      if (navigator.share) { await navigator.share({ title: 'Minha correção do ENEM 2026', text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      avisar('Resumo copiado. É só colar onde quiser.');
    } catch (err) {
      if (err?.name !== 'AbortError') avisar('Não deu para compartilhar daqui. Tente baixar o PDF.');
    }
  });
  document.getElementById('baixar-pdf').addEventListener('click', async (e) => {
    const botao = e.currentTarget;
    botao.disabled = true;
    try {
      const { gerarPdf } = await import('./pdf.js');
      await gerarPdf({ edicao: edicao.edicao, dia, sessao: s, dadosDia: d, resultado: r, estimativas, disputas, nomeCor: nomeCor(s.cor), nomeLingua: s.lingua ? nomeLingua(s.lingua) : null, tabelaTri });
      avisar('PDF gerado.');
    } catch (err) {
      console.error(err);
      avisar('Não foi possível gerar o PDF agora. Verifique a conexão e tente de novo.');
    } finally {
      botao.disabled = false;
    }
  });

  const gabaritou = d.areas.filter((a) => r.porArea[a.id].validas > 0 && r.porArea[a.id].acertos === r.porArea[a.id].validas);
  if (gabaritou.length) setTimeout(() => { confete(40); avisar(`Você gabaritou ${gabaritou.map((a) => a.curto).join(' e ')}!`); }, 300);
}

/* -------------------------------------------------------------------- sobre */

function telaSobre() {
  aplicarCaderno(null);
  const d1 = dadosDia(1);
  app.innerHTML = `<article class="texto pilha" style="--espaco:0">
    <h1>Como funciona</h1>
    <p class="lede">Tudo roda no seu navegador. Nenhuma resposta sai do seu aparelho.</p>

    <h2>De onde vem o gabarito</h2>
    <p>Enquanto o INEP não publica o gabarito oficial, juntamos as correções extraoficiais de vários cursinhos e usamos, em cada questão de cada caderno, a alternativa indicada pela <strong>maioria</strong>. Quando há empate, vale a fonte mais confiável: a que mais concorda com o consenso nas outras questões, medida de forma conservadora (limite inferior do intervalo de confiança de Wilson, 95%), para que uma fonte com poucos cadernos não passe à frente das que corrigiram tudo.</p>
    <p>Como as quatro cores trazem as mesmas questões em outra ordem, conferimos ainda que a quantidade de A, B, C, D e E em cada área é igual em todas as cores. O gabarito consolidado passou nessa checagem.</p>
    <table class="tabela-fontes">
      <thead><tr><th>Fonte</th><th>Cadernos</th><th class="num">Concordância com o consenso</th></tr></thead>
      <tbody>${d1.fontes.map((f) => `<tr><td><a href="${esc(f.url)}" rel="noopener">${esc(f.nome)}</a><br><span class="terciario">${esc(f.via)} · ${esc(f.horario)}</span></td><td>${f.cadernos.map(nomeCor).join(', ')}</td><td class="num">${String(f.concordancia).replace('.', ',')}% de ${f.questoesComparadas}</td></tr>`).join('')}</tbody>
    </table>
    <p>Questões em que pelo menos duas correções apontam outra alternativa aparecem marcadas como <strong>em disputa</strong>, com os votos de cada fonte. As transcrições de cada fonte estão no repositório, em <span class="mono">data/fontes</span>, para quem quiser conferir.</p>

    <h2>Como estimamos a nota (TRI)</h2>
    <p>O ENEM calcula a nota pela Teoria de Resposta ao Item: além de quantas questões você acertou, conta quais foram. Para fazer a conta exata é preciso conhecer a dificuldade de cada questão, e o INEP só divulga esses parâmetros meses depois, nos microdados.</p>
    <p>Por isso usamos o que já existe de mais próximo: as <strong>notas oficiais de ${(Object.values(tabelaTri.participantes).map((p) => Math.max(...Object.values(p))).reduce((a, b) => a + b, 0) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} milhões de participações</strong> do ENEM ${tabelaTri.anos.join(' e ')}, agrupadas pelo número de acertos em cada área. A nota provável é a mediana de quem teve o mesmo número de acertos que você (média entre os anos); a faixa mostra onde ficaram 50% e 80% dessas pessoas.</p>
    <p>Para ter certeza de que entendemos o cálculo do INEP, reproduzimos as notas oficiais de 2024 a partir dos parâmetros dos itens: modelo de três parâmetros, estimativa EAP com distribuição normal e uma conversão linear própria de cada área. O erro médio ficou em 0,02 ponto. Quando os microdados de 2026 saírem, o mesmo cálculo poderá dar a nota exata a partir das suas respostas.</p>
    <p>É uma estimativa: provas diferentes têm itens de dificuldade diferente, então a sua nota real pode cair em qualquer ponto da faixa.</p>

    <h2>Atalhos de teclado</h2>
    <div class="atalhos">
      <kbd>A</kbd><span>a <kbd>E</kbd> ou <kbd>1</kbd> a <kbd>5</kbd>: marca a alternativa e vai para a próxima</span>
      <kbd>-</kbd><span>ou <kbd>0</kbd>: questão em branco</span>
      <kbd>←</kbd><span><kbd>→</kbd>: anterior e próxima, sem mudar a resposta</span>
      <kbd>Backspace</kbd><span>volta uma questão</span>
      <kbd>Enter</kbd><span>avança (inclusive em questão anulada)</span>
    </div>
    <p>Os atalhos não funcionam enquanto você digita em um campo ou com Ctrl, Alt ou ⌘ pressionado, para não atrapalhar copiar e colar.</p>

    <h2>Privacidade</h2>
    <p>Suas respostas, preferências e a nota da redação ficam guardadas só no armazenamento local do navegador. Não há cadastro, cookies de rastreamento nem envio de dados. Limpar os dados do site apaga tudo.</p>
    <div class="acoes" style="margin-top:32px"><a class="btn btn-primario" href="#/">${icone.inicio}<span>Voltar ao início</span></a></div>
  </article>`;
}

/* ------------------------------------------------------------------ teclado */

function teclaNaProva(e) {
  if (rota.nome !== 'prova' || !prova) return;
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (document.querySelector('dialog[open]')) return;
  const alvo = e.target;
  if (alvo instanceof Element && alvo.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
  const tecla = e.key;
  const naBolhaOuBotao = alvo instanceof Element && alvo.closest('button, a');
  const anulada = prova.gab?.[prova.s.atual] === ANULADA;

  if (tecla === 'ArrowLeft') { e.preventDefault(); mover(prova.s.atual - 1); return; }
  if (tecla === 'ArrowRight') { e.preventDefault(); mover(prova.s.atual + 1); return; }
  if (e.repeat) return; // segurar a tecla não responde várias questões
  if (tecla === 'Backspace') { e.preventDefault(); mover(prova.s.atual - 1); return; }
  if ((tecla === 'Enter' || tecla === ' ') && !naBolhaOuBotao) {
    e.preventDefault();
    if (anulada || prova.s.respostas[prova.s.atual] != null) mover(prova.s.atual + 1);
    return;
  }
  if (anulada) return;
  const mapa = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' };
  const letra = LETRAS.includes(tecla.toUpperCase()) && tecla.length === 1 ? tecla.toUpperCase() : mapa[tecla];
  if (letra) { e.preventDefault(); responder(letra, { origem: 'foco' }); return; }
  if (tecla === '-' || tecla === '0' || tecla === '.') { e.preventDefault(); responder(BRANCO, { origem: 'foco' }); }
}

/* ------------------------------------------------------------ preferências */

function ligarPreferencias() {
  const dlg = document.getElementById('dialogo-config');
  const p = estado.preferencias;
  const campos = { som: 'pref-som', efeitos: 'pref-efeitos', correcaoImediata: 'pref-imediata' };
  document.getElementById('abrir-config').addEventListener('click', () => {
    for (const [k, id] of Object.entries(campos)) document.getElementById(id).checked = Boolean(p[k]);
    dlg.querySelector(`input[name="tema"][value="${p.tema}"]`).checked = true;
    dlg.showModal();
  });
  dlg.addEventListener('change', (e) => {
    const id = e.target.id;
    const chave = Object.keys(campos).find((k) => campos[k] === id);
    if (chave) p[chave] = e.target.checked;
    if (e.target.name === 'tema') { p.tema = e.target.value; aplicarTema(); }
    salvar();
    if (chave === 'correcaoImediata' && rota.nome === 'prova' && prova) atualizarProva({ tudo: true });
  });
}

function ligarLote() {
  const dlg = document.getElementById('dialogo-lote');
  document.getElementById('lote-texto').addEventListener('input', previaLote);
  document.getElementById('lote-inicio').addEventListener('input', previaLote);
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'aplicar' && prova) aplicarLote();
  });
}

function ligarEasterEgg() {
  const marca = document.getElementById('marca-bolhas');
  let cliques = [];
  marca.parentElement.addEventListener('click', () => {
    const agora = Date.now();
    cliques = [...cliques.filter((t) => agora - t < 2500), agora];
    if (cliques.length >= 5) {
      cliques = [];
      marca.classList.remove('festa');
      void marca.offsetWidth;
      marca.classList.add('festa');
      confete(30);
      avisar('Respira. A parte mais difícil você já fez.', 4200);
    }
  });
}

/* ------------------------------------------------------------------- início */

function iniciar() {
  aplicarTema();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicarTema);
  ligarPreferencias();
  ligarLote();
  ligarEasterEgg();
  document.addEventListener('keydown', teclaNaProva);
  window.addEventListener('hashchange', render);
  window.addEventListener('storage', (e) => {
    if (e.key !== CHAVE) return;
    Object.assign(estado, carregar());
    render();
  });
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

iniciar();
