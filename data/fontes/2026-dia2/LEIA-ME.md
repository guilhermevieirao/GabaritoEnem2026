# Fontes do 2º dia

Para cada cursinho, crie um arquivo `<id>.json` nesta pasta, com as cores que ele publicou:

```json
{
 "azul": { "questoes": "90 letras, da questão 91 à 180 (X = anulada)" },
 "cinza": { "questoes": "…" }
}
```

Registre o cursinho em `_fontes.json` (`nome`, `via`, `url`, `horario`), atualize `atualizadoEm`
e rode `python3 tools/consolidar_gabarito.py --dia 2`. O script vota por maioria, confere que as
cores batem entre si e grava `data/gabarito-2026-dia2.js`. O site passa a corrigir o 2º dia na hora,
inclusive as respostas que as pessoas já tinham preenchido.
