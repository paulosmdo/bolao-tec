import { NextResponse } from "next/server";

const UPSTREAM = "https://api.guidi.dev.br/loteria/lotofacil";

/**
 * Proxy server-side para a API de resultados. CORS é uma restrição imposta
 * pelo navegador a chamadas cross-origin: como este fetch roda no servidor
 * Next (mesma origem para o browser), o problema desaparece em dev e em
 * produção. De quebra, concursos passados (imutáveis) ficam cacheados por
 * 24h e o "ultimo" por 2 minutos.
 */
export async function GET(
  _req: Request,
  { params }: { params: { concurso: string } }
) {
  const { concurso } = params;

  if (concurso !== "ultimo" && !/^\d{1,6}$/.test(concurso)) {
    return NextResponse.json({ error: "Concurso inválido" }, { status: 400 });
  }

  try {
    const res = await fetch(`${UPSTREAM}/${concurso}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: concurso === "ultimo" ? 120 : 60 * 60 * 24 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `API de resultados respondeu ${res.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "Falha ao consultar a API de resultados" },
      { status: 502 }
    );
  }
}
