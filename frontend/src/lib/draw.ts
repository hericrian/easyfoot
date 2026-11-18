import type { Entry, Team } from "../types";
import { shuffle, uid } from "./util";

export const TEAM_COLORS: { name: string; hex: string }[] = [
  { name: "Preto", hex: "#111111" },
  { name: "Branco", hex: "#f5f5f5" },
  { name: "Verde", hex: "#16a34a" },
  { name: "Azul", hex: "#2563eb" },
  { name: "Vermelho", hex: "#dc2626" },
  { name: "Amarelo", hex: "#eab308" },
  { name: "Laranja", hex: "#ea580c" },
  { name: "Roxo", hex: "#7c3aed" },
];

export function emptyTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, i) => {
    const c = TEAM_COLORS[i % TEAM_COLORS.length];
    return { id: uid(), name: `Time ${c.name}`, color: c.hex, playerIds: [] };
  });
}

export function suggestedTeamCount(entries: Entry[], perTeam = 5): number {
  const line = entries.filter((e) => !e.reserve && !e.gk).length;
  return Math.max(2, Math.min(8, Math.round(line / perTeam) || 2));
}

/**
 * Sorteio equilibrado:
 * - um goleiro por time (goleiros excedentes jogam na linha);
 * - linha distribuída para o time com menos jogadores;
 * - com `scores` (aproveitamento 0..1), usa distribuição gananciosa para igualar a força.
 */
export function drawTeams(
  entries: Entry[],
  teamCount: number,
  scores?: Record<string, number>,
  rnd: () => number = Math.random,
): Team[] {
  const teams = emptyTeams(teamCount);
  const active = entries.filter((e) => !e.reserve);
  const gks = shuffle(active.filter((e) => e.gk), rnd);
  const line = active.filter((e) => !e.gk);

  const lineCount = new Array(teamCount).fill(0);
  const strength = new Array(teamCount).fill(0);

  gks.slice(0, teamCount).forEach((g, i) => teams[i].playerIds.push(g.id));
  const pool = [...line, ...gks.slice(teamCount)];

  const ordered = scores
    ? pool
        .map((e) => ({ e, s: (scores[e.id] ?? 0.5) + (rnd() - 0.5) * 0.12 }))
        .sort((a, b) => b.s - a.s)
        .map((x) => x.e)
    : shuffle(pool, rnd);

  for (const e of ordered) {
    const order = shuffle(
      Array.from({ length: teamCount }, (_, i) => i),
      rnd,
    );
    let best = order[0];
    for (const i of order) {
      if (lineCount[i] < lineCount[best] || (lineCount[i] === lineCount[best] && strength[i] < strength[best])) best = i;
    }
    teams[best].playerIds.push(e.id);
    lineCount[best]++;
    strength[best] += scores ? (scores[e.id] ?? 0.5) : 0;
  }
  return teams;
}

/** Sequência de escolha do draft (índices dos times). */
export function draftOrder(teamCount: number, picks: number, first: number, snake: boolean): number[] {
  const base = Array.from({ length: teamCount }, (_, i) => (first + i) % teamCount);
  const seq: number[] = [];
  for (let round = 0; seq.length < picks; round++) {
    const r = snake && round % 2 === 1 ? [...base].reverse() : base;
    for (const t of r) {
      if (seq.length >= picks) break;
      seq.push(t);
    }
  }
  return seq;
}
