# Sistema visual

O mundo do site é o **cartão-resposta do ENEM**: bolhas A–E preenchidas com caneta preta, a faixa colorida da capa do caderno e a correção feita a caneta (traço verde de acerto, X vermelho de erro, anel verde na alternativa certa).

## Princípios

- É uma ferramenta de tarefa. A pessoa chega logo depois da prova, quase sempre no celular e à noite: o importante é começar rápido, não errar o toque e entender o resultado de primeira.
- **A cor do caderno escolhido tinge a interface** (faixa do topo, barra de progresso, linha atual do cartão, faixa da TRI). Fora isso, a paleta é neutra.
- Cor nunca carrega sentido sozinha: acerto, erro, em branco e anulada também têm ícone ou texto.

## Tokens

Definidos em `:root` de `assets/css/app.css`, com variantes para `[data-tema='escuro']` e `prefers-color-scheme: dark`.

| Papel | Claro | Escuro |
|---|---|---|
| Fundo / superfície | `#f4f5f7` / `#ffffff` | `#0d0f12` / `#16191e` |
| Tinta / secundária / terciária | `#14171c` / `#434a55` / `#5f6772` | `#eceef1` / `#b9bfc8` / `#959ca7` |
| Acerto | `#14773a` sobre `#e2f3e8` | `#5ad38a` sobre `#123323` |
| Erro | `#bf2626` sobre `#fbe4e4` | `#ff8080` sobre `#3b1818` |
| Anulada | `#8a5300` sobre `#fbedd4` | `#f7c25a` sobre `#3a2a0b` |
| Disputa | `#5b45c4` | `#b3a3ff` |

Cores dos cadernos: azul `#2f6fd6`, amarelo `#f2c230`, branco `#f4f4f1`, cinza `#8b919a`, verde `#17834a`.

O teste `tests/e2e.mjs` mede o contraste de todo texto visível (4,5:1, ou 3:1 para texto grande) nas quatro telas e nos dois temas.

## Tipografia

- **Atkinson Hyperlegible Next** para toda a interface, feita para legibilidade e para distinguir letras parecidas.
- **Atkinson Hyperlegible Mono** para dados: números de questão, letras das alternativas, acertos e notas (algarismos tabulares).
- Escala de 1,2: 13 / 14 / 16 / 19 / 23 / 28 / 34 / 42 px. Só o título da página inicial é fluido.

## Componentes

- **Bolha** (`.bolha`, `.mini`): círculo com a letra; preenchida em `--bolha`. Na correção na hora, o traço é desenhado sobre a bolha (`stroke-dashoffset`).
- **Capa de caderno** (`.caderno-capa`): miniatura com lombada mais escura; a selecionada sobe e ganha anel.
- **Boletim** (`.boletim`): tabela por área; no celular vira lista. A faixa da TRI tem eixo de 250 a 1000 pontos, faixa de 80% clara, faixa de 50% escura e marcador na mediana.
- **Botões**: primário (tinta), cor do caderno, perigo, fantasma; alvo mínimo de 44 px.

## Movimento

Transições de 160 a 240 ms com saída exponencial. Um único momento marcante: o traço da correção desenhado na bolha. Tudo respeita `prefers-reduced-motion` e a preferência "Efeitos visuais".
