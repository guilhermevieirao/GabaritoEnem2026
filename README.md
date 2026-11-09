# Gabarito ENEM 2026

Corretor do ENEM 2026 que roda inteiro no navegador. Você marca as alternativas do seu caderno e vê os acertos por área, as questões em que os cursinhos discordam e uma estimativa da nota pela TRI.

**Site:** https://guilhermevieirao.github.io/GabaritoEnem2026/

- **1º dia (8/11):** gabarito extraoficial consolidado de 7 correções de cursinhos.
- **2º dia (15/11):** estrutura pronta. Dá para preencher e guardar as respostas antes do gabarito sair; a correção aparece sozinha quando ele for publicado aqui.

Sucessor do [GabaritoEnem2025](https://github.com/guilhermevieirao/GabaritoEnem2025), refeito do zero.

## O que o site faz

- Correção dos cadernos Azul, Amarelo, Branco e Verde (1º dia, com Inglês ou Espanhol) e Azul, Amarelo, Cinza e Verde (2º dia), com numeração contínua (91 a 180 no 2º dia).
- Dois jeitos de preencher: **uma questão por vez**, com a correção na hora (som e brilho opcionais), ou **cartão-resposta**, preenchendo tudo e corrigindo no fim.
- **Colar respostas** em lote: sequência (`ABCDE-AB…`, com `-` para questão em branco) ou lista numerada (`1-A 2-C…`), com prévia do que foi reconhecido antes de aplicar.
- **Questão em branco** como resposta própria, diferente de "não respondida".
- **Cartão-resposta sempre à vista**, que permite pular para qualquer questão e trocar qualquer resposta, inclusive depois do resultado.
- **Resultado** com boletim por área (Linguagens, com a língua estrangeira em separado, e Humanas; no 2º dia, Natureza e Matemática), **nota provável pela TRI** com a faixa de quem teve os mesmos acertos, média com a nota da redação (opcional), cartão corrigido mostrando o gabarito nos erros e lista de **questões em disputa** com os votos de cada cursinho.
- **PDF** do resultado, **compartilhar** (ou copiar) um resumo, **corrigir de novo** com o mesmo caderno.
- Tudo salvo automaticamente **no próprio aparelho**: dá para fechar a aba e continuar depois. Nada é enviado para servidor.
- Questões anuladas são puladas e não contam no total.
- Tema claro, escuro ou automático; funciona offline depois da primeira visita (service worker); instalável como app.
- Atalhos: `A`–`E` ou `1`–`5` respondem, `-` deixa em branco, `←` `→` navegam, `Backspace` volta, `Enter` avança. Os atalhos não disparam enquanto você digita num campo nem com `Ctrl`, `Alt` ou `⌘`, e segurar a tecla não responde várias questões.

### O que foi corrigido em relação à versão de 2025

| Problema na versão anterior | Como ficou |
|---|---|
| Caderno Verde do 2º dia sem uma das três questões anuladas | Teste automático exige o mesmo número de anuladas e a mesma contagem de letras por área em todas as cores |
| Resultado reaberto contava questão anulada como acerto (90/90 em vez de 88/88) | Um único cálculo (`corrigir`) para tela, resultado salvo e PDF; o resultado é recalculado a partir das respostas |
| Textos cinza-escuro sobre fundo escuro, ilegíveis | Paleta própria com contraste conferido por teste em todas as telas, nos dois temas |
| Cards de desempenho por área nunca apareciam | Boletim por área sempre visível, testado |
| Digitar no "Inserir respostas" respondia questões por trás e o Backspace desfazia respostas | Atalhos ignorados em campos de texto e com diálogo aberto |
| `Ctrl+C`/`Ctrl+A` e tecla segurada marcavam respostas | Ignorados |
| Sons hospedados em outro site, fora do ar | Sons gerados no próprio navegador |
| PDF com símbolos quebrados, áreas contando anuladas e numeração 1–90 no 2º dia | Marcas desenhadas, mesmo cálculo da tela e numeração 91–180 |
| "Recomeçar" no 2º dia mostrava "Questão 1 de 90" | Numeração única em todo o fluxo |
| Voltar a partir de uma anulada caía nela como questão normal | Navegação por índice; a anulada sempre mostra o aviso |
| Um clique errado na última questão encerrava a prova sem volta | O resultado só sai quando você pede, e toda resposta pode ser editada |
| Recarregar a página perdia tudo; "Início" apagava sem perguntar | Salvamento a cada resposta e confirmação antes de apagar |
| Título genérico, sem descrição nem prévia ao compartilhar | Título, descrição, imagem de prévia (Open Graph), ícone e manifest |
| Tela de escolha de ano com uma opção só e quatro telas até começar | Uma tela de configuração com dia, cor, língua e modo |

## Como o gabarito é montado

Enquanto o INEP não publica o gabarito oficial, o site usa o consenso das correções extraoficiais:

1. Cada correção é transcrita da fonte original para `data/fontes/2026-dia1/<fonte>.json`. As fontes e links estão em `_fontes.json`.
2. `tools/consolidar_gabarito.py` escolhe, em cada questão de cada caderno, a alternativa da **maioria** das fontes que publicaram aquele caderno.
3. **Empate:** vence a fonte mais confiável, ou seja, a que mais concorda com o consenso nas outras questões. A medida é o limite inferior do intervalo de Wilson (95%), para que uma fonte que publicou um caderno só não passe à frente das que corrigiram os quatro. No 1º dia não houve nenhum empate.
4. Como as cores trazem as mesmas questões em outra ordem, o script confere que a quantidade de cada letra por área é igual em todas as cores e aborta se não for.
5. Questões em que pelo menos duas fontes apontam outra letra aparecem no site como **em disputa**, com os votos.

Fontes do 1º dia: Anglo (via GCMais), Bernoulli Educação (via A Tarde / O Tempo), SAS Educação + Colégio Ari de Sá (via CNN Brasil), Chromos (via Itatiaia), Elite + Amplia (via O Globo), Estratégia Vestibulares (caderno amarelo) e Alvo ENEM (caderno branco). A taxa de concordância de cada uma aparece na página "Como funciona".

### Atualizar o gabarito

- **Correção nova ou revisada de um cursinho:** edite ou crie o JSON da fonte, ajuste `_fontes.json` e rode `npm run gabarito` (ou `python3 tools/consolidar_gabarito.py`).
- **2º dia:** siga `data/fontes/2026-dia2/LEIA-ME.md` e rode `python3 tools/consolidar_gabarito.py --dia 2`. Quem já tinha preenchido vê a correção ao abrir o site.
- **Gabarito oficial do INEP:** crie uma fonte `inep.json` sozinha na pasta do dia (ou mova as outras para fora), marque as anuladas com `X` e coloque `"situacao": "oficial"` em `_fontes.json`.
- A cada publicação, mude `VERSAO` em `sw.js` para os aparelhos buscarem os arquivos novos.

## Como a nota é estimada (TRI)

A nota do ENEM depende de quais questões você acertou, não só de quantas, e os parâmetros de dificuldade dos itens de 2026 só saem nos microdados, meses depois. Por isso:

- `tools/tri/agregar_microdados.py` lê as **notas oficiais de quase 6 milhões de participações** do ENEM 2023 e 2024 direto dos microdados do INEP (por requisições HTTP parciais, sem baixar os arquivos inteiros) e agrupa por número de acertos em cada área.
- `tools/tri/gerar_tabela.py` grava `data/tri.js`. A **nota provável** é a média, entre os dois anos, da mediana de quem teve o mesmo número de acertos; o site mostra também as faixas de 50% e 80%.
- `tools/tri/validar_modelo.py` mostra que o cálculo do INEP foi entendido: com os parâmetros dos itens de 2024 (modelo de 3 parâmetros sem a constante 1,7, estimativa EAP com priori normal e conversão linear própria de cada área), as notas oficiais são reproduzidas com erro médio de 0,02 ponto. Quando os microdados de 2026 saírem, o mesmo cálculo pode dar a nota exata.

## Rodar localmente

Não há etapa de build. Qualquer servidor estático serve:

```bash
python3 -m http.server 8000
```

Abra http://localhost:8000.

## Testes

```bash
npm ci
```

```bash
npx playwright install chromium
```

```bash
npm test
```

```bash
npm run test:e2e
```

`npm test` cobre a lógica e a integridade dos dados (inclusive a checagem entre cores). `npm run test:e2e` abre o site no Chromium e reproduz cada problema da versão anterior para garantir que ele não volta, além de conferir contraste, celular a 390 px e nomes acessíveis. O GitHub Actions roda tudo a cada push.

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.

## Estrutura

```
index.html               casca da página, metadados e diálogos
assets/css/app.css       estilos (tokens, temas claro e escuro)
assets/js/core.js        lógica pura: gabarito, correção, lote, TRI, disputas
assets/js/app.js         telas, rotas, teclado e armazenamento local
assets/js/pdf.js         relatório em PDF (jsPDF carregado sob demanda)
assets/js/som.js         sons gerados com Web Audio
data/enem2026.js         dias, áreas e cores da edição
data/gabarito-2026-*.js  gabaritos consolidados (gerados)
data/tri.js              distribuição de notas por acertos (gerada)
data/fontes/             transcrição de cada correção extraoficial
tools/                   scripts de consolidação, TRI e imagens
tests/                   testes de lógica e de navegador
```

## Créditos e licenças de terceiros

- Fontes [Atkinson Hyperlegible Next e Mono](https://github.com/googlefonts/atkinson-hyperlegible-next), do Braille Institute, sob a SIL Open Font License (`assets/fonts/OFL.txt`).
- [jsPDF](https://github.com/parallax/jsPDF) 3.0.3, licença MIT.
- Microdados do ENEM: INEP.

Este site não tem relação com o INEP. Gabarito e nota são estimativas; o resultado oficial é o divulgado pelo INEP.
