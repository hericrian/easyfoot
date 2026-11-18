import type { Game, GameSide, Match } from "../types";
import { nameKey } from "./util";

export type RankRow = {
  key: string;
  name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  /** Aproveitamento: pontos (V=3, E=1) / pontos possíveis. 0..1 */
  pct: number;
};

export function sideScore(s: GameSide): number {
  return s.players.reduce((n, p) => n + (p.goals || 0), 0) + (s.extra || 0);
}

export function gameScore(g: Game): [number, number] {
  return [sideScore(g.a), sideScore(g.b)];
}

export function computeRanking(matches: Match[]): RankRow[] {
  const rows = new Map<string, RankRow>();
  const row = (name: string) => {
    const key = nameKey(name);
    let r = rows.get(key);
    if (!r) {
      r = { key, name, games: 0, wins: 0, draws: 0, losses: 0, goals: 0, pct: 0 };
      rows.set(key, r);
    }
    return r;
  };

  for (const m of matches) {
    for (const g of m.games) {
      const [sa, sb] = gameScore(g);
      const apply = (side: GameSide, mine: number, other: number) => {
        for (const p of side.players) {
          if (!nameKey(p.name)) continue;
          const r = row(p.name);
          r.games++;
          r.goals += p.goals || 0;
          if (mine > other) r.wins++;
          else if (mine === other) r.draws++;
          else r.losses++;
        }
      };
      apply(g.a, sa, sb);
      apply(g.b, sb, sa);
    }
  }

  const list = [...rows.values()];
  for (const r of list) r.pct = r.games ? (r.wins * 3 + r.draws) / (r.games * 3) : 0;
  return list.sort(
    (a, b) => b.pct - a.pct || b.wins - a.wins || b.goals - a.goals || b.games - a.games || a.name.localeCompare(b.name),
  );
}

/** Força estimada (0..1) para equilibrar o sorteio, suavizada para quem tem poucos jogos. */
export function strengthByKey(matches: Match[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of computeRanking(matches)) {
    out.set(r.key, (r.wins * 3 + r.draws + 1.5) / (r.games * 3 + 3));
  }
  return out;
}
