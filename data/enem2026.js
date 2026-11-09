// Estrutura da edição: dias, áreas, cores de caderno e de onde vem cada gabarito.
// Os gabaritos vêm de tools/consolidar_gabarito.py (veja o README, seção "Atualizar o gabarito").
import gabaritoDia1 from './gabarito-2026-dia1.js';
import gabaritoDia2 from './gabarito-2026-dia2.js';

export const CORES = {
  azul: { nome: 'Azul', hex: '#2f6fd6' },
  amarelo: { nome: 'Amarelo', hex: '#f2c230' },
  branco: { nome: 'Branco', hex: '#f4f4f1' },
  cinza: { nome: 'Cinza', hex: '#8b919a' },
  verde: { nome: 'Verde', hex: '#1f9a57' },
};

export default {
  edicao: 2026,
  dias: {
    1: {
      numero: 1,
      data: '2026-11-08',
      titulo: 'Linguagens e Ciências Humanas',
      temLinguaEstrangeira: true,
      cores: ['azul', 'amarelo', 'branco', 'verde'],
      areas: [
        {
          id: 'LC',
          nome: 'Linguagens, Códigos e suas Tecnologias',
          curto: 'Linguagens',
          inicio: 1,
          fim: 45,
          sub: [{ id: 'LE', nome: 'Língua estrangeira', curto: 'Língua estrangeira', inicio: 1, fim: 5 }],
        },
        { id: 'CH', nome: 'Ciências Humanas e suas Tecnologias', curto: 'Humanas', inicio: 46, fim: 90 },
      ],
      situacao: gabaritoDia1.situacao,
      atualizadoEm: gabaritoDia1.atualizadoEm,
      fontes: gabaritoDia1.fontes,
      gabaritos: gabaritoDia1.gabaritos,
      divergencias: gabaritoDia1.divergencias,
    },
    2: {
      numero: 2,
      data: '2026-11-15',
      titulo: 'Ciências da Natureza e Matemática',
      temLinguaEstrangeira: false,
      // Cores do 2º dia na edição anterior; confirme na capa do caderno no dia da prova.
      cores: ['azul', 'amarelo', 'cinza', 'verde'],
      areas: [
        { id: 'CN', nome: 'Ciências da Natureza e suas Tecnologias', curto: 'Natureza', inicio: 91, fim: 135 },
        { id: 'MT', nome: 'Matemática e suas Tecnologias', curto: 'Matemática', inicio: 136, fim: 180 },
      ],
      liberacaoPrevista: '2026-11-15T19:00:00-03:00',
      situacao: gabaritoDia2?.situacao ?? 'pendente',
      atualizadoEm: gabaritoDia2?.atualizadoEm ?? null,
      fontes: gabaritoDia2?.fontes ?? [],
      // Formato: { azul: { questoes: 'ABCDE…' (90 letras, X = anulada) }, … }
      gabaritos: gabaritoDia2?.gabaritos ?? null,
      divergencias: gabaritoDia2?.divergencias ?? {},
    },
  },
};
