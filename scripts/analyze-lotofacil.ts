/**
 * Relatório do Perfil Estatístico + amostra de jogos aprovados.
 *
 *   npm run analyze              -> baixa os últimos 100 concursos (lote) e imprime
 *   npm run analyze -- 200       -> outra janela
 *   DATASET=arquivo.json npm run analyze   -> usa um dataset local (Draw[])
 *
 * Roda com `tsc` + node (ver script "analyze" no package.json); não depende
 * do Next. Usa exatamente o mesmo código de análise/geração do app.
 */
import { readFileSync } from "fs";
import {
  PROFILE_METRICS,
  PROFILE_METRIC_LABELS,
  buildProfile,
  coldNumbers,
  gameFeatures,
  hotNumbers,
  overdueNumbers,
  passesProfile,
  type StatProfile,
} from "../src/lib/lotofacil/analysis";
import { bulkToDraw, isValidBulkDraw, type BulkDraw } from "../src/lib/lotofacil/bulk";
import { crowdScore, generateGames } from "../src/lib/lotofacil/generator";
import { buildFrequency } from "../src/lib/lotofacil/stats";
import type { Draw } from "../src/lib/lotofacil/types";

const BULK_URL = "https://loteriascaixa-api.herokuapp.com/api/lotofacil";

const pad = (n: number) => String(n).padStart(2, "0");
const fmtGame = (g: number[]) => g.map(pad).join(" ");

async function loadDraws(windowSize: number): Promise<Draw[]> {
  if (process.env.DATASET) {
    const local = JSON.parse(readFileSync(process.env.DATASET, "utf8")) as Draw[];
    return local.sort((a, b) => b.numero - a.numero).slice(0, windowSize);
  }
  const res = await fetch(BULK_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Histórico respondeu HTTP ${res.status}`);
  const bulk = (await res.json()) as BulkDraw[];
  return bulk
    .filter(isValidBulkDraw)
    .sort((a, b) => b.concurso - a.concurso)
    .slice(0, windowSize)
    .map(bulkToDraw);
}

function printProfile(profile: StatProfile, draws: Draw[]) {
  console.log(`\n=== PERFIL ESTATÍSTICO — ${profile.window} concursos (${profile.fromContest} → ${profile.toContest}), bandas a ±${profile.sigma}σ ===\n`);
  console.log("Métrica                  média   desvio   observado   banda aceita");
  for (const m of PROFILE_METRICS) {
    const s = profile.metrics[m];
    console.log(
      `${PROFILE_METRIC_LABELS[m].padEnd(24)} ${s.mean.toFixed(2).padStart(6)}   ${s.std.toFixed(2).padStart(5)}   ${String(s.observedMin).padStart(3)} – ${String(s.observedMax).padEnd(4)}   ${s.min} – ${s.max}`
    );
  }
  const odd = profile.metrics.odd;
  console.log(`\nPares/Ímpares ideal: ${(15 - odd.mean).toFixed(1)} pares × ${odd.mean.toFixed(1)} ímpares (banda: ${15 - odd.max}–${15 - odd.min} pares / ${odd.min}–${odd.max} ímpares)`);

  console.log(`\nMais sorteadas (freq/atraso): ${profile.ranking.slice(0, 6).map((e) => `${pad(e.n)}(${e.frequency}/${e.delay})`).join(" ")}`);
  console.log(`Menos sorteadas:              ${[...profile.ranking].reverse().slice(0, 6).map((e) => `${pad(e.n)}(${e.frequency}/${e.delay})`).join(" ")}`);
  console.log(`Maior atraso:                 ${overdueNumbers(profile, 6).map((n) => `${pad(n)}(${profile.delay.get(n)})`).join(" ")}`);
  console.log(`Quentes: ${hotNumbers(profile, 5).map(pad).join(" ")} | Frias: ${coldNumbers(profile, 5).map(pad).join(" ")}`);

  // Quantos sorteios reais caem dentro do próprio perfil (in-sample)
  const ordered = [...draws].sort((a, b) => a.numero - b.numero).map((d) => d.listaDezenas.map(Number));
  let inBand = 0;
  for (let i = 1; i < ordered.length; i++) if (passesProfile(ordered[i], profile, ordered[i - 1])) inBand++;
  console.log(`\nSorteios reais dentro das 5 bandas: ${inBand}/${ordered.length - 1} (${((100 * inBand) / (ordered.length - 1)).toFixed(1)}%)`);

  // Taxa de aceitação de combinações uniformes (Monte Carlo)
  const N = 100000;
  const last = ordered[ordered.length - 1];
  let ok = 0;
  for (let i = 0; i < N; i++) if (passesProfile(uniform(), profile, last)) ok++;
  console.log(`Combinações uniformes aprovadas (Monte Carlo, n=${N}): ${((100 * ok) / N).toFixed(1)}%`);
}

function uniform(): number[] {
  const pool = Array.from({ length: 25 }, (_, i) => i + 1);
  for (let i = 24; i >= 10; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(10).sort((a, b) => a - b);
}

async function main() {
  const windowSize = Number(process.argv[2]) || 100;
  const sigma = Number(process.env.SIGMA) || 1;
  const draws = await loadDraws(windowSize);
  const profile = buildProfile(draws, sigma);
  const lastDraw = draws[0].listaDezenas.map(Number);

  printProfile(profile, draws);

  console.log(`\n=== LOG — 5 jogos gerados pelo Perfil Estatístico (alvo: após o concurso ${draws[0].numero}) ===\n`);
  const games = generateGames(buildFrequency(draws.slice(0, 10)), {
    gamesCount: 5,
    strategies: { weighted: false, strongBase: false, modalRepeat: false, antiCrowd: false, statProfile: true },
    filters: { oddEven: true, frame: true, sum: true },
    lastDraw,
    profile,
    dispersion: false,
  });

  games.forEach((g, i) => {
    const f = gameFeatures(g.numbers, lastDraw);
    const checks = PROFILE_METRICS.map((m) => {
      const v = m === "repeat" ? f.repeat! : f[m];
      const { min, max } = profile.metrics[m];
      return `${PROFILE_METRIC_LABELS[m]}=${v} [${min}–${max}] ${v >= min && v <= max ? "✔" : "✘"}`;
    });
    console.log(`Jogo ${i + 1}: ${fmtGame(g.numbers)}`);
    console.log(`  ${checks.join(" · ")}`);
    console.log(`  pares=${f.even} moldura=${f.frame} crowdScore=${crowdScore(g.numbers, lastDraw)} filtrosRelaxados=${g.relaxedFilters.length ? g.relaxedFilters.join(",") : "nenhum"}\n`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
