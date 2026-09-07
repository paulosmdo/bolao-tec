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

const baseUrl = () =>
  typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.()
    ? UPSTREAM_URL
    : "/api/lotofacil";

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
 * Busca o último concurso e os `windowSize - 1` anteriores EM PARALELO
 * (numeração é sequencial), em vez do fetch em cadeia da versão antiga.
 */
export async function getUltimosConcursos(
  windowSize: number
): Promise<{ ultimo: Draw; draws: Draw[] }> {
  const ultimo = await getConcurso("ultimo");
  const previousIds = Array.from(
    { length: Math.max(windowSize - 1, 0) },
    (_, i) => ultimo.numero - (i + 1)
  ).filter((n) => n > 0);

  const previous = await Promise.all(previousIds.map((id) => getConcurso(id)));
  return { ultimo, draws: [ultimo, ...previous] };
}
