// Lógica pura do corretor: sem DOM, sem armazenamento. Tudo aqui é testado em tests/core.test.mjs.

export const LETRAS = ['A', 'B', 'C', 'D', 'E'];
export const BRANCO = '-';
export const ANULADA = 'X';
export const TOTAL_QUESTOES = 90;

/** Número exibido da questão (dia 1: 1–90, dia 2: 91–180). */
export function numeroQuestao(dia, indice) {
  return (dia === 2 ? 90 : 0) + indice + 1;
}

/** Índice interno (0–89) a partir do número exibido. */
export function indiceDaQuestao(dia, numero) {
  return numero - (dia === 2 ? 90 : 0) - 1;
}

/**
 * Monta o gabarito de 90 posições de um caderno.
 * Dia 1: 5 questões da língua escolhida + 85 restantes. Dia 2: 90 posições.
 * Retorna null quando o gabarito daquele caderno ainda não foi publicado.
 */
export function montarGabarito(dadosDia, cor, lingua) {
  const caderno = dadosDia?.gabaritos?.[cor];
  if (!caderno) return null;
  if (dadosDia.temLinguaEstrangeira) {
    const le = caderno[lingua === 'espanhol' ? 'espanhol' : 'ingles'];
    if (!le || !caderno.resto) return null;
    return [...le, ...caderno.resto];
  }
  return [...caderno.questoes];
}

/** Normaliza o que o participante marcou. Qualquer coisa fora de A–E vira "em branco". */
export function normalizarResposta(valor) {
  if (valor == null) return null;
  const v = String(valor).trim().toUpperCase();
  return LETRAS.includes(v) ? v : BRANCO;
}

/**
 * Interpreta respostas coladas em lote.
 * Aceita uma sequência contínua ("ABCDE-AB…", onde - . _ ou * contam como em branco)
 * ou uma lista numerada ("1-A 2) B 3: C"). Números da lista são os números da prova
 * (dia 2 começa em 91), e sem número as respostas começam em `inicio` (índice 0–89).
 */
export function interpretarLote(texto, { dia = 1, inicio = 0, total = TOTAL_QUESTOES } = {}) {
  const resultado = { respostas: new Map(), ignorados: [], formato: 'sequencia' };
  const limpo = String(texto ?? '').toUpperCase();
  if (!limpo.trim()) return resultado;

  const numerada = /\d/.test(limpo);
  if (numerada) {
    resultado.formato = 'numerada';
    const padrao = /(\d{1,3})\s*[-–—.:)=]?\s*([A-E]|[-._*](?!\d))/g;
    let m;
    while ((m = padrao.exec(limpo))) {
      const indice = indiceDaQuestao(dia, Number(m[1]));
      if (indice < 0 || indice >= total) { resultado.ignorados.push(m[0].trim()); continue; }
      resultado.respostas.set(indice, LETRAS.includes(m[2]) ? m[2] : BRANCO);
    }
    return resultado;
  }

  let indice = inicio;
  for (const ch of limpo) {
    if (/\s/.test(ch) || ch === ',' || ch === ';') continue;
    let valor;
    if (LETRAS.includes(ch)) valor = ch;
    else if ('-._*'.includes(ch)) valor = BRANCO;
    else { resultado.ignorados.push(ch); continue; }
    if (indice >= total) { resultado.ignorados.push(ch); continue; }
    resultado.respostas.set(indice, valor);
    indice += 1;
  }
  return resultado;
}

/** Situação de uma questão a partir do gabarito e da resposta. */
export function situacao(correta, marcada) {
  if (correta === ANULADA) return 'anulada';
  if (marcada == null) return 'pendente';
  if (marcada === BRANCO) return 'branco';
  if (correta == null) return 'sem-gabarito';
  return marcada === correta ? 'acerto' : 'erro';
}

function contagemVazia() {
  return { acertos: 0, erros: 0, brancos: 0, pendentes: 0, anuladas: 0, validas: 0, total: 0 };
}

/**
 * Corrige a prova. `areas` vem dos dados do dia: [{ id, inicio, fim, sub: [{ id, inicio, fim }] }]
 * com números de questão no intervalo do dia. Anuladas não contam em nenhum total.
 */
export function corrigir({ dia, gabarito, respostas, areas }) {
  const porQuestao = [];
  const total = contagemVazia();
  const porArea = {};
  const todasAreas = [];
  for (const area of areas) {
    todasAreas.push(area);
    for (const sub of area.sub ?? []) todasAreas.push(sub);
  }
  for (const a of todasAreas) porArea[a.id] = contagemVazia();

  for (let i = 0; i < TOTAL_QUESTOES; i += 1) {
    const numero = numeroQuestao(dia, i);
    const correta = gabarito ? gabarito[i] : null;
    const marcada = respostas[i] ?? null;
    const s = situacao(correta, marcada);
    porQuestao.push({ indice: i, numero, correta, marcada, situacao: s });
    const alvos = [total, ...todasAreas.filter((a) => numero >= a.inicio && numero <= a.fim).map((a) => porArea[a.id])];
    for (const c of alvos) {
      c.total += 1;
      if (s === 'anulada') { c.anuladas += 1; continue; }
      c.validas += 1;
      if (s === 'acerto') c.acertos += 1;
      else if (s === 'erro') c.erros += 1;
      else if (s === 'branco') c.brancos += 1;
      else if (s === 'pendente') c.pendentes += 1;
    }
  }
  for (const c of [total, ...Object.values(porArea)]) {
    c.percentual = c.validas > 0 ? (c.acertos / c.validas) * 100 : 0;
  }
  return { total, porArea, porQuestao };
}

/** Primeira questão ainda não respondida (ignorando anuladas), ou -1. */
export function proximaPendente(gabarito, respostas, aPartirDe = 0) {
  for (let k = 0; k < TOTAL_QUESTOES; k += 1) {
    const i = (aPartirDe + k) % TOTAL_QUESTOES;
    if (gabarito && gabarito[i] === ANULADA) continue;
    if (respostas[i] == null) return i;
  }
  return -1;
}

export function quantasRespondidas(gabarito, respostas) {
  let n = 0;
  for (let i = 0; i < TOTAL_QUESTOES; i += 1) {
    if (gabarito && gabarito[i] === ANULADA) { n += 1; continue; }
    if (respostas[i] != null) n += 1;
  }
  return n;
}

/**
 * Questões em disputa entre as correções: a alternativa escolhida não é unânime
 * e pelo menos duas fontes apontam outra letra.
 */
export function questoesEmDisputa(divergenciasDoCaderno, lingua) {
  const lista = [];
  for (const [chave, d] of Object.entries(divergenciasDoCaderno ?? {})) {
    const contra = Object.entries(d.votos).filter(([letra]) => letra !== d.escolhida);
    const maiorMinoria = Math.max(0, ...contra.map(([, fontes]) => fontes.length));
    if (maiorMinoria < 2) continue;
    let indice;
    if (chave.startsWith('ING') || chave.startsWith('ESP')) {
      const alvo = lingua === 'espanhol' ? 'ESP' : 'ING';
      if (!chave.startsWith(alvo)) continue;
      indice = Number(chave.slice(3)) - 1;
    } else {
      indice = Number(chave.slice(1)) - 1;
    }
    lista.push({ indice, escolhida: d.escolhida, votos: d.votos });
  }
  return lista.sort((a, b) => a.indice - b.indice);
}

/**
 * Quantos acertos a mais o participante teria se cada questão em disputa
 * fosse decidida a favor da alternativa que ele marcou (cenário otimista).
 */
export function ganhoPossivelNasDisputas(disputas, respostas) {
  let ganho = 0;
  const questoes = [];
  for (const d of disputas) {
    const marcada = respostas[d.indice];
    if (!marcada || marcada === d.escolhida || marcada === BRANCO) continue;
    const apoio = d.votos[marcada]?.length ?? 0;
    if (apoio >= 2) { ganho += 1; questoes.push(d.indice); }
  }
  return { ganho, questoes };
}

/**
 * Estimativa de nota TRI a partir do número de acertos, usando a distribuição real
 * de notas (microdados do INEP) de quem teve o mesmo número de acertos em cada ano.
 * `tabela.areas[area][ano] = { validas, linhas: { k: [n, min, p10, p25, med, p75, p90, max] } }`
 * Os anos entram com o mesmo peso; faixas são a média das faixas de cada ano,
 * e mínimo/máximo são os extremos observados em qualquer ano.
 */
export function estimarNota(tabela, area, acertos, validas, { amostraMinima = 20 } = {}) {
  const porArea = tabela?.areas?.[area];
  if (!porArea || validas <= 0) return null;
  const anos = [];
  for (const [ano, t] of Object.entries(porArea)) {
    // Se o número de questões válidas do ano for outro (item anulado), reescala os acertos.
    const k = t.validas === validas ? acertos : Math.round((acertos / validas) * t.validas);
    const linha = t.linhas?.[k];
    if (!linha || !linha[0]) continue;
    const [n, min, p10, p25, med, p75, p90, max] = linha;
    anos.push({ ano: Number(ano), n, min, p10, p25, med, p75, p90, max });
  }
  if (!anos.length) return null;
  const confiaveis = anos.filter((a) => a.n >= amostraMinima);
  const base = confiaveis.length ? confiaveis : anos;
  const mediaDe = (campo) => base.reduce((s, a) => s + a[campo], 0) / base.length;
  return {
    area,
    acertos,
    validas,
    amostra: anos.reduce((s, a) => s + a.n, 0),
    mediana: mediaDe('med'),
    p10: mediaDe('p10'),
    p25: mediaDe('p25'),
    p75: mediaDe('p75'),
    p90: mediaDe('p90'),
    min: Math.min(...anos.map((a) => a.min)),
    max: Math.max(...anos.map((a) => a.max)),
    porAno: anos.sort((a, b) => a.ano - b.ano),
  };
}

/** Média simples das notas disponíveis (as quatro provas objetivas + redação). */
export function media(notas) {
  const valores = notas.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!valores.length) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export function formatarNota(v) {
  return v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatarPercentual(v) {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Texto curto para compartilhar o resultado. */
export function textoCompartilhamento({ edicao, dia, corNome, resultado, estimativas, url }) {
  const linhas = [`Minha correção do ENEM ${edicao} — ${dia}º dia (caderno ${corNome})`];
  linhas.push(`Acertos: ${resultado.total.acertos} de ${resultado.total.validas}`);
  for (const e of estimativas) {
    if (!e) continue;
    linhas.push(`${e.nome}: ${e.acertos} acertos · nota estimada ~${Math.round(e.mediana)}`);
  }
  if (url) linhas.push(url);
  return linhas.join('\n');
}
