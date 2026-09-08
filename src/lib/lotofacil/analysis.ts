import { ALL_NUMBERS, GAME_SIZE, MOLDURA } from "./constants";
import type { Draw } from "./types";

/** Primos entre 1 e 25 (9 dezenas) → esperado por sorteio: 15 · 9/25 = 5,4 */
export const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
/** Fibonacci entre 1 e 25 (7 dezenas) → esperado por sorteio: 15 · 7/25 = 4,2 */
export const FIBONACCI = new Set([1, 2, 3, 5, 8, 13, 21]);

/** Métricas de um jogo/sorteio de 15 dezenas */
export interface GameFeatures {
  odd: number;
  even: number;
  primes: number;
  fibonacci: number;
  sum: number;
  frame: number;
  /** Dezenas em comum com o concurso imediatamente anterior (se informado) */
  repeat?: number;
}

/** Estatística descritiva de uma métrica + banda aceita (média ± σ·desvio) */
export interface MetricStats {
  mean: number;
  std: number;
  /** Menor valor observado na janela */
  observedMin: number;
  /** Maior valor observado na janela */
  observedMax: number;
  /** Banda aceita pelo filtro rígido (inteiros, inclusiva) */
  min: number;
  max: number;
}

export type ProfileMetric = "odd" | "primes" | "fibonacci" | "sum" | "repeat";

export const PROFILE_METRICS: ProfileMetric[] = ["odd", "primes", "fibonacci", "sum", "repeat"];

export const PROFILE_METRIC_LABELS: Record<ProfileMetric, string> = {
  odd: "Ímpares",
  primes: "Primos",
  fibonacci: "Fibonacci",
  sum: "Soma",
  repeat: "Repetidas do anterior",
};

export interface DelayEntry {
  n: number;
  frequency: number;
  /** Concursos desde a última saída (0 = saiu no último) */
  delay: number;
}

/** Perfil estatístico da janela — é o "sweet spot" que o filtro rígido impõe */
export interface StatProfile {
  /** Quantos concursos entraram na análise */
  window: number;
  /** Primeiro e último concurso da janela */
  fromContest: number;
  toContest: number;
  /** Multiplicador do desvio padrão usado para montar as bandas */
  sigma: number;
  metrics: Record<ProfileMetric, MetricStats>;
  frequency: Map<number, number>;
  delay: Map<number, number>;
  /** Dezenas ordenadas da mais para a menos frequente */
  ranking: DelayEntry[];
}

const parseDraw = (draw: Draw) => draw.listaDezenas.map((d) => parseInt(d, 10));

export function gameFeatures(game: number[], previous?: number[]): GameFeatures {
  const odd = game.filter((n) => n % 2 === 1).length;
  const features: GameFeatures = {
    odd,
    even: game.length - odd,
    primes: game.filter((n) => PRIMES.has(n)).length,
    fibonacci: game.filter((n) => FIBONACCI.has(n)).length,
    sum: game.reduce((acc, n) => acc + n, 0),
    frame: game.filter((n) => MOLDURA.has(n)).length,
  };
  if (previous) {
    const prev = new Set(previous);
    features.repeat = game.filter((n) => prev.has(n)).length;
  }
  return features;
}

function describe(values: number[], sigma: number, domainMin: number, domainMax: number): MetricStats {
  if (values.length === 0) {
    return { mean: NaN, std: NaN, observedMin: NaN, observedMax: NaN, min: domainMin, max: domainMax };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // desvio padrão amostral (n−1): a janela é uma amostra da população de sorteios
  const variance =
    values.length > 1
      ? values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1)
      : 0;
  const std = Math.sqrt(variance);
  return {
    mean,
    std,
    observedMin: Math.min(...values),
    observedMax: Math.max(...values),
    // banda inclusiva: intervalo contínuo média ± σ·desvio, arredondado ao inteiro
    // mais próximo e limitado ao domínio possível da métrica
    min: Math.max(domainMin, Math.round(mean - sigma * std)),
    max: Math.min(domainMax, Math.round(mean + sigma * std)),
  };
}

/**
 * Constrói o perfil estatístico de uma janela de concursos.
 * `draws` pode vir em qualquer ordem — é ordenado do mais antigo ao mais novo
 * internamente para calcular a repetição contra o concurso anterior.
 * `sigma` = quantos desvios padrão em torno da média o filtro tolera (1 = rígido).
 */
export function buildProfile(draws: Draw[], sigma = 1): StatProfile {
  const ordered = [...draws].sort((a, b) => a.numero - b.numero);
  const games = ordered.map(parseDraw);

  const odd: number[] = [];
  const primes: number[] = [];
  const fibonacci: number[] = [];
  const sum: number[] = [];
  const repeat: number[] = [];

  games.forEach((game, i) => {
    const f = gameFeatures(game, i > 0 ? games[i - 1] : undefined);
    odd.push(f.odd);
    primes.push(f.primes);
    fibonacci.push(f.fibonacci);
    sum.push(f.sum);
    if (f.repeat !== undefined) repeat.push(f.repeat);
  });

  // Frequência e atraso (varredura do mais novo para o mais antigo)
  const frequency = new Map<number, number>();
  const delay = new Map<number, number>();
  ALL_NUMBERS.forEach((n) => {
    frequency.set(n, 0);
    delay.set(n, games.length); // nunca saiu na janela
  });
  for (let i = games.length - 1; i >= 0; i--) {
    const age = games.length - 1 - i;
    games[i].forEach((n) => {
      frequency.set(n, (frequency.get(n) ?? 0) + 1);
      if ((delay.get(n) ?? Infinity) > age) delay.set(n, age);
    });
  }

  const ranking: DelayEntry[] = ALL_NUMBERS.map((n) => ({
    n,
    frequency: frequency.get(n) ?? 0,
    delay: delay.get(n) ?? games.length,
  })).sort((a, b) => b.frequency - a.frequency || a.delay - b.delay || a.n - b.n);

  // Domínios: ímpares 0..13, primos 0..9, fibonacci 0..7, soma 120..270, repetidas 5..15
  return {
    window: games.length,
    fromContest: ordered[0]?.numero ?? 0,
    toContest: ordered[ordered.length - 1]?.numero ?? 0,
    sigma,
    metrics: {
      odd: describe(odd, sigma, 0, 13),
      primes: describe(primes, sigma, 0, PRIMES.size),
      fibonacci: describe(fibonacci, sigma, 0, FIBONACCI.size),
      sum: describe(sum, sigma, 120, 270),
      repeat: describe(repeat, sigma, 15 - (25 - GAME_SIZE), GAME_SIZE),
    },
    frequency,
    delay,
    ranking,
  };
}

/**
 * Métricas do jogo que caem FORA da banda do perfil. Lista vazia = aprovado.
 * A métrica `repeat` só é avaliada quando o último concurso é informado.
 *
 * O perfil é medido em sorteios de 15 dezenas. Para jogos de 16–20 dezenas
 * todas as métricas crescem proporcionalmente (um jogo de 20 tem 4/3 das
 * ímpares, primos, soma... de um de 15), então as bandas são escaladas por
 * game.length / 15 antes da comparação.
 */
export function profileViolations(
  game: number[],
  profile: StatProfile,
  lastDraw?: number[]
): ProfileMetric[] {
  const f = gameFeatures(game, lastDraw);
  const scale = game.length / GAME_SIZE;
  const outside = (metric: ProfileMetric, value: number | undefined) => {
    if (value === undefined) return false;
    const band = profile.metrics[metric];
    const min = Math.round(band.min * scale);
    const max = Math.round(band.max * scale);
    return value < min || value > max;
  };
  return PROFILE_METRICS.filter((m) =>
    outside(m, m === "repeat" ? f.repeat : f[m])
  );
}

export const passesProfile = (game: number[], profile: StatProfile, lastDraw?: number[]) =>
  profileViolations(game, profile, lastDraw).length === 0;

/** As `count` dezenas mais frequentes da janela */
export const hotNumbers = (profile: StatProfile, count = 5) =>
  profile.ranking.slice(0, count).map((e) => e.n);

/** As `count` dezenas menos frequentes da janela */
export const coldNumbers = (profile: StatProfile, count = 5) =>
  [...profile.ranking].reverse().slice(0, count).map((e) => e.n);

/** As `count` dezenas há mais concursos sem sair */
export const overdueNumbers = (profile: StatProfile, count = 5) =>
  [...profile.ranking].sort((a, b) => b.delay - a.delay || a.n - b.n).slice(0, count).map((e) => e.n);
