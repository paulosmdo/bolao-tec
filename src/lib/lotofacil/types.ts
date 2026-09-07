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
  | "legacy";
export type FilterId = "oddEven" | "frame" | "sum";

export interface GeneratedGame {
  numbers: number[];
  strategy: StrategyId;
  /** Filtros que precisaram ser desligados para o jogo terminar de ser gerado */
  relaxedFilters: FilterId[];
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
  /** Quantos concursos passados entram na análise de frequência */
  drawsWindow: number;
  /** Preço da aposta de 15 dezenas (R$) — usado no cálculo de ROI */
  ticketPrice: number;
  strategies: {
    weighted: boolean;
    strongBase: boolean;
    modalRepeat: boolean;
    antiCrowd: boolean;
  };
  filters: { oddEven: boolean; frame: boolean; sum: boolean };
  /**
   * Fechamento por Dispersão: gera 4x mais candidatos e seleciona os N jogos
   * com a menor sobreposição possível entre si (greedy max-min)
   */
  dispersion: boolean;
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
