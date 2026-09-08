import {
  ALL_NUMBERS,
  GAME_SIZE,
  MOLDURA,
  VOLANTE_LINES,
  clampGameSize,
  frameBoundsFor,
  oddCountsFor,
  sumBoundsFor,
} from "./constants";
import { passesProfile, profileViolations, type StatProfile } from "./analysis";
import type { FilterId, GeneratedGame, StrategyId } from "./types";

/**
 * Orçamento de tentativas por jogo e por nível de relaxamento de filtros.
 * Uniforme, a chance de um sorteio passar nos 3 filtros fica em torno de 20%,
 * então 400 tentativas dão probabilidade de falha desprezível (< 1e-30).
 * Ainda assim, se o orçamento estourar (ex.: Base Forte com top-10 cheio de
 * miolo, que torna o filtro de moldura infactível), os filtros são relaxados
 * um a um — o algoritmo SEMPRE termina.
 */
const MAX_ATTEMPTS_PER_LEVEL = 400;

/** Ordem de relaxamento: solta primeiro o filtro mais restritivo/situacional */
const RELAX_ORDER: FilterId[] = ["sum", "frame", "oddEven"];

/** Fator de sobre-amostragem do Fechamento por Dispersão */
const DISPERSION_OVERSAMPLE = 4;

/**
 * Orçamento do Perfil Estatístico. A 1σ, ~1/3 dos candidatos passa nas 5
 * bandas, então 3000 tentativas falham com probabilidade ~(2/3)^3000 ≈ 0.
 * O laço para antes disso assim que reúne PROFILE_POOL aprovados.
 */
const PROFILE_MAX_ATTEMPTS = 3000;
const PROFILE_POOL = 6;

/** Filtros de padrão — as bandas dependem do tamanho do jogo (15 = histórico) */
const FILTER_FNS: Record<FilterId, (game: number[]) => boolean> = {
  oddEven: (game) =>
    oddCountsFor(game.length).has(game.filter((n) => n % 2 === 1).length),
  frame: (game) => {
    const [min, max] = frameBoundsFor(game.length);
    const inFrame = game.filter((n) => MOLDURA.has(n)).length;
    return inFrame >= min && inFrame <= max;
  },
  sum: (game) => {
    const [min, max] = sumBoundsFor(game.length);
    const sum = game.reduce((acc, n) => acc + n, 0);
    return sum >= min && sum <= max;
  },
};

const gameKey = (game: number[]) => game.join(",");

/**
 * Pesos com suavização de Laplace (+1): toda dezena tem chance > 0 mesmo que
 * não tenha saído na janela analisada. Garante que sempre existam 25
 * candidatas válidas para amostrar 15.
 */
export function buildWeights(freq: Map<number, number>): Map<number, number> {
  const weights = new Map<number, number>();
  ALL_NUMBERS.forEach((n) => weights.set(n, (freq.get(n) ?? 0) + 1));
  return weights;
}

/** Roleta viciada genérica: amostra k dezenas sem reposição, prob ∝ peso */
function weightedSample(weights: Map<number, number>, k: number): number[] {
  const pool: [number, number][] = Array.from(weights.entries());
  const picked: number[] = [];

  for (let i = 0; i < k && pool.length > 0; i++) {
    const total = pool.reduce((acc, [, w]) => acc + w, 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j][1];
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picked.push(pool[idx][0]);
    pool.splice(idx, 1);
  }

  return picked.sort((a, b) => a - b);
}

/** Amostra uniforme de `size` dezenas (Fisher-Yates parcial) */
function uniformGame(size = GAME_SIZE): number[] {
  const pool = [...ALL_NUMBERS];
  for (let i = pool.length - 1; i >= pool.length - size; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(pool.length - size).sort((a, b) => a - b);
}

/**
 * Estratégia 1 — Roleta Viciada (weighted random sampling sem reposição).
 * Dezenas quentes tendem a entrar, sem garantia — variância controlada,
 * nunca o mesmo jogo fixo.
 */
export function weightedRouletteGame(weights: Map<number, number>, size = GAME_SIZE): number[] {
  return weightedSample(weights, size);
}

/** Limites da Base Forte: todas fixas seria sempre o mesmo jogo */
export const STRONG_BASE_MIN = 1;
export const strongBaseMax = (size = GAME_SIZE) => size - 1;

/**
 * Estratégia 2 — Base Forte: as `fixedCount` dezenas mais frequentes entram
 * fixas (padrão 10) e as size − fixedCount restantes são sorteadas
 * uniformemente entre as que sobraram.
 */
export function strongBaseGame(
  freq: Map<number, number>,
  fixedCount = 10,
  size = GAME_SIZE
): number[] {
  const k = Math.min(Math.max(Math.round(fixedCount) || 10, STRONG_BASE_MIN), strongBaseMax(size));
  const fillCount = size - k;

  const sorted = ALL_NUMBERS
    .map((n) => [n, freq.get(n) ?? 0] as [number, number])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);

  const base = sorted.slice(0, k).map(([n]) => n);
  const rest = sorted.slice(k).map(([n]) => n);

  for (let i = rest.length - 1; i > rest.length - 1 - fillCount; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const fill = rest.slice(rest.length - fillCount);

  return [...base, ...fill].sort((a, b) => a - b);
}

/**
 * Estratégia 3 — Repetição Modal: a interseção entre dois concursos
 * consecutivos segue uma hipergeométrica (15 dezenas "do último" num universo
 * de 25, sorteando 15) com moda em 9: P(8)≈24%, P(9)≈32%, P(10)≈23% — juntas,
 * ~79% de todos os sorteios. A estratégia sorteia k ∈ {8,9,10} com essas
 * proporções, escolhe k repetidas do último concurso e completa com as
 * ausentes, ambas ponderadas pela frequência da janela.
 *
 * `repeatCount` desloca o centro (padrão 9): sorteia k ∈ {c−1, c, c+1} com as
 * mesmas proporções 30/41/29, limitado a [size − 10, 15] (o último concurso
 * tem 15 dezenas e só existem 10 ausentes para completar).
 */
export const MODAL_REPEAT_MAX = 15;
export const modalRepeatMin = (size = GAME_SIZE) => Math.max(5, size - (25 - GAME_SIZE));

export function modalRepeatGame(
  weights: Map<number, number>,
  lastDraw: number[],
  repeatCount = 9,
  size = GAME_SIZE
): number[] {
  const min = modalRepeatMin(size);
  const c = Math.min(Math.max(Math.round(repeatCount) || 9, min), MODAL_REPEAT_MAX);
  const r = Math.random();
  const k = Math.min(Math.max(r < 0.3 ? c - 1 : r < 0.71 ? c : c + 1, min), MODAL_REPEAT_MAX);

  const inLast = new Set(lastDraw);
  const lastPool = new Map<number, number>();
  const absentPool = new Map<number, number>();
  weights.forEach((w, n) => (inLast.has(n) ? lastPool : absentPool).set(n, w));

  const repeats = weightedSample(lastPool, k);
  const fresh = weightedSample(absentPool, size - k);
  return [...repeats, ...fresh].sort((a, b) => a - b);
}

/**
 * Pontuação de "popularidade" de um jogo — quanto maior, mais parecido com o
 * que apostadores humanos jogam em massa. Como os prêmios de 14/15 acertos
 * são RATEADOS, evitar jogos populares aumenta o prêmio condicional (é a
 * única alavanca real de EV numa loteria pari-mutuel).
 */
export function crowdScore(game: number[], lastDraw?: number[]): number {
  const set = new Set(game);
  const size = game.length;
  // Jogos maiores que 15 preenchem mais do volante: os limiares escalam com
  // o tamanho para que "popular" continue significando "acima do acaso".
  const extra = size - GAME_SIZE;
  let score = 0;

  // Sequências longas (ex.: 1,2,3,4,5): run de 4+ consecutivos
  let run = 1;
  for (let n = 2; n <= 25; n++) {
    if (set.has(n) && set.has(n - 1)) {
      run += 1;
      if (run >= 4) score += 1; // cada extensão além de 3 pontua
    } else {
      run = 1;
    }
  }

  // Linhas/colunas completas do volante (padrões visuais deliberados).
  // Com 15 marcas o acaso produz ~0,6 linha completa; 2+ é assinatura humana.
  const fullLines = VOLANTE_LINES.filter((line) => line.every((n) => set.has(n))).length;
  const linesThreshold = 2 + Math.round(extra * 0.6);
  if (fullLines >= linesThreshold) score += (fullLines - linesThreshold + 1) * 2;

  // Quase-cópia do último resultado (muita gente repete o concurso anterior)
  if (lastDraw) {
    const overlap = game.filter((n) => new Set(lastDraw).has(n)).length;
    const overlapThreshold = 12 + Math.round(extra * 0.6);
    if (overlap >= overlapThreshold) score += overlap - overlapThreshold + 1;
  }

  // Bloco compacto (ex.: tudo entre 01 e 18). Range uniforme esperado ≈ 23.
  const range = game[game.length - 1] - game[0];
  const compactThreshold = 18 + extra;
  if (range <= compactThreshold) score += compactThreshold + 1 - range;

  return score;
}

/**
 * Estratégia 4 — Anti-Multidão: gera candidatos uniformes e fica com o de
 * menor crowdScore (parando cedo se achar score zero). Laço fixo — termina
 * sempre.
 */
export function antiCrowdGame(lastDraw?: number[], size = GAME_SIZE): number[] {
  let best = uniformGame(size);
  let bestScore = crowdScore(best, lastDraw);

  for (let i = 0; i < 8 && bestScore > 0; i++) {
    const candidate = uniformGame(size);
    const s = crowdScore(candidate, lastDraw);
    if (s < bestScore) {
      best = candidate;
      bestScore = s;
    }
  }
  return best;
}

/**
 * Estratégia 5 — Perfil Estatístico (filtros rígidos).
 * Gera candidatos pela roleta viciada com os pesos da janela de frequência
 * do próprio perfil (viés leve — com 100 concursos os pesos variam ~±15%,
 * o que preserva a diversidade) e DESCARTA todo candidato que caia fora de
 * qualquer banda média ± σ·desvio do histórico em:
 *   ímpares/pares · primos · Fibonacci · soma · repetidas do último concurso.
 * Entre os primeiros PROFILE_POOL aprovados, devolve o de menor crowdScore —
 * os prêmios de 14/15 são rateados, então, empatados no perfil, o jogo menos
 * "humano" vale mais. Se o orçamento estourar (bandas infactíveis com o
 * último concurso, p.ex.), devolve o candidato com menos violações: termina
 * sempre.
 */
export function statProfileGame(
  profile: StatProfile,
  lastDraw?: number[],
  size = GAME_SIZE
): number[] {
  const weights = buildWeights(profile.frequency);
  const approved: number[][] = [];
  let fallback: number[] = [];
  let fallbackViolations = Infinity;

  for (let i = 0; i < PROFILE_MAX_ATTEMPTS && approved.length < PROFILE_POOL; i++) {
    const candidate = weightedSample(weights, size);
    if (passesProfile(candidate, profile, lastDraw)) {
      approved.push(candidate);
      continue;
    }
    if (approved.length === 0) {
      const v = profileViolations(candidate, profile, lastDraw).length;
      if (v < fallbackViolations) {
        fallbackViolations = v;
        fallback = candidate;
      }
    }
  }

  if (approved.length === 0) return fallback;

  let best = approved[0];
  let bestScore = crowdScore(best, lastDraw);
  for (const candidate of approved.slice(1)) {
    const s = crowdScore(candidate, lastDraw);
    if (s < bestScore) {
      best = candidate;
      bestScore = s;
    }
  }
  return best;
}

interface StrategyContext {
  weights: Map<number, number>;
  freq: Map<number, number>;
  /** Dezenas por jogo (15–20) */
  size: number;
  lastDraw?: number[];
  profile?: StatProfile;
  strongBaseFixed?: number;
  modalRepeatCount?: number;
}

type ActiveStrategy = Exclude<StrategyId, "legacy" | "matrix">;

const STRATEGY_FNS: Record<ActiveStrategy, (ctx: StrategyContext) => number[]> = {
  weighted: ({ weights, size }) => weightedRouletteGame(weights, size),
  strongBase: ({ freq, strongBaseFixed, size }) => strongBaseGame(freq, strongBaseFixed, size),
  // sem o último concurso disponível, degrada para a roleta viciada
  modalRepeat: ({ weights, lastDraw, modalRepeatCount, size }) =>
    lastDraw && lastDraw.length === GAME_SIZE
      ? modalRepeatGame(weights, lastDraw, modalRepeatCount, size)
      : weightedRouletteGame(weights, size),
  antiCrowd: ({ lastDraw, size }) => antiCrowdGame(lastDraw, size),
  // sem perfil calculado (histórico indisponível), degrada para a roleta viciada
  statProfile: ({ profile, weights, lastDraw, size }) =>
    profile ? statProfileGame(profile, lastDraw, size) : weightedRouletteGame(weights, size),
};

interface GenerateOptions {
  gamesCount: number;
  /** Dezenas por jogo (15–20, padrão 15) */
  gameSize?: number;
  strategies: {
    weighted: boolean;
    strongBase: boolean;
    modalRepeat: boolean;
    antiCrowd: boolean;
    statProfile: boolean;
  };
  filters: { oddEven: boolean; frame: boolean; sum: boolean };
  /** Dezenas do último concurso — habilita Repetição Modal e Anti-Multidão pleno */
  lastDraw?: number[];
  /** Perfil estatístico (buildProfile) — habilita a estratégia Perfil Estatístico */
  profile?: StatProfile;
  /** Base Forte: quantidade de dezenas fixas (padrão 10) */
  strongBaseFixed?: number;
  /** Repetição Modal: centro da quantidade de repetidas do último concurso (padrão 9) */
  modalRepeatCount?: number;
  /** Fechamento por Dispersão: seleciona os N jogos menos sobrepostos entre 4N candidatos */
  dispersion?: boolean;
}

/**
 * Gera N jogos únicos alternando as estratégias habilitadas.
 * Término garantido: laços com orçamento fixo + escada de relaxamento.
 * Com `dispersion` ligado, sobre-amostra candidatos e devolve o subconjunto
 * de máxima dispersão (menor sobreposição par a par via greedy max-min).
 */
export function generateGames(
  freq: Map<number, number>,
  options: GenerateOptions
): GeneratedGame[] {
  const ctx: StrategyContext = {
    weights: buildWeights(freq),
    freq,
    size: clampGameSize(options.gameSize ?? GAME_SIZE),
    lastDraw: options.lastDraw,
    profile: options.profile,
    strongBaseFixed: options.strongBaseFixed,
    modalRepeatCount: options.modalRepeatCount,
  };

  // Perfil Estatístico vai primeiro: é o jogo que a Dispersão preserva como semente
  const enabledStrategies = (
    ["statProfile", "weighted", "strongBase", "modalRepeat", "antiCrowd"] as ActiveStrategy[]
  ).filter((s) => options.strategies[s]);
  if (enabledStrategies.length === 0) enabledStrategies.push("weighted");

  const activeFilters = RELAX_ORDER.filter((f) => options.filters[f]);

  const candidateCount = options.dispersion
    ? options.gamesCount * DISPERSION_OVERSAMPLE
    : options.gamesCount;

  const seen = new Set<string>();
  const candidates: GeneratedGame[] = [];

  for (let i = 0; i < candidateCount; i++) {
    const strategy = enabledStrategies[i % enabledStrategies.length];
    const game = generateOne(strategy, ctx, activeFilters, seen);
    seen.add(gameKey(game.numbers));
    candidates.push(game);
  }

  return options.dispersion
    ? selectMaxDispersion(candidates, options.gamesCount)
    : candidates;
}

function generateOne(
  strategy: ActiveStrategy,
  ctx: StrategyContext,
  activeFilters: FilterId[],
  seen: Set<string>
): GeneratedGame {
  const draw = () => STRATEGY_FNS[strategy](ctx);

  // Escada de relaxamento: [todos os filtros] → remove 1 → ... → [nenhum]
  const ladder: FilterId[][] = [];
  for (let level = 0; level <= activeFilters.length; level++) {
    ladder.push(activeFilters.slice(level));
  }

  let lastCandidate: number[] = [];

  for (const filters of ladder) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_LEVEL; attempt++) {
      const candidate = draw();
      lastCandidate = candidate;
      if (!filters.every((f) => FILTER_FNS[f](candidate))) continue;
      if (seen.has(gameKey(candidate))) continue;
      return {
        numbers: candidate,
        strategy,
        relaxedFilters: activeFilters.filter((f) => !filters.includes(f)),
      };
    }
  }

  // Último recurso (probabilidade ínfima): aceita o último candidato,
  // mesmo repetido, sinalizando que todos os filtros foram relaxados.
  return { numbers: lastCandidate, strategy, relaxedFilters: activeFilters };
}

/** Distância entre jogos: n − |interseção| (para 15: ∈ [0, 10], sobreposição mínima = 5) */
function gameDistance(a: number[], b: number[]): number {
  const bSet = new Set(b);
  return a.length - a.filter((n) => bSet.has(n)).length;
}

/**
 * Fechamento por Dispersão — greedy max-min: começa pelo primeiro candidato
 * (mantém a alternância de estratégias no topo da lista) e, a cada passo,
 * adiciona o candidato cuja MENOR distância aos já escolhidos é MÁXIMA.
 * Jogos pouco sobrepostos decorrelacionam os resultados do combo: cobrem
 * mais dezenas no conjunto e reduzem a chance de todos os bilhetes
 * fracassarem juntos.
 */
function selectMaxDispersion(
  candidates: GeneratedGame[],
  count: number
): GeneratedGame[] {
  if (candidates.length <= count) return candidates;

  const selected: GeneratedGame[] = [candidates[0]];
  const remaining = candidates.slice(1);

  while (selected.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestMinDist = -1;
    remaining.forEach((candidate, idx) => {
      const minDist = Math.min(
        ...selected.map((s) => gameDistance(candidate.numbers, s.numbers))
      );
      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestIdx = idx;
      }
    });
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected;
}
