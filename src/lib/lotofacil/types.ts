/** Resultado de um concurso, subconjunto do payload da api.guidi.dev.br */
export interface Draw {
  numero: number;
  listaDezenas: string[];
  dataApuracao: string;
  dataProximoConcurso?: string;
  numeroConcursoAnterior: number;
  numeroConcursoProximo: number;
  /** Próximo concurso especial (final 0 ou 5) informado pela própria API */
  numeroConcursoFinal_0_5?: number;
  /** Valor já acumulado para o próximo concurso final 0/5 */
  valorAcumuladoConcurso_0_5?: number;
  acumulado?: boolean;
  valorEstimadoProximoConcurso?: number;
  listaRateioPremio?: {
    descricaoFaixa: string;
    faixa: number;
    numeroDeGanhadores: number;
    valorPremio: number;
  }[];
}

export type StrategyId =
  | "weighted"
  | "strongBase"
  | "modalRepeat"
  | "antiCrowd"
  | "statProfile"
  | "matrix"
  | "legacy";
export type FilterId = "oddEven" | "frame" | "sum";

export interface GeneratedGame {
  numbers: number[];
  strategy: StrategyId;
  /** Filtros que precisaram ser desligados para o jogo terminar de ser gerado */
  relaxedFilters: FilterId[];
  /** Etapa de fechamento que reconstruiu o bilhete (opcional) */
  closing?: "matrix";
}

export interface Combo {
  id: string;
  createdAt: string; // ISO
  targetContest: number;
  games: GeneratedGame[];
  /** Preenchido quando o combo é conferido contra o resultado oficial */
  result?: {
    drawnNumbers: number[];
    checkedAt: string;
  };
}

export interface AppConfig {
  /** Quantos jogos gerar por combo */
  gamesPerCombo: number;
  /** Dezenas por jogo (15–20). Acima de 15 o bilhete custa C(n,15) apostas. */
  numbersPerGame: number;
  /** Quantos concursos passados entram na análise de frequência */
  drawsWindow: number;
  /** Preço da aposta de 15 dezenas (R$) — bilhete de n dezenas custa C(n,15) × este valor */
  ticketPrice: number;
  strategies: {
    weighted: boolean;
    strongBase: boolean;
    modalRepeat: boolean;
    antiCrowd: boolean;
    statProfile: boolean;
  };
  filters: { oddEven: boolean; frame: boolean; sum: boolean };
  /** Base Forte: quantas dezenas mais frequentes entram fixas (1–14, padrão 10) */
  strongBaseFixed: number;
  /** Repetição Modal: quantas dezenas do último concurso repetir (5–15, padrão 9, ±1) */
  modalRepeatCount: number;
  /**
   * Quantos concursos passados alimentam o Perfil Estatístico (bandas de
   * ímpares, primos, Fibonacci, soma e repetição). 100 é o padrão.
   */
  profileWindow: number;
  /**
   * Largura das bandas do Perfil Estatístico em desvios padrão (1 = rígido,
   * aceita ~1/3 do espaço; 2 = folgado, aceita ~90%).
   */
  profileSigma: number;
  /**
   * Fechamento por Dispersão: gera 4x mais candidatos e seleciona os N jogos
   * com a menor sobreposição possível entre si (greedy max-min)
   */
  dispersion: boolean;
  /**
   * Fechamento por Matriz Combinatória: fixa as dezenas mais frequentes em
   * todos os bilhetes e distribui o restante com sobreposição mínima.
   */
  matrixClosing: boolean;
  /** Quantas dezenas fortes ficam fixas no Fechamento por Matriz (5–12) */
  matrixFixedCount: number;
}

export interface RoiSummary {
  combosChecked: number;
  gamesChecked: number;
  totalSpent: number;
  totalFixedWon: number;
  /** ROI em % considerando apenas prêmios fixos (14/15 acertos são variáveis) */
  roiPct: number;
  hitsDistribution: Record<number, number>;
  /** Jogos com 14 ou 15 acertos, cujo prêmio é variável e não entra no ROI fixo */
  variablePrizeGames: number;
}
