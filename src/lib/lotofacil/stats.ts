import { FIXED_PRIZES, GAME_SIZE } from "./constants";
import type { Combo, Draw, RoiSummary } from "./types";

/** Frequência de saída de cada dezena numa janela de concursos */
export function buildFrequency(draws: Draw[]): Map<number, number> {
  const freq = new Map<number, number>();
  draws.forEach((draw) => {
    draw.listaDezenas.forEach((d) => {
      const n = parseInt(d, 10);
      freq.set(n, (freq.get(n) ?? 0) + 1);
    });
  });
  return freq;
}

export function countHits(game: number[], drawn: number[]): number {
  const drawnSet = new Set(drawn);
  return game.filter((n) => drawnSet.has(n)).length;
}

/** Prêmio fixo (11 a 13 acertos) de um jogo de 15. Retorna null para 14/15 (prêmio variável). */
export function fixedPrizeFor(hits: number): number | null {
  if (hits >= 14) return null;
  return FIXED_PRIZES[hits] ?? 0;
}

/** Coeficiente binomial C(n, k) — 0 fora do domínio */
export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Um bilhete de `size` dezenas equivale a C(size, 15) apostas simples */
export const ticketCombinations = (size: number) => combinations(size, GAME_SIZE);

/** Custo do bilhete: preço da aposta de 15 × número de apostas embutidas */
export const ticketCost = (size: number, ticketPrice: number) =>
  ticketPrice * ticketCombinations(size);

export interface TicketPrize {
  /** Soma dos prêmios fixos (11–13) de todas as apostas embutidas */
  fixed: number;
  /** Alguma aposta embutida fez 14 ou 15 (prêmio rateado, não estimável) */
  variable: boolean;
}

/**
 * Prêmio de um bilhete de `size` dezenas com `hits` acertos (desdobramento):
 * das C(size,15) apostas embutidas, C(hits, j) · C(size − hits, 15 − j) fazem
 * exatamente j acertos. Para size = 15 reproduz fixedPrizeFor.
 */
export function ticketPrize(size: number, hits: number): TicketPrize {
  let fixed = 0;
  let variable = false;
  for (let j = 11; j <= GAME_SIZE; j++) {
    const count = combinations(hits, j) * combinations(size - hits, GAME_SIZE - j);
    if (count === 0) continue;
    if (j >= 14) variable = true;
    else fixed += count * (FIXED_PRIZES[j] ?? 0);
  }
  return { fixed, variable };
}

/**
 * ROI sobre prêmios fixos, calculado apenas sobre combos já conferidos.
 * Jogos com 14/15 acertos são contados à parte (prêmio variável milionário
 * que não dá para estimar automaticamente).
 */
export function computeRoi(combos: Combo[], ticketPrice: number): RoiSummary {
  const summary: RoiSummary = {
    combosChecked: 0,
    gamesChecked: 0,
    totalSpent: 0,
    totalFixedWon: 0,
    roiPct: 0,
    hitsDistribution: {},
    variablePrizeGames: 0,
  };

  combos.forEach((combo) => {
    if (!combo.result) return;
    summary.combosChecked += 1;
    combo.games.forEach((game) => {
      summary.gamesChecked += 1;
      summary.totalSpent += ticketCost(game.numbers.length, ticketPrice);
      const hits = countHits(game.numbers, combo.result!.drawnNumbers);
      summary.hitsDistribution[hits] = (summary.hitsDistribution[hits] ?? 0) + 1;
      const prize = ticketPrize(game.numbers.length, hits);
      if (prize.variable) summary.variablePrizeGames += 1;
      summary.totalFixedWon += prize.fixed;
    });
  });

  summary.roiPct =
    summary.totalSpent > 0
      ? ((summary.totalFixedWon - summary.totalSpent) / summary.totalSpent) * 100
      : 0;

  return summary;
}

/**
 * Próximo concurso com final 0 (onde acumulam 10% de todos os sorteios).
 * Usa o campo oficial da API quando disponível; senão calcula o próximo
 * múltiplo de 10 a partir do próximo concurso.
 */
export function nextFinalZeroContest(ultimo: Draw): number {
  const next = ultimo.numeroConcursoProximo;
  const apiSpecial = ultimo.numeroConcursoFinal_0_5;
  if (apiSpecial && apiSpecial % 10 === 0 && apiSpecial >= next) return apiSpecial;
  return Math.ceil(next / 10) * 10;
}

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
