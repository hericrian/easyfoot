import type { GameSide, Match, Team } from "../types";
import { gameScore } from "./ranking";

export function sideFrom(team: Team, match: Match, prev?: GameSide): GameSide {
  const byId = new Map(match.entries.map((e) => [e.id, e]));
  const same = prev?.teamId === team.id;
  const goals = new Map(same ? prev!.players.map((p) => [p.id, p.goals]) : []);
  return {
    teamId: team.id,
    name: team.name,
    color: team.color,
    players: team.playerIds
      .map((id) => byId.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ id: e.id, name: e.name, goals: goals.get(e.id) ?? 0 })),
    extra: same ? prev!.extra : 0,
  };
}

/** "Ganhou fica": vencedor do último jogo enfrenta o próximo time da fila. */
export function nextPairing(match: Match): [Team, Team] {
  const t = match.teams;
  const last = match.games[match.games.length - 1];
  if (!last || t.length < 3) return [t[0], t[1]];
  const [sa, sb] = gameScore(last);
  const stayId = sa >= sb ? last.a.teamId : last.b.teamId;
  const stay = t.find((x) => x.id === stayId) ?? t[0];
  const played = new Set([last.a.teamId, last.b.teamId]);
  const startIdx = Math.max(...[last.a.teamId, last.b.teamId].map((id) => t.findIndex((x) => x.id === id)));
  for (let k = 1; k <= t.length; k++) {
    const cand = t[(startIdx + k) % t.length];
    if (!played.has(cand.id)) return [stay, cand];
  }
  return [stay, t.find((x) => x.id !== stay.id) ?? t[1]];
}

export type StandingRow = { teamId: string; name: string; color: string; j: number; v: number; e: number; d: number; gp: number; gc: number };

export function standings(match: Match): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of match.teams) rows.set(t.id, { teamId: t.id, name: t.name, color: t.color, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 });
  for (const g of match.games) {
    const [a, b] = gameScore(g);
    for (const [side, mine, other] of [
      [g.a, a, b],
      [g.b, b, a],
    ] as const) {
      const r = rows.get(side.teamId) ?? { teamId: side.teamId, name: side.name, color: side.color, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
      r.j++;
      r.gp += mine;
      r.gc += other;
      if (mine > other) r.v++;
      else if (mine === other) r.e++;
      else r.d++;
      rows.set(side.teamId, r);
    }
  }
  return [...rows.values()]
    .filter((r) => r.j > 0)
    .sort((x, y) => y.v * 3 + y.e - (x.v * 3 + x.e) || y.gp - y.gc - (x.gp - x.gc) || y.gp - x.gp);
}

/** Texto legível sobre a cor do time (colete branco/amarelo pede texto escuro). */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0a0a0a" : "#ffffff";
}

/** Cor de superfície do time sobre o placar preto: colete preto/escuro vira grafite visível. */
export function teamSurface(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum < 50 ? "#3a3a3c" : hex;
}
