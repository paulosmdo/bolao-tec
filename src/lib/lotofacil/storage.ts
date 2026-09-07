import { DEFAULT_CONFIG } from "./constants";
import type { AppConfig, Combo } from "./types";

const COMBOS_KEY = "lf.combos";
const CONFIG_KEY = "lf.config";
const LEGACY_PREFIX = "lotofacil_";

const isBrowser = () => typeof window !== "undefined";

export function loadConfig(): AppConfig {
  if (!isBrowser()) return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      strategies: { ...DEFAULT_CONFIG.strategies, ...parsed.strategies },
      filters: { ...DEFAULT_CONFIG.filters, ...parsed.filters },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: AppConfig): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function loadCombos(): Combo[] {
  if (!isBrowser()) return [];
  migrateLegacyEntries();
  try {
    const raw = window.localStorage.getItem(COMBOS_KEY);
    const combos = raw ? (JSON.parse(raw) as Combo[]) : [];
    return combos.sort(
      (a, b) => b.targetContest - a.targetContest || b.createdAt.localeCompare(a.createdAt)
    );
  } catch {
    return [];
  }
}

export function saveCombos(combos: Combo[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(COMBOS_KEY, JSON.stringify(combos));
}

export function addCombo(combo: Combo): Combo[] {
  const combos = [combo, ...loadCombos()];
  saveCombos(combos);
  return combos;
}

export function updateCombo(id: string, patch: Partial<Combo>): Combo[] {
  const combos = loadCombos().map((c) => (c.id === id ? { ...c, ...patch } : c));
  saveCombos(combos);
  return combos;
}

export function deleteCombo(id: string): Combo[] {
  const combos = loadCombos().filter((c) => c.id !== id);
  saveCombos(combos);
  return combos;
}

/**
 * Converte as entradas do formato antigo (`lotofacil_<concurso>` com
 * { draws, games: Record<string, number[]> }) para o formato novo de Combo
 * e remove as chaves antigas.
 */
function migrateLegacyEntries(): void {
  const legacyKeys = Object.keys(window.localStorage).filter((k) =>
    k.startsWith(LEGACY_PREFIX)
  );
  if (legacyKeys.length === 0) return;

  let combos: Combo[] = [];
  try {
    const raw = window.localStorage.getItem(COMBOS_KEY);
    combos = raw ? (JSON.parse(raw) as Combo[]) : [];
  } catch {
    combos = [];
  }

  legacyKeys.forEach((key) => {
    try {
      const contest = parseInt(key.slice(LEGACY_PREFIX.length), 10);
      if (Number.isNaN(contest)) return;
      const data = JSON.parse(window.localStorage.getItem(key) ?? "{}") as {
        games?: Record<string, number[]>;
      };
      const games = Object.values(data.games ?? {});
      if (games.length > 0 && !combos.some((c) => c.id === `legacy-${contest}`)) {
        combos.push({
          id: `legacy-${contest}`,
          createdAt: new Date().toISOString(),
          targetContest: contest,
          games: games.map((numbers) => ({
            numbers,
            strategy: "legacy",
            relaxedFilters: [],
          })),
        });
      }
      window.localStorage.removeItem(key);
    } catch {
      // entrada corrompida: ignora e segue
    }
  });

  window.localStorage.setItem(COMBOS_KEY, JSON.stringify(combos));
}
