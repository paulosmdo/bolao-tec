"use client";
import { useEffect, useState } from "react";
import {
  FILTER_LABELS,
  MAX_GAME_SIZE,
  MIN_GAME_SIZE,
  STRATEGY_LABELS,
  clampGameSize,
} from "@/lib/lotofacil/constants";
import { formatBRL, ticketCombinations, ticketCost } from "@/lib/lotofacil/stats";
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

  const gameSize = clampGameSize(config.numbersPerGame);

  const handleSave = () => {
    // trava mínima de sanidade antes de persistir
    const clean: AppConfig = {
      ...config,
      gamesPerCombo: Math.min(Math.max(Math.round(config.gamesPerCombo) || 1, 1), 100),
      numbersPerGame: gameSize,
      drawsWindow: Math.min(Math.max(Math.round(config.drawsWindow) || 10, 3), 50),
      strongBaseFixed: Math.min(Math.max(Math.round(config.strongBaseFixed) || 10, 1), gameSize - 1),
      modalRepeatCount: Math.min(
        Math.max(Math.round(config.modalRepeatCount) || 9, Math.max(5, gameSize - 10)),
        15
      ),
      profileWindow: Math.min(Math.max(Math.round(config.profileWindow) || 100, 20), 300),
      profileSigma: Math.min(Math.max(Number(config.profileSigma) || 1, 0.5), 3),
      ticketPrice: Math.max(config.ticketPrice || 0, 0),
      matrixFixedCount: Math.min(Math.max(Math.round(config.matrixFixedCount) || 9, 5), gameSize - 3),
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
          <span className="text-sm text-zinc-400">
            Quantidade de dezenas por jogo ({MIN_GAME_SIZE}–{MAX_GAME_SIZE})
          </span>
          <input
            type="number"
            min={MIN_GAME_SIZE}
            max={MAX_GAME_SIZE}
            value={config.numbersPerGame}
            onChange={(e) => update({ numbersPerGame: Number(e.target.value) })}
            className={inputClass}
          />
          <span className="block text-xs text-zinc-500 mt-1.5">
            {gameSize === 15
              ? "Aposta simples: 1 combinação por jogo."
              : `Um jogo de ${gameSize} dezenas embute ${ticketCombinations(gameSize).toLocaleString("pt-BR")} apostas de 15 e custa ${formatBRL(ticketCost(gameSize, config.ticketPrice))}. Os acertos pagam pelo desdobramento (todas as apostas embutidas).`}
          </span>
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
          <span className="text-sm text-zinc-400">Preço da aposta de 15 dezenas (R$) — para o ROI</span>
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
          label={`Base Forte (${config.strongBaseFixed} fixos + ${gameSize - config.strongBaseFixed} aleatórios)`}
          checked={config.strategies.strongBase}
          onChange={(v) => update({ strategies: { ...config.strategies, strongBase: v } })}
        />
        {config.strategies.strongBase && (
          <label className="block py-3 border-b border-noir-700/60">
            <span className="text-sm text-zinc-400">
              Dezenas fixas da Base Forte (as mais frequentes da janela, 1–{gameSize - 1})
            </span>
            <input
              type="number"
              min={1}
              max={gameSize - 1}
              value={config.strongBaseFixed}
              onChange={(e) => update({ strongBaseFixed: Number(e.target.value) })}
              className={inputClass}
            />
          </label>
        )}
        <Toggle
          label={`Repetição Modal (${config.modalRepeatCount} do último + ${gameSize - config.modalRepeatCount} ausentes)`}
          checked={config.strategies.modalRepeat}
          onChange={(v) => update({ strategies: { ...config.strategies, modalRepeat: v } })}
        />
        {config.strategies.modalRepeat && (
          <label className="block py-3 border-b border-noir-700/60">
            <span className="text-sm text-zinc-400">
              Dezenas repetidas do último concurso ({Math.max(5, gameSize - 10)}–15; sorteia ±1 em torno deste valor)
            </span>
            <input
              type="number"
              min={Math.max(5, gameSize - 10)}
              max={15}
              value={config.modalRepeatCount}
              onChange={(e) => update({ modalRepeatCount: Number(e.target.value) })}
              className={inputClass}
            />
          </label>
        )}
        <Toggle
          label={STRATEGY_LABELS.antiCrowd}
          checked={config.strategies.antiCrowd}
          onChange={(v) => update({ strategies: { ...config.strategies, antiCrowd: v } })}
        />
        <Toggle
          label={STRATEGY_LABELS.statProfile}
          checked={config.strategies.statProfile}
          onChange={(v) => update({ strategies: { ...config.strategies, statProfile: v } })}
        />
        {config.strategies.statProfile && (
          <div className="grid grid-cols-2 gap-3 pt-3">
            <label className="block">
              <span className="text-sm text-zinc-400">Janela do perfil (concursos)</span>
              <input
                type="number"
                min={20}
                max={300}
                value={config.profileWindow}
                onChange={(e) => update({ profileWindow: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-400">Rigidez do filtro (σ, desvios padrão)</span>
              <input
                type="number"
                min={0.5}
                max={3}
                step={0.5}
                value={config.profileSigma}
                onChange={(e) => update({ profileSigma: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
          </div>
        )}
        <div className="text-xs text-zinc-500 mt-3 space-y-1.5">
          <p>
            Os jogos do combo alternam entre as estratégias ligadas (todas desligadas = Roleta
            Viciada como padrão).
          </p>
          <p>
            <span className="font-medium text-zinc-400">Repetição Modal:</span> ~79% dos
            concursos repetem 8 a 10 dezenas do anterior (moda estatística: 9). Sorteia
            k∈{"{c−1, c, c+1}"} repetidas em torno do valor configurado c e completa com as
            ausentes.
          </p>
          <p>
            <span className="font-medium text-zinc-400">Anti-Multidão:</span> os prêmios de
            14/15 são rateados — evitar padrões que humanos jogam em massa (sequências, linhas
            do volante, cópia do último resultado) aumenta o prêmio se você ganhar.
          </p>
          <p>
            <span className="font-medium text-zinc-400">Perfil Estatístico:</span> mede
            nos últimos N concursos a média e o desvio padrão de 5 métricas — ímpares,
            primos, Fibonacci, soma das 15 dezenas e repetidas do concurso anterior — e
            descarta todo jogo que caia fora da banda média ± σ × desvio em qualquer uma
            delas.
          </p>
          <p>
            <span className="font-medium text-zinc-400">Rigidez (σ):</span> é o multiplicador
            do desvio. Exemplo com a soma (média ≈ 193, desvio ≈ 17): σ = 0,5 aceita 185–202
            (muito rígido, poucos jogos passam); σ = 1 aceita 176–211 (rígido, padrão —
            descarta ~2/3 dos candidatos); σ = 2 aceita 159–228 (folgado, ~90% dos sorteios
            reais cabem); σ = 3 praticamente não filtra.
          </p>
          <p>
            Importante: a taxa de aprovação é a mesma para sorteios reais e para combinações
            aleatórias (~1/3 a 1σ). Diminuir σ deixa os jogos mais &quot;típicos&quot;, não mais
            prováveis de acertar. O que melhora o retorno é o Anti-Multidão — por isso, entre
            os aprovados, esta estratégia escolhe o jogo menos popular.
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
        <div className="mt-4 border-t border-noir-700/60 pt-1">
          <Toggle
            label="Fechamento por Matriz Combinatória (fixas + blocos espaçados)"
            checked={config.matrixClosing}
            onChange={(v) => update({ matrixClosing: v })}
          />
          {config.matrixClosing && (
            <label className="block pt-3">
              <span className="text-sm text-zinc-400">
                Dezenas fixas em todos os bilhetes (as mais frequentes da janela)
              </span>
              <input
                type="number"
                min={5}
                max={gameSize - 3}
                value={config.matrixFixedCount}
                onChange={(e) => update({ matrixFixedCount: Number(e.target.value) })}
                className={inputClass}
              />
            </label>
          )}
          <p className="text-xs text-zinc-500 mt-3">
            Etapa final, aplicada sobre os jogos já gerados: as N dezenas mais frequentes
            entram fixas em todos os bilhetes e as demais são distribuídas por uma matriz
            combinatória, para que dois bilhetes quaisquer compartilhem o mínimo possível fora
            das fixas e cada dezena variável apareça um número parecido de vezes. Evita jogos
            quase iguais (2,3,5,10,15 e 2,3,5,10,14) em favor de blocos espaçados (2,3,5,9,19
            e 2,3,5,11,20). Bilhetes que não puderam vir de um jogo gerado aparecem como
            &quot;Matriz Combinatória&quot;.
          </p>
        </div>
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
