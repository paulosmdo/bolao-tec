import { ALL_NUMBERS, GAME_SIZE, clampGameSize } from "./constants";
import type { GeneratedGame } from "./types";

/**
 * Fechamento por Matriz Combinatória — etapa OPCIONAL de pós-processamento.
 *
 * Recebe os jogos já gerados (e filtrados) e devolve `gamesCount` bilhetes
 * reconstruídos assim:
 *
 *   bilhete = FIXAS ∪ BLOCO
 *
 *   FIXAS  = as `fixedCount` dezenas mais frequentes da janela (entram em
 *            TODOS os bilhetes — "dezenas fortes").
 *   BLOCO  = as (15 − fixedCount) dezenas restantes, escolhidas entre as
 *            outras (25 − fixedCount) de modo que dois bilhetes quaisquer
 *            compartilhem o MÍNIMO possível fora das fixas, e que cada
 *            dezena variável apareça um número parecido de vezes (cobertura
 *            balanceada — a "matriz").
 *
 * Como o universo variável é pequeno (≤ C(17,7) = 19 448 blocos), a matriz é
 * montada por enumeração completa de todos os blocos possíveis + seleção
 * gulosa: a cada passo entra o bloco de menor custo, onde
 *
 *   custo = W · (maior sobreposição com os blocos já escolhidos)
 *         + Σ (quantas vezes cada dezena do bloco já foi usada)
 *
 * O primeiro termo evita bilhetes "quase iguais" (Jogo 1 = 2,3,5,10,15 e
 * Jogo 2 = 2,3,5,10,14); o segundo espalha as dezenas variáveis por igual
 * (Jogo 1 = 2,3,5,9,19 e Jogo 2 = 2,3,5,11,20). W = tamanho do bloco, então
 * a sobreposição sempre domina o desempate.
 *
 * Os jogos gerados são a PRIMEIRA fonte de blocos: se o bloco derivado de um
 * jogo gerado tem custo igual ao melhor bloco da matriz, ele é preferido
 * (mantém a estratégia de origem). Só quando nenhum jogo gerado serve é que
 * um bloco sintético da matriz entra, marcado com strategy "matrix".
 *
 * Determinístico para a mesma entrada; termina sempre (laços finitos).
 * Não altera nenhuma função existente do gerador.
 */
export interface MatrixClosingOptions {
  /** Quantos bilhetes devolver */
  gamesCount: number;
  /** Quantas dezenas fortes ficam fixas em todos os bilhetes (5 até size − 3) */
  fixedCount: number;
  /** Dezenas por bilhete (15–20). Padrão: tamanho dos candidatos, ou 15. */
  gameSize?: number;
}

export interface MatrixClosingResult {
  games: GeneratedGame[];
  fixedNumbers: number[];
  /** Sobreposição máxima entre blocos variáveis de dois bilhetes quaisquer */
  maxBlockOverlap: number;
}

const MIN_FIXED = 5;
/** Deixa pelo menos 3 dezenas variáveis por bilhete */
const maxFixed = (size: number) => Math.max(MIN_FIXED, size - 3);

const bit = (n: number) => 1 << n;

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

const maskToNumbers = (mask: number): number[] =>
  ALL_NUMBERS.filter((n) => (mask & bit(n)) !== 0);

/** As `count` dezenas mais frequentes (empate: menor dezena) */
export function pickFixedNumbers(freq: Map<number, number>, count: number): number[] {
  return [...ALL_NUMBERS]
    .sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a - b)
    .slice(0, count)
    .sort((a, b) => a - b);
}

/** Todos os subconjuntos de tamanho `k` de `pool`, como máscaras de bits */
function enumerateBlocks(pool: number[], k: number): number[] {
  const out: number[] = [];
  const rec = (start: number, left: number, mask: number) => {
    if (left === 0) {
      out.push(mask);
      return;
    }
    for (let i = start; i <= pool.length - left; i++) {
      rec(i + 1, left - 1, mask | bit(pool[i]));
    }
  };
  rec(0, k, 0);
  return out;
}

export function applyMatrixClosing(
  candidates: GeneratedGame[],
  freq: Map<number, number>,
  options: MatrixClosingOptions
): MatrixClosingResult {
  const gameSize = clampGameSize(
    options.gameSize ?? candidates[0]?.numbers.length ?? GAME_SIZE
  );
  const fixedCount = Math.min(
    Math.max(Math.round(options.fixedCount), MIN_FIXED),
    maxFixed(gameSize)
  );
  const blockSize = gameSize - fixedCount;
  const fixedNumbers = pickFixedNumbers(freq, fixedCount);
  const fixedMask = fixedNumbers.reduce((m, n) => m | bit(n), 0);
  const pool = ALL_NUMBERS.filter((n) => (fixedMask & bit(n)) === 0);
  const W = blockSize;

  // Blocos derivados dos jogos gerados: dezenas do jogo fora das fixas.
  // Se sobrar mais que blockSize, fica com as mais frequentes; se faltar,
  // completa com as dezenas menos usadas (resolvido na hora da seleção).
  const derived = candidates.map((game) => {
    const variable = game.numbers
      .filter((n) => (fixedMask & bit(n)) === 0)
      .sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a - b)
      .slice(0, blockSize);
    return { game, mask: variable.reduce((m, n) => m | bit(n), 0), size: variable.length };
  });

  const allBlocks = enumerateBlocks(pool, blockSize);
  const coverage = new Map<number, number>(pool.map((n) => [n, 0]));
  const selectedMasks: number[] = [];
  const usedDerived = new Set<number>();
  const games: GeneratedGame[] = [];
  let maxBlockOverlap = 0;

  const cost = (mask: number) => {
    let overlap = 0;
    for (const s of selectedMasks) overlap = Math.max(overlap, popcount(mask & s));
    let cov = 0;
    for (const n of maskToNumbers(mask)) cov += coverage.get(n) ?? 0;
    return { total: W * overlap + cov, overlap };
  };

  /** Completa um bloco derivado incompleto com as dezenas menos cobertas */
  const complete = (mask: number, size: number) => {
    let m = mask;
    const missing = [...pool]
      .filter((n) => (m & bit(n)) === 0)
      .sort((a, b) => (coverage.get(a) ?? 0) - (coverage.get(b) ?? 0) || a - b);
    for (let i = 0; i < blockSize - size; i++) m |= bit(missing[i]);
    return m;
  };

  const seen = new Set<number>();

  for (let step = 0; step < options.gamesCount; step++) {
    // melhor bloco da matriz (enumeração completa)
    let bestMatrix = -1;
    let bestMatrixCost = Infinity;
    let bestMatrixOverlap = 0;
    for (const mask of allBlocks) {
      if (seen.has(mask)) continue;
      const c = cost(mask);
      if (c.total < bestMatrixCost) {
        bestMatrixCost = c.total;
        bestMatrix = mask;
        bestMatrixOverlap = c.overlap;
      }
    }
    if (bestMatrix < 0) break; // matriz esgotada (só com gamesCount > nº de blocos)

    // melhor bloco derivado de um jogo gerado ainda não usado
    let bestDerivedIdx = -1;
    let bestDerivedMask = 0;
    let bestDerivedCost = Infinity;
    let bestDerivedOverlap = 0;
    derived.forEach((d, idx) => {
      if (usedDerived.has(idx)) return;
      const mask = complete(d.mask, d.size);
      if (seen.has(mask)) return;
      const c = cost(mask);
      if (c.total < bestDerivedCost) {
        bestDerivedCost = c.total;
        bestDerivedIdx = idx;
        bestDerivedMask = mask;
        bestDerivedOverlap = c.overlap;
      }
    });

    const useDerived = bestDerivedIdx >= 0 && bestDerivedCost <= bestMatrixCost;
    const mask = useDerived ? bestDerivedMask : bestMatrix;
    const overlap = useDerived ? bestDerivedOverlap : bestMatrixOverlap;
    if (useDerived) usedDerived.add(bestDerivedIdx);

    seen.add(mask);
    selectedMasks.push(mask);
    maxBlockOverlap = Math.max(maxBlockOverlap, overlap);
    for (const n of maskToNumbers(mask)) coverage.set(n, (coverage.get(n) ?? 0) + 1);

    const source = useDerived ? derived[bestDerivedIdx].game : undefined;
    games.push({
      numbers: maskToNumbers(mask | fixedMask),
      strategy: source?.strategy ?? "matrix",
      relaxedFilters: source?.relaxedFilters ?? [],
      closing: "matrix",
    });
  }

  return { games, fixedNumbers, maxBlockOverlap };
}
