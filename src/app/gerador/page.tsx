"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import NumberBall from "@/components/lotofacil/NumberBall";
import { buildProfile, type StatProfile } from "@/lib/lotofacil/analysis";
import { applyMatrixClosing } from "@/lib/lotofacil/closing";
import { ALL_NUMBERS, STRATEGY_LABELS } from "@/lib/lotofacil/constants";
import { generateGames } from "@/lib/lotofacil/generator";
import {
  buildFrequency,
  formatBRL,
  nextFinalZeroContest,
  ticketCost,
} from "@/lib/lotofacil/stats";
import { addCombo, loadConfig } from "@/lib/lotofacil/storage";
import type { AppConfig, Combo, Draw, GeneratedGame } from "@/lib/lotofacil/types";
import { getHistorico } from "@/services/lotofacilApi";

type Phase = "loading" | "idle" | "generating" | "done" | "error";

/** Etapas exibidas durante a geração (a computação real acontece na 3ª) */
const STEPS = [
  "Carregando histórico de concursos",
  "Calculando perfil estatístico",
  "Sorteando candidatos pelas estratégias",
  "Aplicando filtros de padrão",
  "Otimizando o combo",
];

const STEP_DELAY_MS = 550;
const ROLL_INTERVAL_MS = 90;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Subconjunto aleatório de `k` dezenas — só para o efeito visual de "rolagem" */
function randomSubset(k: number): Set<number> {
  const pool = [...ALL_NUMBERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return new Set(pool.slice(0, k));
}

export default function GeradorPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [history, setHistory] = useState<Draw[]>([]);
  const [profile, setProfile] = useState<StatProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [step, setStep] = useState(0);
  const [rolling, setRolling] = useState<Set<number>>(new Set());
  const [combo, setCombo] = useState<Combo | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Carga inicial: config + histórico (uma chamada em lote)
  useEffect(() => {
    const cfg = loadConfig();
    setConfig(cfg);
    (async () => {
      try {
        const draws = await getHistorico(Math.max(cfg.drawsWindow, cfg.profileWindow));
        setHistory(draws);
        setProfile(buildProfile(draws.slice(0, cfg.profileWindow), cfg.profileSigma));
        setPhase("idle");
      } catch {
        setError("Não foi possível carregar o histórico. Verifique a conexão.");
        setPhase("error");
      }
    })();
  }, []);

  // Efeito de "rolagem" do volante enquanto gera
  useEffect(() => {
    if (phase !== "generating" || !config) return;
    rollTimer.current = setInterval(
      () => setRolling(randomSubset(config.numbersPerGame)),
      ROLL_INTERVAL_MS
    );
    return () => {
      if (rollTimer.current) clearInterval(rollTimer.current);
    };
  }, [phase, config]);

  // Revelação escalonada dos jogos gerados
  useEffect(() => {
    if (phase !== "done" || !combo) return;
    if (revealed >= combo.games.length) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), 260);
    return () => clearTimeout(t);
  }, [phase, combo, revealed]);

  const handleGenerate = async () => {
    if (!config || history.length === 0 || phase === "generating") return;
    setError(null);
    setCombo(null);
    setRevealed(0);
    setPhase("generating");
    setStep(0);

    try {
      // Reaproveita o histórico já carregado; recarrega só se o último
      // concurso puder ter mudado (a rota é cacheada por 1 h de qualquer forma)
      await sleep(STEP_DELAY_MS);
      setStep(1);
      const draws = history;
      const last = draws[0];
      const frequency = buildFrequency(draws.slice(0, config.drawsWindow));
      const statProfile =
        profile ?? buildProfile(draws.slice(0, config.profileWindow), config.profileSigma);
      await sleep(STEP_DELAY_MS);
      setStep(2);

      const games = generateGames(frequency, {
        gamesCount: config.gamesPerCombo,
        gameSize: config.numbersPerGame,
        strategies: config.strategies,
        filters: config.filters,
        lastDraw: last.listaDezenas.map((d) => parseInt(d, 10)),
        profile: statProfile,
        strongBaseFixed: config.strongBaseFixed,
        modalRepeatCount: config.modalRepeatCount,
        dispersion: config.dispersion,
      });
      await sleep(STEP_DELAY_MS);
      setStep(3);
      await sleep(STEP_DELAY_MS);
      setStep(4);

      const finalGames: GeneratedGame[] = config.matrixClosing
        ? applyMatrixClosing(games, frequency, {
            gamesCount: config.gamesPerCombo,
            fixedCount: config.matrixFixedCount,
            gameSize: config.numbersPerGame,
          }).games
        : games;
      await sleep(STEP_DELAY_MS);

      const created: Combo = {
        id: newId(),
        createdAt: new Date().toISOString(),
        targetContest: nextFinalZeroContest(last),
        games: finalGames,
      };
      addCombo(created);
      setCombo(created);
      setPhase("done");
    } catch {
      setError("Falha ao gerar o combo. Tente de novo.");
      setPhase("idle");
    }
  };

  const enabledStrategies = config
    ? (Object.keys(config.strategies) as (keyof AppConfig["strategies"])[]).filter(
        (k) => config.strategies[k]
      )
    : [];
  const last = history[0];
  const target = last ? nextFinalZeroContest(last) : null;
  const totalCost = config
    ? config.gamesPerCombo * ticketCost(config.numbersPerGame, config.ticketPrice)
    : 0;
  const generating = phase === "generating";

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">Gerador de combos</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {target
              ? `Próximo alvo: concurso #${target}${
                  last?.dataProximoConcurso ? ` · a partir de ${last.dataProximoConcurso}` : ""
                }`
              : "Carregando o próximo concurso..."}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={phase === "loading" || phase === "error" || generating}
          className="relative overflow-hidden px-6 py-2.5 bg-volt text-volt-ink rounded-full font-semibold hover:bg-volt-soft disabled:opacity-40 transition-colors"
        >
          <span className="flex items-center gap-2">
            {generating && <span className="inline-block animate-spin-slow">✳</span>}
            {generating
              ? "Gerando..."
              : phase === "done"
              ? "Gerar outro combo"
              : `Gerar combo (${config?.gamesPerCombo ?? "-"} jogos de ${config?.numbersPerGame ?? 15})`}
          </span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Volante animado + etapas */}
        <section className="lg:col-span-2 bg-noir-800 border border-noir-600 rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div
              className={`grid grid-cols-5 gap-1.5 w-fit ${generating ? "animate-glow rounded-2xl p-2 -m-2" : ""}`}
            >
              {ALL_NUMBERS.map((n) => (
                <div
                  key={n}
                  className={generating && rolling.has(n) ? "transition-transform scale-110" : "transition-transform"}
                >
                  <NumberBall n={n} state={generating && rolling.has(n) ? "drawn" : "idle"} />
                </div>
              ))}
            </div>

            <ol className="flex-1 min-w-[220px] space-y-2 text-sm">
              {STEPS.map((label, i) => {
                const state = !generating && phase !== "done"
                  ? "pending"
                  : phase === "done" || i < step
                  ? "done"
                  : i === step
                  ? "active"
                  : "pending";
                return (
                  <li key={label} className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 transition-colors ${
                        state === "done"
                          ? "bg-volt text-volt-ink font-bold"
                          : state === "active"
                          ? "border border-volt text-volt animate-glow"
                          : "border border-noir-600 text-zinc-600"
                      }`}
                    >
                      {state === "done" ? "✓" : i + 1}
                    </span>
                    <span
                      className={
                        state === "active"
                          ? "text-zinc-100"
                          : state === "done"
                          ? "text-zinc-400"
                          : "text-zinc-600"
                      }
                    >
                      {label}
                      {state === "active" && <span className="animate-dots" />}
                    </span>
                  </li>
                );
              })}
              {generating && (
                <li className="pt-2">
                  <div className="h-1.5 rounded-full bg-noir-700 overflow-hidden">
                    <div className="h-full w-1/3 bg-volt rounded-full animate-bar" />
                  </div>
                </li>
              )}
            </ol>
          </div>
        </section>

        {/* Resumo da configuração */}
        <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5 space-y-3 text-sm">
          <h2 className="text-lg font-semibold text-zinc-100">Configuração atual</h2>
          {config ? (
            <>
              <dl className="grid grid-cols-2 gap-y-2 text-zinc-400">
                <dt>Jogos por combo</dt>
                <dd className="text-zinc-100 text-right">{config.gamesPerCombo}</dd>
                <dt>Dezenas por jogo</dt>
                <dd className="text-zinc-100 text-right">{config.numbersPerGame}</dd>
                <dt>Custo do combo</dt>
                <dd className="text-zinc-100 text-right">{formatBRL(totalCost)}</dd>
                <dt>Janela de frequência</dt>
                <dd className="text-zinc-100 text-right">{config.drawsWindow} concursos</dd>
                <dt>Dispersão</dt>
                <dd className="text-zinc-100 text-right">{config.dispersion ? "ligada" : "desligada"}</dd>
                <dt>Fechamento por matriz</dt>
                <dd className="text-zinc-100 text-right">
                  {config.matrixClosing ? `${config.matrixFixedCount} fixas` : "desligado"}
                </dd>
              </dl>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1.5">Estratégias</p>
                <ul className="space-y-1">
                  {enabledStrategies.length === 0 && (
                    <li className="text-zinc-500">Nenhuma ligada (usa Roleta Viciada)</li>
                  )}
                  {enabledStrategies.map((k) => (
                    <li key={k} className="text-zinc-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-volt shrink-0" />
                      {STRATEGY_LABELS[k]}
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/config" className="inline-block text-volt hover:underline text-sm">
                Ajustar configurações →
              </Link>
            </>
          ) : (
            <p className="text-zinc-500">Carregando...</p>
          )}
        </section>
      </div>

      {/* Resultado */}
      {combo && phase === "done" && (
        <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5 animate-pop">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                Combo gerado para o concurso <span className="text-volt">#{combo.targetContest}</span>
              </h2>
              <p className="text-xs text-zinc-500">
                {combo.games.length} jogos · {formatBRL(totalCost)} · salvo no histórico
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/"
                className="px-4 py-1.5 rounded-full text-sm border border-noir-600 text-zinc-300 hover:bg-noir-700 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/history"
                className="px-4 py-1.5 rounded-full text-sm border border-noir-600 text-zinc-300 hover:bg-noir-700 transition-colors"
              >
                Histórico
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            {combo.games.slice(0, revealed).map((game, i) => (
              <div key={i} className="animate-pop">
                <p className="text-xs text-zinc-500 mb-1.5">
                  Jogo {i + 1} — {STRATEGY_LABELS[game.strategy] ?? game.strategy}
                  {game.closing === "matrix" && (
                    <span className="text-sky-300/80"> · fechamento por matriz</span>
                  )}
                  {game.relaxedFilters.length > 0 && (
                    <span className="text-amber-400/80">
                      {" "}
                      · filtros relaxados: {game.relaxedFilters.join(", ")}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {game.numbers.map((n, j) => (
                    <div
                      key={n}
                      className="animate-pop"
                      style={{ animationDelay: `${j * 45}ms` }}
                    >
                      <NumberBall n={n} state="marked" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {revealed < combo.games.length && (
              <p className="text-xs text-zinc-500">
                Revelando jogo {revealed + 1} de {combo.games.length}
                <span className="animate-dots" />
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
