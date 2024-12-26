"use client";
import { useEffect, useState } from "react";

const jogos = [
  [7, 10, 17, 20, 43, 51],
  [2, 9, 26, 27, 35, 48],
  [1, 16, 23, 28, 47, 50],
  [6, 11, 16, 22, 28, 49],
  [5, 21, 25, 32, 41, 52],
  [12, 19, 24, 27, 33, 45],
  [9, 19, 23, 31, 45, 56],
  [5, 8, 13, 20, 35, 55],
  [3, 12, 23, 35, 47, 54],
  [5, 14, 26, 33, 42, 58],
  [8, 19, 27, 36, 44, 60],
  [10, 18, 29, 37, 45, 53],
  [4, 15, 21, 35, 53, 55],
  [3, 19, 35, 38, 40, 44],
  [20, 28, 45, 46, 48, 58],
  [5, 9, 23, 32, 42, 53],
  [3, 9, 14, 20, 51, 56],
  [6, 10, 21, 26, 39, 45],
  [11, 17, 24, 39, 54, 58],
  [15, 19, 38, 50, 57, 59],
  [2, 4, 30, 39, 41, 42],
  [13, 28, 39, 40, 44, 51],
  [13, 29, 37, 45, 53, 60],
  [1, 5, 20, 40, 42, 49],
  [25, 26, 28, 47, 50, 51],
  [5, 11, 15, 29, 30, 33],
  [4, 11, 22, 24, 33, 43],
  [7, 10, 14, 46, 48, 53],
  [29, 41, 45, 48, 52, 54],
  [4, 13, 25, 47, 50, 51],
];

export default function Home() {
  const [numerosSorteados, setNumerosSorteados] = useState<number[]>([]);
  const [acertos, setAcertos] = useState<Record<number, number[][]>>({
    4: [],
    5: [],
    6: [],
  });

  useEffect(() => {
    const fetchNumerosSorteados = async () => {
      const response = await fetch("https://api.guidi.dev.br/loteria/megasena/2810");
      const data = await response.json();
      const sorteados = data.listaDezenas.map((n: string) => parseInt(n, 10));
      setNumerosSorteados(sorteados);

      // Calcula acertos
      const novosAcertos: Record<number, number[][]> = { 4: [], 5: [], 6: [] };
      jogos.forEach((jogo) => {
        const acertos = jogo.filter((numero) => sorteados.includes(numero)).length;
        if (acertos >= 4) {
          novosAcertos[acertos].push(jogo);
        }
      });
      setAcertos(novosAcertos);
    };

    fetchNumerosSorteados();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full mx-auto bg-white rounded shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4 text-center text-sky-600">
          Resultados da Mega Sena
        </h1>

        {/* Números Sorteados */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-sky-600">Números Sorteados</h2>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {numerosSorteados.map((numero) => (
              <span
                key={numero}
                className="flex items-center justify-center w-10 h-10 bg-green-500 text-white rounded-full text-lg"
              >
                {numero}
              </span>
            ))}
          </div>
        </div>

        {/* Jogos com Acertos */}
        {([6, 5, 4] as const).map((quantidade) => (
          <div key={quantidade} className="mb-6 text-center">
            <h2 className="text-lg font-semibold text-sky-600">
              Jogos com {quantidade} acertos ({acertos[quantidade].length})
            </h2>
            <div className="flex flex-col gap-2 mt-2 items-center">
              {acertos[quantidade].map((jogo, index) => (
                <div key={index} className="flex gap-2 justify-center">
                  {jogo.map((numero) => (
                    <span
                      key={numero}
                      className={`flex items-center justify-center w-10 h-10 ${
                        numerosSorteados.includes(numero)
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 text-zinc-600"
                      } rounded-full text-lg`}
                    >
                      {numero}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Todos os Jogos */}
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4 text-sky-600">Todos os Jogos</h2>
          <div className="flex flex-col gap-2 items-center">
            {jogos.map((jogo, index) => (
              <div key={index} className="flex gap-2 justify-center">
                {jogo.map((numero) => (
                  <span
                    key={numero}
                    className={`flex items-center justify-center w-10 h-10 ${
                      numerosSorteados.includes(numero)
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-zinc-600"
                    } rounded-full text-lg`}
                  >
                    {numero}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

  );
}
