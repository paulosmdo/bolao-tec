"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NumberBall from "@/components/lotofacil/NumberBall";
import Volante from "@/components/lotofacil/Volante";
import StatCard from "@/components/lotofacil/StatCard";
import FrequencyChart from "@/components/lotofacil/FrequencyChart";
import { STRATEGY_LABELS } from "@/lib/lotofacil/constants";
import { generateGames } from "@/lib/lotofacil/generator";
import {
  buildFrequency,
  computeRoi,
  countHits,
  fixedPrizeFor,
  formatBRL,
  nextFinalZeroContest,
} from "@/lib/lotofacil/stats";
import { addCombo, loadCombos, loadConfig, updateCombo } from "@/lib/lotofacil/storage";
import type { AppConfig, Combo, Draw } from "@/lib/lotofacil/types";
import { getConcurso, getUltimosConcursos } from "@/services/lotofacilApi";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export default function DashboardPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [ultimo, setUltimo] = useState<Draw | null>(null);
  const [freq, setFreq] = useState<Map<number, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cfg = loadConfig();
    setConfig(cfg);
    let current = loadCombos();
    setCombos(current);

    (async () => {
      try {
        const { ultimo: last, draws } = await getUltimosConcursos(cfg.drawsWindow);
        setUltimo(last);
        setFreq(buildFrequency(draws));

        // Confere automaticamente combos pendentes de concursos já realizados
        const pending = current.filter((c) => !c.result && c.targetContest <= last.numero);
        for (const combo of pending) {
          try {
            const draw =
              combo.targetContest === last.numero
                ? last
                : await getConcurso(combo.targetContest);
            current = updateCombo(combo.id, {
              result: {
                drawnNumbers: draw.listaDezenas.map((d) => parseInt(d, 10)),
                checkedAt: new Date().toISOString(),
              },
            });
          } catch {
            // resultado indisponível: tenta de novo na próxima visita
          }
        }
        setCombos(current);
      } catch {
        setError("Não foi possível carregar o último resultado. Tente novamente.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const roi = useMemo(
    () => (config ? computeRoi(combos, config.ticketPrice) : null),
    [combos, config]
  );

  const lastPlayed = useMemo(() => combos.find((c) => c.result) ?? null, [combos]);
  const pendingCombo = useMemo(() => combos.find((c) => !c.result) ?? null, [combos]);
  const nextTarget = ultimo ? nextFinalZeroContest(ultimo) : null;
  const hits11Plus = roi
    ? Object.entries(roi.hitsDistribution)
        .filter(([h]) => Number(h) >= 11)
        .reduce((acc, [, count]) => acc + count, 0)
    : 0;

  const handleGenerate = async () => {
    if (!config || !ultimo || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const { ultimo: last, draws } = await getUltimosConcursos(config.drawsWindow);
      const frequency = buildFrequency(draws);
      const games = generateGames(frequency, {
        gamesCount: config.gamesPerCombo,
        strategies: config.strategies,
        filters: config.filters,
        lastDraw: last.listaDezenas.map((d) => parseInt(d, 10)),
        dispersion: config.dispersion,
      });
      const combo: Combo = {
        id: newId(),
        createdAt: new Date().toISOString(),
        targetContest: nextFinalZeroContest(last),
        games,
      };
      setCombos(addCombo(combo));
    } catch {
      setError("Falha ao gerar o combo. Verifique a conexão e tente de novo.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-5">
      {/* Saudação */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">
            {greeting()}, Paulo
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Acompanhe seus combos, o ROI e o próximo concurso final 0.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || loading || !ultimo}
          className="px-6 py-2.5 bg-volt text-volt-ink rounded-full font-semibold hover:bg-volt-soft disabled:opacity-40 transition-colors"
        >
          {generating ? "Gerando..." : `Gerar combo (${config?.gamesPerCombo ?? "-"} jogos)`}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl p-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Estatísticas */}
          {roi && (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard
                label="ROI fixo"
                value={`${roi.roiPct.toFixed(1)}%`}
                badge={roi.roiPct >= 0 ? "no lucro" : "no prejuízo"}
                badgeTone={roi.roiPct >= 0 ? "up" : "down"}
                sub={`${roi.gamesChecked} jogos conferidos`}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 17l6-6 4 4 8-8" />
                    <path d="M14 7h7v7" />
                  </svg>
                }
              />
              <StatCard
                label="Apostado"
                value={formatBRL(roi.totalSpent)}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                }
              />
              <StatCard
                label="Ganho fixo"
                value={formatBRL(roi.totalFixedWon)}
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v10M9.5 9.5h3.75a1.75 1.75 0 1 1 0 3.5h-2.5a1.75 1.75 0 1 0 0 3.5H15" />
                  </svg>
                }
              />
              <StatCard
                label="Jogos com 11+"
                value={String(hits11Plus)}
                badge={roi.variablePrizeGames > 0 ? `${roi.variablePrizeGames} × 14/15 🎉` : undefined}
                badgeTone="up"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="12" cy="12" r="0.5" fill="currentColor" />
                  </svg>
                }
              />
            </div>
          )}

          {/* Gráfico de frequência */}
          <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5">
            {freq && config ? (
              <FrequencyChart freq={freq} windowSize={config.drawsWindow} />
            ) : (
              <p className="text-sm text-zinc-500">Carregando frequências...</p>
            )}
          </section>

          {/* Último resultado oficial */}
          <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5">
            <h2 className="text-lg font-semibold text-zinc-100 mb-3">
              {loading
                ? "Carregando último resultado..."
                : ultimo
                ? `Último resultado — Concurso #${ultimo.numero} · ${ultimo.dataApuracao}`
                : "Último resultado indisponível"}
            </h2>
            {ultimo && (
              <div className="flex flex-wrap gap-1.5">
                {ultimo.listaDezenas
                  .map((d) => parseInt(d, 10))
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <NumberBall key={n} n={n} state="drawn" />
                  ))}
              </div>
            )}
          </section>

          {/* Último concurso jogado (conferido) */}
          <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5">
            <h2 className="text-lg font-semibold text-zinc-100 mb-3">Último concurso jogado</h2>
            {!lastPlayed ? (
              <p className="text-sm text-zinc-500">
                Nenhum combo conferido ainda. Gere um combo e aguarde o sorteio do concurso alvo.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  Concurso <span className="font-semibold text-zinc-200">#{lastPlayed.targetContest}</span>{" "}
                  — dezenas sorteadas:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[...lastPlayed.result!.drawnNumbers]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <NumberBall key={n} n={n} state="drawn" size="sm" />
                    ))}
                </div>
                <div className="flex flex-wrap gap-6">
                  {lastPlayed.games.map((game, i) => {
                    const hits = countHits(game.numbers, lastPlayed.result!.drawnNumbers);
                    const prize = fixedPrizeFor(hits);
                    return (
                      <div key={i}>
                        <p className="text-xs text-zinc-500 mb-1.5">
                          Jogo {i + 1} — {STRATEGY_LABELS[game.strategy]} —{" "}
                          <span className={`font-semibold ${hits >= 11 ? "text-volt" : "text-zinc-300"}`}>
                            {hits} acertos
                            {prize === null
                              ? " · prêmio variável 🎉"
                              : prize > 0
                              ? ` · ${formatBRL(prize)}`
                              : ""}
                          </span>
                        </p>
                        <Volante
                          marked={game.numbers}
                          drawn={lastPlayed.result!.drawnNumbers}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-4">
          {/* Card do concurso alvo (final 0) */}
          {ultimo && nextTarget && (
            <div className="rounded-3xl p-5 bg-gradient-to-br from-volt via-[#5c7226] to-noir-900 relative overflow-hidden">
              <p className="text-[11px] uppercase tracking-widest font-semibold text-noir-900/80">
                Concurso alvo · Final 0
              </p>
              <p className="text-4xl font-black text-noir-950 mt-1">#{nextTarget}</p>
              <div className="mt-10">
                <p className="text-[11px] uppercase tracking-widest text-zinc-300/80">
                  Já acumulado para o final 0
                </p>
                <p className="text-2xl font-bold text-zinc-50">
                  {typeof ultimo.valorAcumuladoConcurso_0_5 === "number" &&
                  ultimo.valorAcumuladoConcurso_0_5 > 0
                    ? formatBRL(ultimo.valorAcumuladoConcurso_0_5)
                    : "—"}
                </p>
              </div>
            </div>
          )}

          {/* Ações rápidas */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || loading || !ultimo}
              className="px-4 py-2.5 bg-volt text-volt-ink rounded-full text-sm font-semibold hover:bg-volt-soft disabled:opacity-40 transition-colors"
            >
              {generating ? "Gerando..." : "Gerar combo"}
            </button>
            <Link
              href="/history"
              className="px-4 py-2.5 rounded-full text-sm font-medium text-center border border-noir-600 bg-noir-800 text-zinc-300 hover:border-noir-500 transition-colors"
            >
              Histórico
            </Link>
          </div>

          {/* Combo aguardando sorteio */}
          {pendingCombo && (
            <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5">
              <h2 className="text-base font-semibold text-zinc-100">
                Aguardando o concurso{" "}
                <span className="text-volt">#{pendingCombo.targetContest}</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5 mb-4">
                Gerado em {new Date(pendingCombo.createdAt).toLocaleString("pt-BR")}
              </p>
              <div className="space-y-4">
                {pendingCombo.games.map((game, i) => (
                  <div key={i}>
                    <p className="text-xs text-zinc-500 mb-1.5">
                      Jogo {i + 1} — {STRATEGY_LABELS[game.strategy]}
                    </p>
                    <Volante marked={game.numbers} size="sm" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Card de estratégias (CTA) */}
          <div className="rounded-3xl p-5 bg-gradient-to-b from-noir-800 to-[#1e2a12] border border-noir-600">
            <h2 className="text-xl font-bold text-zinc-50">Estratégias</h2>
            <p className="text-sm text-zinc-400 mt-1 mb-4">
              Ajuste roleta viciada, repetição modal, anti-multidão, filtros e o fechamento
              por dispersão.
            </p>
            <Link
              href="/config"
              className="block w-full text-center px-4 py-2.5 bg-volt text-volt-ink rounded-full font-semibold hover:bg-volt-soft transition-colors"
            >
              Configurar motor
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
