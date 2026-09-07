import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { bulkToDraw, isValidBulkDraw, type BulkDraw } from "@/lib/lotofacil/bulk";
import type { Draw } from "@/lib/lotofacil/types";

/**
 * Histórico em lote para o Perfil Estatístico.
 *
 * A api.guidi.dev.br só serve UM concurso por chamada e limita a taxa
 * (bursts de 10 paralelas devolvem 429), então buscar 100 concursos por lá
 * levaria minutos. A loteriascaixa-api devolve TODOS os concursos numa
 * chamada (~7 MB, ~1,5 s); este handler mapeia o payload para o formato
 * `Draw` usado no app e devolve apenas os HISTORY_LIMIT mais recentes.
 *
 * O cache de dados do Next recusa itens acima de 2 MB, então o fetch bruto
 * vai com `no-store` e o que fica cacheado (1 h, via unstable_cache) é o
 * resultado já fatiado (~100 KB). Erros do upstream não são cacheados.
 */
const UPSTREAM_BULK = "https://loteriascaixa-api.herokuapp.com/api/lotofacil";
const HISTORY_LIMIT = 300;
const CACHE_SECONDS = 3600;

export const dynamic = "force-dynamic";

const loadHistory = unstable_cache(
  async (): Promise<Draw[]> => {
    const res = await fetch(UPSTREAM_BULK, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API de histórico respondeu ${res.status}`);

    const bulk = (await res.json()) as BulkDraw[];
    return bulk
      .filter(isValidBulkDraw)
      .sort((a, b) => b.concurso - a.concurso)
      .slice(0, HISTORY_LIMIT)
      .map(bulkToDraw);
  },
  ["lotofacil-historico"],
  { revalidate: CACHE_SECONDS }
);

export async function GET() {
  try {
    return NextResponse.json(await loadHistory());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao consultar o histórico de resultados",
      },
      { status: 502 }
    );
  }
}
