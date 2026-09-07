import type { Draw } from "./types";

/** Registro da loteriascaixa-api (histórico em lote) — subconjunto usado aqui */
export interface BulkDraw {
  concurso: number;
  data: string;
  dezenas: string[];
  proximoConcurso?: number;
  dataProximoConcurso?: string;
  acumulou?: boolean;
  valorAcumuladoConcurso_0_5?: number;
  valorEstimadoProximoConcurso?: number;
}

export const isValidBulkDraw = (b: BulkDraw) =>
  Array.isArray(b.dezenas) && b.dezenas.length === 15;

/** Converte para o formato `Draw` (api.guidi) que o restante do app consome */
export function bulkToDraw(b: BulkDraw): Draw {
  return {
    numero: b.concurso,
    listaDezenas: b.dezenas,
    dataApuracao: b.data,
    dataProximoConcurso: b.dataProximoConcurso,
    numeroConcursoAnterior: b.concurso - 1,
    numeroConcursoProximo: b.proximoConcurso ?? b.concurso + 1,
    acumulado: b.acumulou,
    valorAcumuladoConcurso_0_5: b.valorAcumuladoConcurso_0_5,
    valorEstimadoProximoConcurso: b.valorEstimadoProximoConcurso,
  };
}
