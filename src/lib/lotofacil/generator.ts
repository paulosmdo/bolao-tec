import {
  ALL_NUMBERS,
  GAME_SIZE,
  MOLDURA,
  ODD_COUNTS_OK,
  FRAME_MIN,
  FRAME_MAX,
  SUM_MIN,
  SUM_MAX,
  VOLANTE_LINES,
} from "./constants";
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

const FILTER_FNS: Record<FilterId, (game: number[]) => boolean> = {
  oddEven: (game) => ODD_COUNTS_OK.has(game.filter((n) => n % 2 === 1).length),
  frame: (game) => {
    const inFrame = game.filter((n) => MOLDURA.has(n)).length;
    return inFrame >= FRAME_MIN && inFrame <= FRAME_MAX;
  },
  sum: (game) => {
    const sum = game.reduce((acc, n) => acc + n, 0);
    return sum >= SUM_MIN && sum <= SUM_MAX;
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

/** Amostra uniforme de 15 dezenas (Fisher-Yates parcial) */
function uniformGame(): number[] {
  const pool = [...ALL_NUMBERS];
  for (let i = pool.length - 1; i >= pool.length - GAME_SIZE; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(pool.length - GAME_SIZE).sort((a, b) => a - b);
}

/**
 * Estratégia 1 — Roleta Viciada (weighted random sampling sem reposição).
 * Dezenas quentes tendem a entrar, sem garantia — variância controlada,
 * nunca o mesmo jogo fixo.
 */
export function weightedRouletteGame(weights: Map<number, number>): number[] {
  return weightedSample(weights, GAME_SIZE);
}

/**
 * Estratégia 2 — Base Forte: as 10 dezenas mais frequentes entram fixas e as
 * 5 restantes são sorteadas uniformemente entre as 15 que sobraram.
 */
export function strongBaseGame(freq: Map<number, number>): number[] {
  const sorted = ALL_NUMBERS
    .map((n) => [n, freq.get(n) ?? 0] as [number, number])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);

  const base = sorted.slice(0, 10).map(([n]) => n);
  const rest = sorted.slice(10).map(([n]) => n);

  for (let i = rest.length - 1; i > rest.length - 1 - 5; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const fill = rest.slice(rest.length - 5);

  return [...base, ...fill].sort((a, b) => a - b);
}

/**
 * Estratégia 3 — Repetição Modal: a interseção entre dois concursos
 * consecutivos segue uma hipergeométrica (15 dezenas "do último" num universo
 * de 25, sorteando 15) com moda em 9: P(8)≈24%, P(9)≈32%, P(10)≈23% — juntas,
 * ~79% de todos os sorteios. A estratégia sorteia k ∈ {8,9,10} com essas
 * proporções, escolhe k repetidas do último concurso e completa com as
 * ausentes, ambas ponderadas pela frequência da janela.
 */
export function modalRepeatGame(
  weights: Map<number, number>,
  lastDraw: number[]
): number[] {
  const r = Math.random();
  const k = r < 0.3 ? 8 : r < 0.71 ? 9 : 10;

  const inLast = new Set(lastDraw);
  const lastPool = new Map<number, number>();
  const absentPool = new Map<number, number>();
  weights.forEach((w, n) => (inLast.has(n) ? lastPool : absentPool).set(n, w));

  const repeats = weightedSample(lastPool, k);
  const fresh = weightedSample(absentPool, GAME_SIZE - k);
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
  if (fullLines >= 2) score += (fullLines - 1) * 2;

  // Quase-cópia do último resultado (muita gente repete o concurso anterior)
  if (lastDraw) {
    const overlap = game.filter((n) => new Set(lastDraw).has(n)).length;
    if (overlap >= 12) score += overlap - 11;
  }

  // Bloco compacto (ex.: tudo entre 01 e 18). Range uniforme esperado ≈ 23.
  const range = game[game.length - 1] - game[0];
  if (range <= 18) score += 19 - range;

  return score;
}

/**
 * Estratégia 4 — Anti-Multidão: gera candidatos uniformes e fica com o de
 * menor crowdScore (parando cedo se achar score zero). Laço fixo — termina
 * sempre.
 */
export function antiCrowdGame(lastDraw?: number[]): number[] {
  let best = uniformGame();
  let bestScore = crowdScore(best, lastDraw);

  for (let i = 0; i < 8 && bestScore > 0; i++) {
    const candidate = uniformGame();
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
  lastDraw?: number[];
}

type ActiveStrategy = Exclude<StrategyId, "legacy">;

const STRATEGY_FNS: Record<ActiveStrategy, (ctx: StrategyContext) => number[]> = {
  weighted: ({ weights }) => weightedRouletteGame(weights),
  strongBase: ({ freq }) => strongBaseGame(freq),
  // sem o último concurso disponível, degrada para a roleta viciada
  modalRepeat: ({ weights, lastDraw }) =>
    lastDraw && lastDraw.length === GAME_SIZE
      ? modalRepeatGame(weights, lastDraw)
      : weightedRouletteGame(weights),
  antiCrowd: ({ lastDraw }) => antiCrowdGame(lastDraw),
};

interface GenerateOptions {
  gamesCount: number;
  strategies: {
    weighted: boolean;
    strongBase: boolean;
    modalRepeat: boolean;
    antiCrowd: boolean;
  };
  filters: { oddEven: boolean; frame: boolean; sum: boolean };
  /** Dezenas do último concurso — habilita Repetição Modal e Anti-Multidão pleno */
  lastDraw?: number[];
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
    lastDraw: options.lastDraw,
  };

  const enabledStrategies = (
    ["weighted", "strongBase", "modalRepeat", "antiCrowd"] as ActiveStrategy[]
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

/** Distância entre jogos: 15 − |interseção| ∈ [0, 10] (mín. teórico de sobreposição = 5) */
function gameDistance(a: number[], b: number[]): number {
  const bSet = new Set(b);
  return GAME_SIZE - a.filter((n) => bSet.has(n)).length;
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
