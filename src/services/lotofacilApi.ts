import { bulkToDraw, isValidBulkDraw, type BulkDraw } from "@/lib/lotofacil/bulk";
import type { Draw } from "@/lib/lotofacil/types";

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

/**
 * Na web, as chamadas passam pelo proxy interno (/api/lotofacil/...), que
 * roda no servidor Next — logo NUNCA há CORS e os concursos passados ficam
 * cacheados no servidor.
 *
 * No APK (Capacitor), não existe servidor Next: o fetch vai direto ao
 * upstream. O plugin CapacitorHttp roteia o fetch pela camada nativa do
 * Android, onde CORS não se aplica.
 */
const UPSTREAM_URL = "https://api.guidi.dev.br/loteria/lotofacil";
/** Todos os concursos numa chamada (~5 MB) — usado só quando não há proxy */
const UPSTREAM_BULK_URL = "https://loteriascaixa-api.herokuapp.com/api/lotofacil";

const isNative = () =>
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

const baseUrl = () => (isNative() ? UPSTREAM_URL : "/api/lotofacil");

async function fetchJson<T>(
  url: string,
  { timeoutMs = 10000, retries = 2 } = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      // backoff simples antes de tentar de novo
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Falha ao consultar a API de resultados");
}

export function getConcurso(id: number | "ultimo"): Promise<Draw> {
  return fetchJson<Draw>(`${baseUrl()}/${id}`);
}

/**
 * Busca o último concurso e os `windowSize - 1` anteriores.
 *
 * Concorrência limitada (não Promise.all cru): a API upstream devolve 429
 * em bursts paralelos — com 10 simultâneas, 96 de 100 chamadas falharam
 * num teste. Duas em voo + retry do fetchJson é o que passa.
 */
export async function getUltimosConcursos(
  windowSize: number
): Promise<{ ultimo: Draw; draws: Draw[] }> {
  const ultimo = await getConcurso("ultimo");
  const previousIds = Array.from(
    { length: Math.max(windowSize - 1, 0) },
    (_, i) => ultimo.numero - (i + 1)
  ).filter((n) => n > 0);

  const previous = await mapWithConcurrency(previousIds, 2, (id) => getConcurso(id));
  return { ultimo, draws: [ultimo, ...previous] };
}

/**
 * Histórico dos `windowSize` concursos mais recentes, do mais novo ao mais
 * antigo, para o Perfil Estatístico (janela padrão: 100).
 *
 * Web: uma chamada ao proxy /api/lotofacil/historico (cacheado 1 h no
 * servidor). APK: baixa o lote direto da loteriascaixa-api. Se o lote falhar
 * nos dois casos, cai para a busca concurso a concurso (lenta, mas
 * funciona). Se `ultimo` (da api.guidi) for mais novo que o lote — janela
 * de minutos após o sorteio —, ele é colocado na frente para o "repetidas do
 * último concurso" usar o resultado certo.
 */
export async function getHistorico(
  windowSize: number,
  ultimo?: Draw
): Promise<Draw[]> {
  const last = ultimo ?? (await getConcurso("ultimo"));
  let draws: Draw[];

  try {
    draws = isNative()
      ? (await fetchJson<BulkDraw[]>(UPSTREAM_BULK_URL, { timeoutMs: 30000, retries: 1 }))
          .filter(isValidBulkDraw)
          .map(bulkToDraw)
      : await fetchJson<Draw[]>("/api/lotofacil/historico", { timeoutMs: 30000, retries: 1 });
  } catch {
    return (await getUltimosConcursos(windowSize)).draws;
  }

  draws.sort((a, b) => b.numero - a.numero);
  if (draws.length === 0 || draws[0].numero < last.numero) {
    draws = [last, ...draws.filter((d) => d.numero < last.numero)];
  }
  return draws.slice(0, windowSize);
}

/** Promise.all com no máximo `limit` chamadas em voo, preservando a ordem */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
