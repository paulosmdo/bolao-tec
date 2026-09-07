import { FIXED_PRIZES } from "./constants";
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

/** Prêmio fixo (11 a 13 acertos). Retorna null para 14/15 (prêmio variável). */
export function fixedPrizeFor(hits: number): number | null {
  if (hits >= 14) return null;
  return FIXED_PRIZES[hits] ?? 0;
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
      summary.totalSpent += ticketPrice;
      const hits = countHits(game.numbers, combo.result!.drawnNumbers);
      summary.hitsDistribution[hits] = (summary.hitsDistribution[hits] ?? 0) + 1;
      const prize = fixedPrizeFor(hits);
      if (prize === null) summary.variablePrizeGames += 1;
      else summary.totalFixedWon += prize;
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
