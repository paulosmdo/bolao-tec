"use client";
import { useEffect, useMemo, useState } from "react";
import NumberBall from "@/components/lotofacil/NumberBall";
import { STRATEGY_LABELS } from "@/lib/lotofacil/constants";
import { countHits, fixedPrizeFor, formatBRL } from "@/lib/lotofacil/stats";
import { deleteCombo, loadCombos, loadConfig, updateCombo } from "@/lib/lotofacil/storage";
import type { Combo } from "@/lib/lotofacil/types";
import { getConcurso } from "@/services/lotofacilApi";

const MIN_HITS_OPTIONS = [
  { value: "all", label: "Todos os acertos" },
  { value: "11", label: "11+ acertos" },
  { value: "12", label: "12+ acertos" },
  { value: "13", label: "13+ acertos" },
  { value: "14", label: "14+ acertos" },
  { value: "15", label: "15 acertos" },
];

const inputClass =
  "mt-1.5 w-full bg-noir-700 border border-noir-600 rounded-xl px-3 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-volt/60";

export default function HistoryPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [ticketPrice, setTicketPrice] = useState(3.5);
  const [dateFilter, setDateFilter] = useState("");
  const [contestFilter, setContestFilter] = useState("");
  const [minHits, setMinHits] = useState("all");
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setCombos(loadCombos());
    setTicketPrice(loadConfig().ticketPrice);
  }, []);

  const handleCheck = async (combo: Combo) => {
    setCheckingId(combo.id);
    setMessage(null);
    try {
      const draw = await getConcurso(combo.targetContest);
      if (draw.numero !== combo.targetContest) {
        throw new Error("Concurso ainda não realizado");
      }
      setCombos(
        updateCombo(combo.id, {
          result: {
            drawnNumbers: draw.listaDezenas.map((d) => parseInt(d, 10)),
            checkedAt: new Date().toISOString(),
          },
        })
      );
    } catch {
      setMessage(
        `Não foi possível conferir o concurso #${combo.targetContest}. Provavelmente ainda não foi realizado.`
      );
    } finally {
      setCheckingId(null);
    }
  };

  const startEdit = (combo: Combo) => {
    setEditingId(combo.id);
    setEditValue(String(combo.targetContest));
    setMessage(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  /**
   * Troca o concurso alvo do combo. A conferência pertence ao concurso antigo,
   * então é descartada: o combo volta a "pendente" e o dashboard confere de
   * novo sozinho (ou via "Conferir") assim que o novo concurso sair.
   */
  const saveEdit = (combo: Combo) => {
    const target = Math.round(Number(editValue));
    if (!Number.isInteger(target) || target < 1 || target > 999999) {
      setMessage("Informe um número de concurso válido.");
      return;
    }
    if (target === combo.targetContest) {
      cancelEdit();
      return;
    }
    if (
      combo.result &&
      !window.confirm(
        `Este combo já foi conferido contra o concurso #${combo.targetContest}. Mudar para #${target} apaga a conferência (você pode conferir de novo). Continuar?`
      )
    ) {
      return;
    }
    setCombos(updateCombo(combo.id, { targetContest: target, result: undefined }));
    cancelEdit();
  };

  const handleDelete = (combo: Combo) => {
    if (!window.confirm(`Excluir o combo do concurso #${combo.targetContest}?`)) return;
    setCombos(deleteCombo(combo.id));
  };

  const filtered = useMemo(() => {
    return combos
      .map((combo) => {
        // filtro por número mínimo de acertos: mantém só os jogos que batem
        if (minHits === "all" || !combo.result) return { combo, games: combo.games };
        const min = Number(minHits);
        const games = combo.games.filter(
          (g) => countHits(g.numbers, combo.result!.drawnNumbers) >= min
        );
        return { combo, games };
      })
      .filter(({ combo, games }) => {
        if (dateFilter && !combo.createdAt.startsWith(dateFilter)) return false;
        if (contestFilter && combo.targetContest !== Number(contestFilter)) return false;
        if (minHits !== "all" && (!combo.result || games.length === 0)) return false;
        return true;
      });
  }, [combos, dateFilter, contestFilter, minHits]);

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">Histórico de Combos</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Todos os combos gerados e conferidos, com filtros por data, concurso e acertos.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-noir-800 border border-noir-600 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Data de geração</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Concurso</span>
          <input
            type="number"
            placeholder="ex: 3740"
            value={contestFilter}
            onChange={(e) => setContestFilter(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Acertos</span>
          <select
            value={minHits}
            onChange={(e) => setMinHits(e.target.value)}
            className={inputClass}
          >
            {MIN_HITS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message && (
        <div className="bg-amber-400/10 border border-amber-400/30 text-amber-300 rounded-2xl p-3 text-sm">
          {message}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-zinc-500">Nenhum combo encontrado com esses filtros.</p>
      )}

      {filtered.map(({ combo, games }) => {
        const drawn = combo.result?.drawnNumbers;
        const comboWon = drawn
          ? combo.games.reduce((acc, g) => {
              const prize = fixedPrizeFor(countHits(g.numbers, drawn));
              return acc + (prize ?? 0);
            }, 0)
          : 0;
        const comboSpent = combo.games.length * ticketPrice;

        return (
          <div key={combo.id} className="bg-noir-800 border border-noir-600 rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                {editingId === combo.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-zinc-100">Concurso</span>
                    <input
                      type="number"
                      min={1}
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(combo);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="w-28 bg-noir-700 border border-volt/60 rounded-xl px-3 py-1.5 text-zinc-100 focus:outline-none"
                    />
                    <button
                      onClick={() => saveEdit(combo)}
                      className="px-3 py-1.5 rounded-full text-sm font-semibold bg-volt text-volt-ink hover:bg-volt-soft transition-colors"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 rounded-full text-sm border border-noir-600 text-zinc-300 hover:bg-noir-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                    <span>
                      Concurso <span className="text-volt">#{combo.targetContest}</span>
                    </span>
                    <button
                      onClick={() => startEdit(combo)}
                      title="Editar número do concurso"
                      aria-label="Editar número do concurso"
                      className="p-1 rounded-full text-zinc-500 hover:text-volt hover:bg-noir-700 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                  </h2>
                )}
                <p className="text-xs text-zinc-500">
                  Gerado em {new Date(combo.createdAt).toLocaleString("pt-BR")} ·{" "}
                  {combo.games.length} jogos · {formatBRL(comboSpent)}
                  {drawn && (
                    <>
                      {" "}
                      · ganho fixo:{" "}
                      <span className={comboWon >= comboSpent ? "text-volt" : "text-red-400"}>
                        {formatBRL(comboWon)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                {!combo.result && (
                  <button
                    onClick={() => handleCheck(combo)}
                    disabled={checkingId === combo.id}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold bg-volt text-volt-ink hover:bg-volt-soft disabled:opacity-40 transition-colors"
                  >
                    {checkingId === combo.id ? "Conferindo..." : "Conferir"}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(combo)}
                  className="px-4 py-1.5 rounded-full text-sm border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </div>

            {drawn && (
              <div className="flex flex-wrap gap-1 mb-4">
                {[...drawn]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <NumberBall key={n} n={n} state="drawn" size="sm" />
                  ))}
              </div>
            )}

            <div className="space-y-3">
              {games.map((game, i) => {
                const hits = drawn ? countHits(game.numbers, drawn) : null;
                const prize = hits !== null ? fixedPrizeFor(hits) : 0;
                return (
                  <div key={i}>
                    <p className="text-xs text-zinc-500 mb-1.5">
                      {STRATEGY_LABELS[game.strategy] ?? game.strategy}
                      {game.relaxedFilters.length > 0 && (
                        <span className="text-amber-400/80">
                          {" "}
                          · filtros relaxados: {game.relaxedFilters.join(", ")}
                        </span>
                      )}
                      {hits !== null && (
                        <span
                          className={`font-semibold ${hits >= 11 ? "text-volt" : "text-zinc-300"}`}
                        >
                          {" "}
                          · {hits} acertos
                          {prize === null
                            ? " · prêmio variável 🎉"
                            : prize > 0
                            ? ` · ${formatBRL(prize)}`
                            : ""}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {game.numbers.map((n) => (
                        <NumberBall
                          key={n}
                          n={n}
                          size="sm"
                          state={drawn ? (drawn.includes(n) ? "hit" : "marked") : "marked"}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </main>
  );
}
