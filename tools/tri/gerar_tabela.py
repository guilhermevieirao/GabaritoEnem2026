#!/usr/bin/env python3
"""Gera data/tri.js a partir dos agregados por ano (saída de agregar_microdados.py).

Uso:  python3 tools/tri/gerar_tabela.py tools/tri/agregado_2023.json tools/tri/agregado_2024.json
Para cada área e ano, guarda a distribuição de notas oficiais por número de acertos,
usando o número de questões válidas que a maioria dos participantes teve naquele ano.
"""
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CAMPOS = ['n', 'min', 'p10', 'p25', 'med', 'p75', 'p90', 'max']


def main():
    areas, participantes = {}, {}
    for caminho in sys.argv[1:]:
        ano = re.search(r'(\d{4})', Path(caminho).name).group(1)
        dados = json.loads(Path(caminho).read_text(encoding='utf-8'))
        for area, por_validas in dados.items():
            validas, tabela = max(por_validas.items(), key=lambda kv: sum(v['n'] for v in kv[1].values()))
            participantes.setdefault(ano, {})[area] = sum(v['n'] for v in tabela.values())
            areas.setdefault(area, {})[ano] = {
                'validas': int(validas),
                'linhas': {k: [tabela[k][c] for c in CAMPOS] for k in sorted(tabela, key=int)},
            }
    saida = {
        'fonte': 'Microdados do ENEM (INEP)',
        'anos': sorted(participantes),
        'participantes': participantes,
        'campos': CAMPOS,
        'areas': areas,
    }
    js = (
        '// Arquivo gerado por tools/tri/gerar_tabela.py — não edite à mão.\n'
        '// Distribuição das notas oficiais por número de acertos, por área e ano (microdados do INEP).\n'
        'export default ' + json.dumps(saida, ensure_ascii=False, separators=(',', ':')) + ';\n'
    )
    (RAIZ / 'data' / 'tri.js').write_text(js, encoding='utf-8')
    print('ok', {ano: v for ano, v in participantes.items()})


if __name__ == '__main__':
    main()
