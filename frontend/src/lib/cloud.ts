/**
 * Ranking compartilhado: os jogos de quem está logado vão para o banco (Cloudflare D1)
 * e todo mundo vê o mesmo ranking — geral e por horário + local — em qualquer aparelho.
 */
import type { Game, Match } from "../types";
import { idToken } from "./auth";
import { slotOf } from "./slots";
import { nameKey } from "./util";

export type SharedGroup = { key: string; label: string; count: number };
export type SharedGame = Game & { grp: string; playedAt: number };

/** Ranking de um horário fixo num local: "Terça · 20h às 21h · Arena X". */
export function groupOf(m: Pick<Match, "date" | "time" | "endTime" | "location">): { key: string; label: string } | null {
  const slot = slotOf(m);
  if (!slot) return null;
  const loc = nameKey(m.location || "");
  return { key: `${slot.key}|${loc}`, label: m.location ? `${slot.label} · ${m.location.trim()}` : slot.label };
}

/** Ordem: segunda → domingo, depois horário (mesma regra dos chips locais). */
export function groupOrder(key: string): number {
  const [wd, time] = key.split("-");
  const [h, mi] = (time || "0:0").split(":").map(Number);
  return ((Number(wd) + 6) % 7) * 1440 + (h || 0) * 60 + (mi || 0);
}

const SYNCED = "easyfoot:synced";

function loadSynced(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SYNCED) || "{}");
  } catch {
    return {};
  }
}

function saveSynced(map: Record<string, string>) {
  try {
    localStorage.setItem(SYNCED, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function payload(m: Match, g: Game) {
  const grp = groupOf(m)!;
  const side = (s: Game["a"]) => ({ ...s, players: s.players.map((p) => ({ id: p.id, name: p.name, goals: p.goals || 0, assists: p.assists || 0 })) });
  return { id: g.id, grp: grp.key, grpLabel: grp.label, playedAt: g.createdAt, a: side(g.a), b: side(g.b) };
}

let syncing = false;

/** Envia jogos novos ou alterados. Silencioso sem login/offline; tenta de novo na próxima mudança. */
export async function syncGames(matches: Match[]): Promise<number> {
  if (syncing) return 0;
  const token = await idToken();
  if (!token) return 0;
  syncing = true;
  try {
    const synced = loadSynced();
    const pending: ReturnType<typeof payload>[] = [];
    const hashes: Record<string, string> = {};
    for (const m of matches) {
      if (!groupOf(m)) continue;
      for (const g of m.games) {
        const p = payload(m, g);
        const h = JSON.stringify(p);
        if (synced[g.id] !== h) {
          pending.push(p);
          hashes[g.id] = h;
        }
      }
    }
    for (let i = 0; i < pending.length; i += 100) {
      const chunk = pending.slice(i, i + 100);
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ games: chunk }),
      });
      if (!res.ok) break;
      for (const p of chunk) synced[p.id] = hashes[p.id];
      saveSynced(synced);
    }
    return pending.length;
  } catch {
    return 0;
  } finally {
    syncing = false;
  }
}

export async function deleteSharedGame(id: string): Promise<void> {
  const token = await idToken();
  const synced = loadSynced();
  delete synced[id];
  saveSynced(synced);
  if (!token) return;
  try {
    await fetch(`/api/games?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
  } catch {
    /* offline: fica no ranking até a próxima vez */
  }
}

export async function fetchShared(grp?: string): Promise<{ groups: SharedGroup[]; games: SharedGame[] }> {
  const res = await fetch(`/api/games${grp ? `?grp=${encodeURIComponent(grp)}` : ""}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { groups: SharedGroup[]; games: SharedGame[] };
  data.groups.sort((a, b) => groupOrder(a.key) - groupOrder(b.key));
  return data;
}

export function hasUnsyncedGames(matches: Match[]): boolean {
  const synced = loadSynced();
  return matches.some((m) => groupOf(m) && m.games.some((g) => !synced[g.id]));
}
