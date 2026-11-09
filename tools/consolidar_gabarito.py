#!/usr/bin/env python3
"""Consolida as correções extraoficiais em um único gabarito por voto da maioria.

Uso:   python3 tools/consolidar_gabarito.py [--dia 1|2]   (padrão: os dois dias que tiverem fontes)
Lê:    data/fontes/2026-diaN/_fontes.json  (horário da consolidação e nome, link e horário de cada fonte)
       data/fontes/2026-diaN/<fonte>.json  (uma correção por arquivo, transcrita da fonte original)
Grava: data/gabarito-2026-diaN.js          (módulo carregado pelo site)

Formato de cada correção
  1º dia: { "azul": { "ingles": "5 letras", "espanhol": "5 letras", "resto": "85 letras" }, ... }
  2º dia: { "azul": { "questoes": "90 letras" }, ... }
  Use X para questão anulada. A fonte pode trazer só as cores que publicou.

Regras
1. Cada questão de cada caderno recebe a alternativa indicada pela maioria das fontes
   que publicaram aquele caderno.
2. Em caso de empate, vence a fonte mais confiável: a de maior taxa de concordância
   com o consenso nas questões sem empate, medida pelo limite inferior do intervalo
   de Wilson (95%). Assim uma fonte que publicou só um caderno não passa à frente
   de outra que acertou quase tudo nos quatro (critério empírico, sem opinião).
3. Divergências ficam registradas com os votos de cada fonte, para o site mostrar.
4. Ao final, confere que todas as cores têm a mesma contagem de letras por área
   (as cores trazem as mesmas questões em outra ordem). Se não tiverem, aborta.
"""
import argparse
import json
from collections import Counter
from math import sqrt
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

DIAS = {
    1: {
        'cores': ['azul', 'amarelo', 'branco', 'verde'],
        'blocos': [('ingles', 5), ('espanhol', 5), ('resto', 85)],
        # Trechos com as mesmas questões em todas as cores: (bloco, início, fim)
        'areas': [('ingles', 0, 5), ('espanhol', 0, 5), ('resto', 0, 40), ('resto', 40, 85)],
    },
    2: {
        'cores': ['azul', 'amarelo', 'cinza', 'verde'],
        'blocos': [('questoes', 90)],
        'areas': [('questoes', 0, 45), ('questoes', 45, 90)],
    },
}


def wilson_inferior(acertos, n, z=1.96):
    if n == 0:
        return 0.0
    p = acertos / n
    centro = p + z * z / (2 * n)
    margem = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (centro - margem) / (1 + z * z / n)


def rotulo(dia, bloco, i):
    if dia == 2:
        return f'Q{i + 1}'
    return {'ingles': f'ING{i + 1}', 'espanhol': f'ESP{i + 1}', 'resto': f'Q{i + 6}'}[bloco]


def consolidar(dia):
    cfg = DIAS[dia]
    pasta = RAIZ / 'data' / 'fontes' / f'2026-dia{dia}'
    arquivos = sorted(p for p in pasta.glob('*.json') if not p.name.startswith('_'))
    if not arquivos:
        print(f'dia {dia}: nenhuma fonte ainda, nada a fazer')
        return
    meta = json.loads((pasta / '_fontes.json').read_text(encoding='utf-8'))
    dados = {p.stem: json.loads(p.read_text(encoding='utf-8')) for p in arquivos}
    for fonte, cadernos in dados.items():
        assert fonte in meta['fontes'], f'fonte sem metadados em _fontes.json: {fonte}'
        for cor, c in cadernos.items():
            assert cor in cfg['cores'], (fonte, cor)
            for bloco, n in cfg['blocos']:
                assert len(c[bloco]) == n, (fonte, cor, bloco, len(c[bloco]))
                assert set(c[bloco]) <= set('ABCDEX'), (fonte, cor, bloco)

    def posicoes():
        for bloco, n in cfg['blocos']:
            for i in range(n):
                yield bloco, i

    def votos(cor, bloco, i):
        return {f: dados[f][cor][bloco][i] for f in dados if cor in dados[f]}

    cores = [c for c in cfg['cores'] if any(c in d for d in dados.values())]
    concorda, total = Counter(), Counter()
    for cor in cores:
        for bloco, i in posicoes():
            v = votos(cor, bloco, i)
            contagem = Counter(v.values()).most_common()
            if len(contagem) == 1 or contagem[0][1] > contagem[1][1]:
                for f, letra in v.items():
                    total[f] += 1
                    concorda[f] += letra == contagem[0][0]
    ranking = sorted(dados, key=lambda f: (-wilson_inferior(concorda[f], total[f]), f))

    gabaritos, divergencias, empates = {}, {}, 0
    for cor in cores:
        g = {bloco: [] for bloco, _ in cfg['blocos']}
        div = {}
        for bloco, i in posicoes():
            v = votos(cor, bloco, i)
            contagem = Counter(v.values()).most_common()
            topo = [letra for letra, n in contagem if n == contagem[0][1]]
            if len(topo) == 1:
                escolhida, criterio = topo[0], 'maioria'
            else:
                empates += 1
                melhor = next(f for f in ranking if f in v and v[f] in topo)
                escolhida, criterio = v[melhor], f'desempate:{melhor}'
            g[bloco].append(escolhida)
            if len(contagem) > 1:
                div[rotulo(dia, bloco, i)] = {
                    'escolhida': escolhida,
                    'criterio': criterio,
                    'votos': {letra: sorted(f for f, x in v.items() if x == letra) for letra, _ in contagem},
                }
        gabaritos[cor] = {k: ''.join(v) for k, v in g.items()}
        divergencias[cor] = div

    # Invariante: mesmas letras por área em todas as cores.
    def assinatura(c):
        return tuple(tuple(sorted(Counter(c[b][ini:fim]).items())) for b, ini, fim in cfg['areas'])
    assinaturas = {cor: assinatura(gabaritos[cor]) for cor in cores}
    if len(set(assinaturas.values())) != 1:
        raise SystemExit(f'Dia {dia}: gabarito inconsistente entre as cores: {assinaturas}')

    saida = {
        'edicao': 2026,
        'dia': dia,
        'situacao': meta.get('situacao', 'extraoficial'),
        'atualizadoEm': meta['atualizadoEm'],
        'metodo': 'maioria',
        'empates': empates,
        'fontes': [
            {
                'id': f,
                **meta['fontes'][f],
                'cadernos': [c for c in cores if c in dados[f]],
                'concordancia': round(100 * concorda[f] / total[f], 1),
                'questoesComparadas': total[f],
                'confiabilidade': round(100 * wilson_inferior(concorda[f], total[f]), 1),
            }
            for f in ranking
        ],
        'gabaritos': gabaritos,
        'divergencias': divergencias,
    }
    js = (
        '// Arquivo gerado por tools/consolidar_gabarito.py — não edite à mão.\n'
        f'// Gabarito do {dia}º dia do ENEM 2026, consolidado por maioria entre as fontes.\n'
        'export default ' + json.dumps(saida, ensure_ascii=False, indent=1) + ';\n'
    )
    (RAIZ / 'data' / f'gabarito-2026-dia{dia}.js').write_text(js, encoding='utf-8')
    print(f'dia {dia}: {len(dados)} fontes, {empates} empates, ranking {ranking}')


def main():
    args = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    args.add_argument('--dia', type=int, choices=[1, 2])
    dia = args.parse_args().dia
    for d in ([dia] if dia else [1, 2]):
        consolidar(d)


if __name__ == '__main__':
    main()
