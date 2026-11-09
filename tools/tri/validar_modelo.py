#!/usr/bin/env python3
"""Reproduz as notas oficiais do ENEM a partir dos parâmetros dos itens publicados pelo INEP.

Serve para mostrar que o modelo usado pelo INEP é o que está descrito aqui:
- TRI de 3 parâmetros, P(acerto) = c + (1 - c) / (1 + exp(-a(θ - b))), sem a constante 1,7;
- estimativa EAP com priori normal padrão N(0, 1);
- nota = α + β·θ, com α e β próprios de cada área e edição (equalização à escala do ENEM).

Uso:
  python3 tools/tri/validar_modelo.py ITENS_PROVA_2024.csv amostra_RESULTADOS_2024.csv [linhas]

Com a amostra de 2024 o erro médio absoluto fica em ~0,02 ponto em todas as áreas.
Os parâmetros dos itens de 2026 só saem com os microdados, meses depois da prova; por isso o
site estima a nota de 2026 pela distribuição real de notas de quem teve o mesmo número de acertos
(veja agregar_microdados.py e gerar_tabela.py).
"""
import csv
import itertools
import sys
from collections import defaultdict

import numpy as np

QUAD = np.linspace(-6, 6, 481)


def carregar_itens(caminho):
    itens = defaultdict(list)
    for r in csv.DictReader(open(caminho, encoding='latin-1'), delimiter=';'):
        itens[r['CO_PROVA']].append(r)
    return itens


def itens_da_prova(itens, codigo, area, lingua=None):
    lista = sorted(itens[codigo], key=lambda r: int(r['CO_POSICAO']))
    if area == 'LC':
        le = [r for r in lista if r['TP_LINGUA'] != '' and int(r['TP_LINGUA']) == lingua]
        resto = [r for r in lista if r['TP_LINGUA'] == '']
        lista = le + resto
    return lista


def theta_eap(respostas, itens):
    log_l = np.zeros_like(QUAD)
    for x, it in zip(respostas, itens):
        if it['IN_ITEM_ABAN'] == '1' or not it['NU_PARAM_A']:
            continue
        a, b, c = float(it['NU_PARAM_A']), float(it['NU_PARAM_B']), float(it['NU_PARAM_C'])
        p = c + (1 - c) / (1 + np.exp(-a * (QUAD - b)))
        log_l += np.log(np.clip(p if x == it['TX_GABARITO'] else 1 - p, 1e-300, 1))
    w = log_l - 0.5 * QUAD ** 2
    post = np.exp(w - w.max())
    return float((post * QUAD).sum() / post.sum())


def main():
    itens = carregar_itens(sys.argv[1])
    limite = int(sys.argv[3]) if len(sys.argv) > 3 else 3000
    linhas = itertools.islice(csv.DictReader(open(sys.argv[2], encoding='latin-1'), delimiter=';'), limite)
    dados = defaultdict(lambda: ([], []))
    for r in linhas:
        for area in ('CN', 'CH', 'LC', 'MT'):
            if r[f'TP_PRESENCA_{area}'] != '1' or not r[f'NU_NOTA_{area}']:
                continue
            lingua = int(r['TP_LINGUA']) if area == 'LC' else None
            its = itens_da_prova(itens, r[f'CO_PROVA_{area}'], area, lingua)
            t, y = dados[area]
            t.append(theta_eap(r[f'TX_RESPOSTAS_{area}'], its))
            y.append(float(r[f'NU_NOTA_{area}']))
    for area, (t, y) in sorted(dados.items()):
        t, y = np.array(t), np.array(y)
        a = np.vstack([np.ones_like(t), t]).T
        coef, *_ = np.linalg.lstsq(a, y, rcond=None)
        res = np.abs(a @ coef - y)
        # Reajusta sem os poucos casos atípicos (provas adaptadas, por exemplo).
        ok = res < np.percentile(res, 99)
        coef, *_ = np.linalg.lstsq(a[ok], y[ok], rcond=None)
        res = np.abs(a @ coef - y)
        print(f'{area}: nota = {coef[0]:.2f} + {coef[1]:.2f}·θ   erro médio {res.mean():.3f}   '
              f'{(res < 0.15).mean() * 100:.1f}% dentro de 0,15 ponto   n={len(y)}')


if __name__ == '__main__':
    main()
