import { test } from 'node:test';
import assert from 'node:assert/strict';
import edicao, { CORES } from '../data/enem2026.js';
import tabelaTri from '../data/tri.js';
import {
  ANULADA, BRANCO, corrigir, estimarNota, ganhoPossivelNasDisputas, interpretarLote, media,
  montarGabarito, numeroQuestao, indiceDaQuestao, proximaPendente, quantasRespondidas, questoesEmDisputa,
} from '../assets/js/core.js';

const dia1 = edicao.dias[1];
const dia2 = edicao.dias[2];
const contar = (letras) => [...letras].reduce((m, l) => ({ ...m, [l]: (m[l] || 0) + 1 }), {});

test('gabarito do 1º dia: quatro cores completas, só letras válidas', () => {
  assert.deepEqual(Object.keys(dia1.gabaritos).sort(), [...dia1.cores].sort());
  for (const cor of dia1.cores) {
    const g = dia1.gabaritos[cor];
    assert.equal(g.ingles.length, 5, cor);
    assert.equal(g.espanhol.length, 5, cor);
    assert.equal(g.resto.length, 85, cor);
    assert.match(g.ingles + g.espanhol + g.resto, /^[A-EX]+$/, cor);
    assert.ok(CORES[cor], cor);
  }
});

test('gabarito do 1º dia: mesma contagem de letras por área em todas as cores', () => {
  // As cores trazem as mesmas questões em outra ordem; foi essa checagem que faltou na versão 2025.
  const assinatura = (g) => JSON.stringify([
    contar(g.ingles), contar(g.espanhol), contar(g.resto.slice(0, 40)), contar(g.resto.slice(40)),
  ].map((o) => Object.entries(o).sort()));
  const assinaturas = new Set(dia1.cores.map((c) => assinatura(dia1.gabaritos[c])));
  assert.equal(assinaturas.size, 1);
});

test('anuladas: mesmo número por área em todas as cores (bug do caderno verde de 2025)', () => {
  for (const dia of [dia1, dia2]) {
    if (!dia.gabaritos) continue;
    const porArea = (cor) => dia.areas.map((a) => {
      const g = montarGabarito(dia, cor, 'ingles');
      return g.filter((x, i) => x === ANULADA && numeroQuestao(dia.numero, i) >= a.inicio && numeroQuestao(dia.numero, i) <= a.fim).length;
    }).join(',');
    assert.equal(new Set(dia.cores.map(porArea)).size, 1);
  }
});

test('divergências apontam para letras e fontes que existem', () => {
  const ids = new Set(dia1.fontes.map((f) => f.id));
  for (const [cor, div] of Object.entries(dia1.divergencias)) {
    for (const [chave, d] of Object.entries(div)) {
      assert.match(chave, /^(ING[1-5]|ESP[1-5]|Q([6-9]|[1-8]\d|90))$/);
      assert.ok(d.votos[d.escolhida], `${cor} ${chave}`);
      for (const fontes of Object.values(d.votos)) for (const f of fontes) assert.ok(ids.has(f), f);
      const g = dia1.gabaritos[cor];
      const atual = chave.startsWith('ING') ? g.ingles[Number(chave.slice(3)) - 1]
        : chave.startsWith('ESP') ? g.espanhol[Number(chave.slice(3)) - 1] : g.resto[Number(chave.slice(1)) - 6];
      assert.equal(atual, d.escolhida, `${cor} ${chave}`);
    }
  }
});

test('2º dia preparado: áreas 91–135 e 136–180, gabarito pendente', () => {
  assert.equal(dia2.areas[0].inicio, 91);
  assert.equal(dia2.areas[0].fim, 135);
  assert.equal(dia2.areas[1].inicio, 136);
  assert.equal(dia2.areas[1].fim, 180);
  assert.equal(montarGabarito(dia2, 'azul'), null);
});

test('montarGabarito troca as 5 primeiras pela língua escolhida', () => {
  const ing = montarGabarito(dia1, 'azul', 'ingles');
  const esp = montarGabarito(dia1, 'azul', 'espanhol');
  assert.equal(ing.length, 90);
  assert.deepEqual(ing.slice(0, 5), [...dia1.gabaritos.azul.ingles]);
  assert.deepEqual(esp.slice(0, 5), [...dia1.gabaritos.azul.espanhol]);
  assert.deepEqual(ing.slice(5), esp.slice(5));
});

test('numeração contínua: dia 2 vai de 91 a 180', () => {
  assert.equal(numeroQuestao(1, 0), 1);
  assert.equal(numeroQuestao(2, 0), 91);
  assert.equal(numeroQuestao(2, 89), 180);
  assert.equal(indiceDaQuestao(2, 91), 0);
});

const fakeDia2 = {
  numero: 2,
  temLinguaEstrangeira: false,
  areas: [{ id: 'CN', inicio: 91, fim: 135 }, { id: 'MT', inicio: 136, fim: 180 }],
  gabaritos: { azul: { questoes: 'ABCDE'.repeat(18).split('').map((l, i) => (i === 3 || i === 50 ? 'X' : l)).join('') } },
};

test('corrigir: anuladas não contam nem como acerto nem no total (bug do resultado salvo de 2025)', () => {
  const gab = montarGabarito(fakeDia2, 'azul');
  const respostas = gab.map((l) => (l === ANULADA ? 'X' : l)); // até um "X" gravado não pode virar acerto
  const r = corrigir({ dia: 2, gabarito: gab, respostas, areas: fakeDia2.areas });
  assert.equal(r.total.anuladas, 2);
  assert.equal(r.total.validas, 88);
  assert.equal(r.total.acertos, 88);
  assert.equal(r.porArea.CN.validas, 44);
  assert.equal(r.porArea.MT.validas, 44);
  assert.equal(r.porQuestao[3].numero, 94);
  assert.equal(r.porQuestao[3].situacao, 'anulada');
});

test('corrigir: em branco, pendente, erro e acerto separados por área', () => {
  const gab = montarGabarito(dia1, 'verde', 'ingles');
  const respostas = Array(90).fill(null);
  respostas[0] = gab[0];
  respostas[1] = gab[1] === 'A' ? 'B' : 'A';
  respostas[2] = BRANCO;
  respostas[60] = gab[60];
  const r = corrigir({ dia: 1, gabarito: gab, respostas, areas: dia1.areas });
  assert.deepEqual([r.total.acertos, r.total.erros, r.total.brancos, r.total.pendentes], [2, 1, 1, 86]);
  assert.equal(r.porArea.LE.acertos, 1);
  assert.equal(r.porArea.LE.validas, 5);
  assert.equal(r.porArea.LC.acertos, 1);
  assert.equal(r.porArea.LC.validas, 45);
  assert.equal(r.porArea.CH.acertos, 1);
});

test('interpretarLote: sequência com brancos, espaços e quebras de linha', () => {
  const { respostas, ignorados } = interpretarLote('ab c\nD-e. Z', { inicio: 10 });
  assert.deepEqual([...respostas.entries()], [[10, 'A'], [11, 'B'], [12, 'C'], [13, 'D'], [14, BRANCO], [15, 'E'], [16, BRANCO]]);
  assert.deepEqual(ignorados, ['Z']);
});

test('interpretarLote: lista numerada, inclusive no 2º dia', () => {
  const r1 = interpretarLote('1-A 2) b 3: C\n4 .', { dia: 1 });
  assert.deepEqual([...r1.respostas.entries()], [[0, 'A'], [1, 'B'], [2, 'C'], [3, BRANCO]]);
  const r2 = interpretarLote('91 E 180 A 5 B', { dia: 2 });
  assert.deepEqual([...r2.respostas.entries()], [[0, 'E'], [89, 'A']]);
  assert.equal(r2.ignorados.length, 1);
});

test('interpretarLote: não passa da questão 90', () => {
  const { respostas, ignorados } = interpretarLote('ABCDE', { inicio: 88 });
  assert.equal(respostas.size, 2);
  assert.equal(ignorados.length, 3);
});

test('proximaPendente e quantasRespondidas pulam anuladas', () => {
  const gab = montarGabarito(fakeDia2, 'azul');
  const respostas = Array(90).fill('A');
  respostas[3] = null; // anulada: não conta como pendente
  respostas[7] = null;
  assert.equal(proximaPendente(gab, respostas, 0), 7);
  assert.equal(quantasRespondidas(gab, respostas), 89);
});

test('estimarNota: cresce com os acertos e respeita a faixa', () => {
  for (const area of ['LC', 'CH', 'CN', 'MT']) {
    let anterior = 0;
    for (let k = 5; k <= 45; k += 5) {
      const e = estimarNota(tabelaTri, area, k, 45);
      assert.ok(e, `${area} ${k}`);
      assert.ok(e.mediana > anterior, `${area} ${k}`);
      assert.ok(e.min <= e.p10 && e.p10 <= e.p25 && e.p25 <= e.mediana && e.mediana <= e.p75 && e.p75 <= e.p90 && e.p90 <= e.max, `${area} ${k}`);
      assert.ok(e.amostra > 0);
      anterior = e.mediana;
    }
  }
});

test('estimarNota: reescala quando há questão anulada', () => {
  const cheia = estimarNota(tabelaTri, 'MT', 22, 44);
  assert.ok(cheia);
  assert.equal(cheia.validas, 44);
});

test('questões em disputa exigem pelo menos duas fontes contra', () => {
  const div = {
    Q10: { escolhida: 'A', votos: { A: ['a', 'b', 'c'], C: ['d', 'e'] } },
    Q11: { escolhida: 'B', votos: { B: ['a', 'b', 'c', 'd'], E: ['e'] } },
    ING2: { escolhida: 'D', votos: { D: ['a', 'b'], C: ['c', 'd'] } },
    ESP2: { escolhida: 'D', votos: { D: ['a', 'b'], C: ['c', 'd'] } },
  };
  assert.deepEqual(questoesEmDisputa(div, 'ingles').map((d) => d.indice), [1, 9]);
  assert.deepEqual(questoesEmDisputa(div, 'espanhol').map((d) => d.indice), [1, 9]);
  const respostas = Array(90).fill(null);
  respostas[9] = 'C';
  respostas[1] = 'C';
  assert.deepEqual(ganhoPossivelNasDisputas(questoesEmDisputa(div, 'ingles'), respostas), { ganho: 2, questoes: [1, 9] });
});

test('media ignora notas ausentes', () => {
  assert.equal(media([600, null, 700]), 650);
  assert.equal(media([]), null);
});
