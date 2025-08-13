"use client";
import { useState } from "react";

interface Draw {
  numero: number;
  listaDezenas: string[];
  numeroConcursoAnterior: number;
  numeroConcursoProximo: number;
}

type Game = number[];

declare global {
  interface Window {
    localStorage: Storage;
  }
}

interface HistoricEntry {
  contest: number;
  draws: Draw[];
  games: { game1: Game; game2: Game; game3: Game; game4: Game };
}

export default function LotofacilPage() {
  const [loading, setLoading] = useState(false);
  const [setNextDraw] = useState<number | null>(null);
  const [historicEntries, setHistoricEntries] = useState<HistoricEntry[]>([]);
  const [compareResults, setCompareResults] = useState<Record<string, number[]>>({});

  function random7(): number {
    return Number(Math.random().toFixed(7));
  }

  function validGame(game: Array<number>): boolean{

    let resValid = true
    const quadrant = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    const quadrant1 = [1, 6, 11, 16, 21];
    const quadrant2 = [2, 7, 12, 17, 22];
    const quadrant3 = [3, 8, 13, 18, 23];
    const quadrant4 = [4, 9, 14, 19, 24];
    const quadrant5 = [5, 10, 15, 20, 25]


    let count5 = 0;
    let count = 0
    //verificando por quadrante
    quadrant.forEach((d) => {
        count5 += 1;

        if(game.includes(d))
          count += 1;

        if(count5 == 5){
            if(count == 5 || count <= 1) // quandrante nao pode ser totalmente completo como ter so um.
              resValid = false;

            count5 = 0;
            count = 0;        

        }
    })


    count = 0; 
    quadrant1.forEach((d) => {
      if(game.includes(d))
          count += 1;

      if(count == 5)
        resValid = false;

    })

    count = 0; 
    quadrant2.forEach((d) => {
      if(game.includes(d))
          count += 1;

      if(count == 5)
        resValid = false;

    })

    count = 0; 
    quadrant3.forEach((d) => {
      if(game.includes(d))
          count += 1;

      if(count == 5)
        resValid = false;

    })

    count = 0; 
    quadrant4.forEach((d) => {
      if(game.includes(d))
          count += 1;

      if(count == 5)
        resValid = false;

    })

    count = 0; 
    quadrant5.forEach((d) => {
      if(game.includes(d))
          count += 1;

      if(count == 5)
        resValid = false;

    })

    return resValid
  }

  function gerarGame(freq: Map<number, number>):Array<number>{

    let newGame = Array.from(freq.entries())                   // transforma Map em [[n, freq], …]
                .map(([n, f]) => [n, f + random7()] as [number, number])   // adiciona um offset randômico
                .sort((a, b) => b[1] - a[1] || a[0] - b[0])                // primeiro por frequência, depois por número
                .slice(0, 15)
                .sort((a, b) => a[0] - b[0])
                .map(([n]) => n); 


    if(!validGame(newGame))      
      return gerarGame(freq);

    return newGame                
  }

  function gerarGame2(freq: Map<number, number>):Array<number>{

    const base = Array.from(freq.entries()).map(([n, f]) => [n, f + random7()] as [number, number])                     
                    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
                    

    const byFreqDesc = base.slice(0, 10).map(([n]) => n);

   const fill = base.map(([n, f]) => [n, random7()] as [number, number]) 
                .map(([n]) => n).filter((n) => !byFreqDesc.includes(n))
                .slice(0, 15 - byFreqDesc.length);
   

    let newGame = [...byFreqDesc, ...fill].sort((a, b) => a - b);
    if(!validGame(newGame))      
      return gerarGame2(freq);

    return newGame                
  }

  const fetchAndGenerate = async () => {
    setLoading(true);
    try {
      const resp = await fetch("https://api.guidi.dev.br/loteria/lotofacil/ultimo");
      const ultimo: Draw = await resp.json();
      const collected: Draw[] = [ultimo];
      let current = ultimo;

      for (let i = 1; i < 7; i++) {
        const r = await fetch(`https://api.guidi.dev.br/loteria/lotofacil/${current.numeroConcursoAnterior}`);
        const d: Draw = await r.json();
        collected.push(d);
        current = d;
      }

      setNextDraw(ultimo.numeroConcursoProximo);

      const freq = new Map<number, number>();
      collected.forEach((draw) => {
        draw.listaDezenas.forEach((d) => {
          const n = parseInt(d, 10);
          freq.set(n, (freq.get(n) || 0) + 1);
        });
      });

      const newGames = {game1: gerarGame(freq), game2: gerarGame(freq), game3: gerarGame2(freq), game4: gerarGame2(freq)};

      window.localStorage.setItem(
        `lotofacil_${ultimo.numeroConcursoProximo}`,
        JSON.stringify({ draws: collected, games: newGames })
      );

      loadAllHistoric();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllHistoric = () => {
    const entries: HistoricEntry[] = [];
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith('lotofacil_')) {
        const data = window.localStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          const contestNum = parseInt(key.split('_')[1], 10);
          entries.push({ contest: contestNum, draws: parsed.draws, games: parsed.games });
        }
      }
    });
    setHistoricEntries(entries.sort((a, b) => b.contest - a.contest));
  };

  const deleteEntry = (contest: number) => {
    window.localStorage.removeItem(`lotofacil_${contest}`);
    setHistoricEntries((prev) => prev.filter((e) => e.contest !== contest));
  };

  const compareEntry = async (contest: number) => {
    try {
      const resp = await fetch(`https://api.guidi.dev.br/loteria/lotofacil/${contest}`);
      const draw: Draw = await resp.json();
      const drawnNums = draw.listaDezenas.map((d) => parseInt(d, 10));
      const results: Record<string, number[]> = {};
      const entry = historicEntries.find((e) => e.contest === contest);
      if (entry) {
        Object.entries(entry.games).forEach(([key, jogo]) => {
          results[`${contest}_${key}`] = jogo.filter((n) => drawnNums.includes(n));
        });
        setCompareResults(results);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // on mount, load existing historic
  useState(() => {
    loadAllHistoric();
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold text-sky-600 mb-4">Lotofácil - Histórico de Jogos</h1>
      <div className="flex gap-2 mb-4">
        <button
          onClick={fetchAndGenerate}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          disabled={loading}
        >
          {loading ? 'Carregando...' : 'Gerar Jogos'}
        </button>
        <button
          onClick={loadAllHistoric}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Resultado
        </button>
      </div>

      <div className="w-full max-w-4xl space-y-6">
        {historicEntries.map((entry) => (
          <div key={entry.contest} className="bg-white p-4 rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-sky-600">
                Concurso #{entry.contest}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => compareEntry(entry.contest)}
                  className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Comparar
                </button>
                <button
                  onClick={() => deleteEntry(entry.contest)}
                  className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </div>
            {Object.entries(entry.games).map(([key]) => (
              <div key={key} className="mb-2">
                <h3 className="font-medium text-zinc-500">
                  {key === 'game1'
                    ? 'Mais Sorteados'
                    : key === 'game2'
                    ? 'Menos Sorteados'
                    : key === 'game3'
                    ? '7 Mais + 8 Menos'
                    : 'Base + Menos'}
                </h3>
                <div className="grid grid-cols-5 gap-1 mt-1">
                  {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => {
                    const isGenerated = entry.games[key].includes(n);
                    const isHit = compareResults[`${entry.contest}_${key}`]?.includes(n);
                    const bgColor = isHit ? 'bg-green-500 text-white' : isGenerated ? 'bg-gray-200 text-zinc-700' : 'bg-white border text-zinc-700';
                    return (
                      <span
                        key={n}
                        className={`flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full text-sm ${bgColor}`}
                      >
                        {n}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
