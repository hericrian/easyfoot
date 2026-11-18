import type { DB, Match } from "../types";

const KEY = "easyfoot:v1";

export function emptyDB(): DB {
  return { version: 1, matches: [] };
}

function isMatch(m: unknown): m is Match {
  if (!m || typeof m !== "object") return false;
  const x = m as Match;
  return typeof x.id === "string" && Array.isArray(x.entries) && Array.isArray(x.teams) && Array.isArray(x.games);
}

export function validateDB(data: unknown): DB | null {
  if (!data || typeof data !== "object") return null;
  const d = data as DB;
  if (!Array.isArray(d.matches)) return null;
  const matches = d.matches.filter(isMatch);
  return { version: 1, matches };
}

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return validateDB(JSON.parse(raw)) ?? emptyDB();
  } catch {
    /* storage indisponível */
  }
  return emptyDB();
}

export function saveDB(db: DB): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

export function requestPersistence(): void {
  try {
    navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    /* ignore */
  }
}
