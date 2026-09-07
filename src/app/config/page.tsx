"use client";
import { useEffect, useState } from "react";
import { FILTER_LABELS, STRATEGY_LABELS } from "@/lib/lotofacil/constants";
import { loadConfig, saveConfig } from "@/lib/lotofacil/storage";
import type { AppConfig } from "@/lib/lotofacil/types";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 cursor-pointer border-b border-noir-700/60 last:border-0">
      <span className="text-sm text-zinc-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? "bg-volt" : "bg-noir-600"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-all ${
            checked ? "left-[22px] bg-noir-950" : "left-0.5 bg-zinc-400"
          }`}
        />
      </button>
    </label>
  );
}

const inputClass =
  "mt-1.5 w-full bg-noir-700 border border-noir-600 rounded-xl px-3 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-volt/60";

export default function ConfigPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  if (!config) return null;

  const update = (patch: Partial<AppConfig>) => {
    setConfig({ ...config, ...patch });
    setSaved(false);
  };

  const handleSave = () => {
    // trava mínima de sanidade antes de persistir
    const clean: AppConfig = {
      ...config,
      gamesPerCombo: Math.min(Math.max(Math.round(config.gamesPerCombo) || 1, 1), 100),
      drawsWindow: Math.min(Math.max(Math.round(config.drawsWindow) || 10, 3), 50),
      ticketPrice: Math.max(config.ticketPrice || 0, 0),
    };
    setConfig(clean);
    saveConfig(clean);
    setSaved(true);
  };

  return (
    <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-50">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Controle o motor de geração, as estratégias e os filtros de padrão.
        </p>
      </div>

      <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-100">Geração de combos</h2>

        <label className="block">
          <span className="text-sm text-zinc-400">Quantidade de jogos por combo</span>
          <input
            type="number"
            min={1}
            max={100}
            value={config.gamesPerCombo}
            onChange={(e) => update({ gamesPerCombo: Number(e.target.value) })}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-400">Janela de análise (últimos N concursos)</span>
          <input
            type="number"
            min={3}
            max={50}
            value={config.drawsWindow}
            onChange={(e) => update({ drawsWindow: Number(e.target.value) })}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm text-zinc-400">Preço da aposta (R$) — para o ROI</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={config.ticketPrice}
            onChange={(e) => update({ ticketPrice: Number(e.target.value) })}
            className={inputClass}
          />
        </label>
      </section>

      <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5">
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">Estratégias</h2>
        <Toggle
          label={STRATEGY_LABELS.weighted}
          checked={config.strategies.weighted}
          onChange={(v) => update({ strategies: { ...config.strategies, weighted: v } })}
        />
        <Toggle
          label={STRATEGY_LABELS.strongBase}
          checked={config.strategies.strongBase}
          onChange={(v) => update({ strategies: { ...config.strategies, strongBase: v } })}
        />
        <Toggle
          label={STRATEGY_LABELS.modalRepeat}
          checked={config.strategies.modalRepeat}
          onChange={(v) => update({ strategies: { ...config.strategies, modalRepeat: v } })}
        />
        <Toggle
          label={STRATEGY_LABELS.antiCrowd}
          checked={config.strategies.antiCrowd}
          onChange={(v) => update({ strategies: { ...config.strategies, antiCrowd: v } })}
        />
        <div className="text-xs text-zinc-500 mt-3 space-y-1.5">
          <p>
            Os jogos do combo alternam entre as estratégias ligadas (todas desligadas = Roleta
            Viciada como padrão).
          </p>
          <p>
            <span className="font-medium text-zinc-400">Repetição Modal:</span> ~79% dos
            concursos repetem 8 a 10 dezenas do anterior (moda estatística: 9). Sorteia
            k∈{"{8,9,10}"} repetidas e completa com as ausentes.
          </p>
          <p>
            <span className="font-medium text-zinc-400">Anti-Multidão:</span> os prêmios de
            14/15 são rateados — evitar padrões que humanos jogam em massa (sequências, linhas
            do volante, cópia do último resultado) aumenta o prêmio se você ganhar.
          </p>
        </div>
      </section>

      <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5">
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">Filtros de padrão</h2>
        <Toggle
          label={FILTER_LABELS.oddEven}
          checked={config.filters.oddEven}
          onChange={(v) => update({ filters: { ...config.filters, oddEven: v } })}
        />
        <Toggle
          label={FILTER_LABELS.frame}
          checked={config.filters.frame}
          onChange={(v) => update({ filters: { ...config.filters, frame: v } })}
        />
        <Toggle
          label={FILTER_LABELS.sum}
          checked={config.filters.sum}
          onChange={(v) => update({ filters: { ...config.filters, sum: v } })}
        />
        <p className="text-xs text-zinc-500 mt-3">
          Se um jogo não conseguir satisfazer todos os filtros (ex.: Base Forte com top-10
          concentrado no miolo), o motor relaxa os filtros um a um em vez de travar.
        </p>
      </section>

      <section className="bg-noir-800 border border-noir-600 rounded-3xl p-5">
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">Otimizador de combo</h2>
        <Toggle
          label="Fechamento por Dispersão (jogos pouco sobrepostos)"
          checked={config.dispersion}
          onChange={(v) => update({ dispersion: v })}
        />
        <p className="text-xs text-zinc-500 mt-3">
          Gera 4x mais candidatos e escolhe os N jogos com a menor sobreposição entre si (dois
          jogos de 15 dezenas compartilham no mínimo 5, em média 9). Combos dispersos cobrem
          mais resultados possíveis e evitam que todos os bilhetes percam juntos.
        </p>
      </section>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-volt text-volt-ink rounded-full font-semibold hover:bg-volt-soft transition-colors"
        >
          Salvar configurações
        </button>
        {saved && <span className="text-sm text-volt font-medium">Salvo ✓</span>}
      </div>
    </main>
  );
}
