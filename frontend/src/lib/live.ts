import type { Game, GameSide, GoalEvent, LiveGame } from "../types";

export function elapsedMs(live: LiveGame, now = Date.now()): number {
  return live.elapsedMs + (live.runningSince !== null ? Math.max(0, now - live.runningSince) : 0);
}

export function isRunning(live: LiveGame): boolean {
  return live.runningSince !== null;
}

export function start(live: LiveGame, now = Date.now()): LiveGame {
  return live.runningSince !== null ? live : { ...live, runningSince: now };
}

export function pause(live: LiveGame, now = Date.now()): LiveGame {
  if (live.runningSince === null) return live;
  return { ...live, elapsedMs: elapsedMs(live, now), runningSince: null };
}

export function liveScore(live: Pick<LiveGame, "events">): [number, number] {
  let a = 0;
  let b = 0;
  for (const e of live.events) e.side === "a" ? a++ : b++;
  return [a, b];
}

/** Tempo restante em ms (negativo = acréscimo). null quando o jogo não tem duração. */
export function remainingMs(live: LiveGame, now = Date.now()): number | null {
  if (!live.durationSec) return null;
  return live.durationSec * 1000 - elapsedMs(live, now);
}

export function goalLimitReached(live: LiveGame): boolean {
  if (!live.goalLimit) return false;
  const [a, b] = liveScore(live);
  return a >= live.goalLimit || b >= live.goalLimit;
}

/** "07:45"; com `signed`, acréscimo aparece como "+01:12". */
export function clock(ms: number, signed = false): string {
  const neg = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const txt = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return signed && neg ? `+${txt}` : txt;
}

export function minuteOf(ms: number): string {
  return `${Math.floor(ms / 60000) + 1}'`;
}

function applyEvents(side: GameSide, key: "a" | "b", events: GoalEvent[]): GameSide {
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  let extra = 0;
  for (const e of events) {
    if (e.side === key) {
      if (e.scorerId) goals.set(e.scorerId, (goals.get(e.scorerId) ?? 0) + 1);
      else extra++;
      if (e.assistId) assists.set(e.assistId, (assists.get(e.assistId) ?? 0) + 1);
    }
  }
  return {
    ...side,
    extra,
    players: side.players.map((p) => ({ ...p, goals: goals.get(p.id) ?? 0, assists: assists.get(p.id) ?? 0 })),
  };
}

/** Converte o jogo ao vivo em um jogo registrado (gols e assistências por jogador). */
export function toGame(live: LiveGame, now = Date.now()): Game {
  return {
    id: live.id,
    createdAt: live.createdAt,
    a: applyEvents(live.a, "a", live.events),
    b: applyEvents(live.b, "b", live.events),
    durationMs: elapsedMs(live, now),
    events: live.events,
  };
}
