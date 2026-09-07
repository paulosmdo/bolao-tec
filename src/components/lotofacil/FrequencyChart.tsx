"use client";

interface FrequencyChartProps {
  /** Frequência de saída por dezena (1..25) na janela analisada */
  freq: Map<number, number>;
  windowSize: number;
}

/**
 * Barras da frequência das 25 dezenas. A dezena mais quente ganha destaque em
 * lima com rótulo direto; as demais mostram o valor no hover. Barras neutras
 * são propositalmente discretas — o "relief" de leitura vem dos rótulos de
 * dezena sob cada barra, dos ticks e do tooltip.
 */
export default function FrequencyChart({ freq, windowSize }: FrequencyChartProps) {
  const data = Array.from({ length: 25 }, (_, i) => ({
    n: i + 1,
    count: freq.get(i + 1) ?? 0,
  }));
  const max = Math.max(...data.map((d) => d.count), 1);
  const hottest = data.reduce((a, b) => (b.count > a.count ? b : a));

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Frequência das dezenas</h2>
          <p className="text-3xl font-bold text-zinc-50 mt-1">
            {String(hottest.n).padStart(2, "0")}
            <span className="text-sm font-medium text-zinc-500 ml-2">
              dezena mais quente · {hottest.count}x
            </span>
          </p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full border border-noir-600 bg-noir-900 text-zinc-400 whitespace-nowrap">
          Últimos {windowSize} concursos
        </span>
      </div>

      <div className="relative mt-10 pl-7">
        {/* gridlines + ticks (0, metade, máximo) */}
        {[0, 0.5, 1].map((t) => (
          <div
            key={t}
            className="absolute left-7 right-0 border-t border-noir-700/60"
            style={{ bottom: `${18 + t * 128}px` }}
          >
            <span className="absolute -left-7 -top-2 text-[10px] text-zinc-600 w-5 text-right">
              {Math.round(t * max)}
            </span>
          </div>
        ))}

        <div className="relative flex items-end gap-[3px] h-[164px]">
          {data.map(({ n, count }) => {
            const isHot = n === hottest.n;
            const height = Math.max((count / max) * 128, 3);
            return (
              <div key={n} className="group relative flex-1 flex flex-col items-center justify-end h-full">
                {/* rótulo direto na barra destacada; tooltip nas demais */}
                <span
                  className={`absolute z-10 px-2 py-0.5 rounded-full bg-zinc-50 text-noir-950 text-[10px] font-semibold whitespace-nowrap shadow ${
                    isHot ? "" : "opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
                  }`}
                  style={{ bottom: `${height + 26}px` }}
                >
                  {String(n).padStart(2, "0")} · {count}x
                </span>
                <div
                  className={`w-full max-w-[18px] rounded-t ${
                    isHot
                      ? "bg-gradient-to-t from-volt-dim to-volt"
                      : "bg-noir-500/80 group-hover:bg-noir-500"
                  }`}
                  style={{ height: `${height}px` }}
                />
                <span
                  className={`mt-1.5 text-[9px] h-3 leading-3 ${
                    isHot ? "text-volt font-semibold" : "text-zinc-600"
                  }`}
                >
                  {String(n).padStart(2, "0")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
