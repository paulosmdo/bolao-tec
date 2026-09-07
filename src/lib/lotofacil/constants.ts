import type { AppConfig } from "./types";

export const ALL_NUMBERS = Array.from({ length: 25 }, (_, i) => i + 1);
export const GAME_SIZE = 15;

/**
 * Volante 5x5:
 *   1  2  3  4  5
 *   6  7  8  9 10
 *  11 12 13 14 15
 *  16 17 18 19 20
 *  21 22 23 24 25
 *
 * Moldura = 16 dezenas das bordas. Miolo = 9 dezenas centrais.
 * Valor esperado de dezenas da moldura num sorteio: 15 * 16/25 = 9,6
 * — por isso o filtro aceita 9 ou 10.
 */
export const MOLDURA = new Set([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25]);
export const MIOLO = new Set([7, 8, 9, 12, 13, 14, 17, 18, 19]);

/** Linhas e colunas do volante — usadas pela estratégia Anti-Multidão */
export const VOLANTE_LINES: number[][] = [
  // linhas
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25],
  // colunas
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [5, 10, 15, 20, 25],
];

/** Soma esperada de 15 dezenas uniformes: 15 * 13 = 195. Faixa histórica típica: */
export const SUM_MIN = 180;
export const SUM_MAX = 210;

/**
 * Ímpares no volante: 13 de 25 → esperado 15 * 13/25 = 7,8 ímpares.
 * O filtro aceita 7 ou 8 ímpares (logo 8 ou 7 pares).
 */
export const ODD_COUNTS_OK = new Set([7, 8]);
export const FRAME_MIN = 9;
export const FRAME_MAX = 10;

/** Prêmios fixos vigentes (confirmados no rateio da API em jul/2026) */
export const FIXED_PRIZES: Record<number, number> = {
  11: 7,
  12: 14,
  13: 35,
};

export const DEFAULT_CONFIG: AppConfig = {
  gamesPerCombo: 3,
  drawsWindow: 10,
  ticketPrice: 3.5,
  strategies: {
    weighted: true,
    strongBase: true,
    modalRepeat: true,
    antiCrowd: true,
    statProfile: true,
  },
  filters: { oddEven: true, frame: true, sum: true },
  profileWindow: 100,
  profileSigma: 1,
  dispersion: true,
};

export const STRATEGY_LABELS: Record<string, string> = {
  weighted: "Roleta Viciada (pesos por frequência)",
  strongBase: "Base Forte (10 fixos + 5 aleatórios)",
  modalRepeat: "Repetição Modal (9 do último + 6 ausentes)",
  antiCrowd: "Anti-Multidão (evita jogos populares)",
  statProfile: "Perfil Estatístico (filtros rígidos ±1σ dos últimos 100)",
  legacy: "Estratégia antiga (migrado)",
};

export const FILTER_LABELS: Record<string, string> = {
  oddEven: "Equilíbrio Ímpares/Pares (7-8)",
  frame: "Moldura (9-10 nas bordas)",
  sum: `Soma entre ${SUM_MIN} e ${SUM_MAX}`,
};
