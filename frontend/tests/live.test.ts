import { describe, expect, it } from "vitest";
import { clock, elapsedMs, goalLimitReached, liveScore, pause, remainingMs, start, toGame } from "../src/lib/live";
import type { LiveGame } from "../src/types";

const side = (teamId: string, names: string[]) => ({
  teamId,
  name: teamId,
  color: "#000",
  players: names.map((n) => ({ id: n, name: n, goals: 0 })),
  extra: 0,
});

const base = (): LiveGame => ({
  id: "g",
  createdAt: 0,
  a: side("A", ["Ana", "Bia"]),
  b: side("B", ["Caio", "Davi"]),
  durationSec: 600,
  goalLimit: 2,
  elapsedMs: 0,
  runningSince: null,
  events: [],
});

describe("cronômetro ao vivo", () => {
  it("mede pelo relógio, não por ticks, e acumula entre pausas", () => {
    let l = start(base(), 1_000);
    expect(elapsedMs(l, 61_000)).toBe(60_000);
    l = pause(l, 61_000);
    expect(elapsedMs(l, 999_999)).toBe(60_000); // pausado não anda
    l = start(l, 100_000);
    expect(elapsedMs(l, 130_000)).toBe(90_000);
    expect(remainingMs(l, 130_000)).toBe(510_000);
  });

  it("mostra acréscimo depois do tempo", () => {
    const l = start(base(), 0);
    expect(clock(remainingMs(l, 612_000)!, true)).toBe("+00:12");
    expect(clock(remainingMs(l, 15_000)!, true)).toBe("09:45");
  });

  it("jogo sem duração não tem tempo restante", () => {
    expect(remainingMs({ ...base(), durationSec: 0 })).toBeNull();
  });
});

describe("placar ao vivo", () => {
  it("soma gols, respeita limite e gera o jogo com gols e assistências", () => {
    const l: LiveGame = {
      ...base(),
      elapsedMs: 300_000,
      events: [
        { id: "1", side: "a", at: 10_000, scorerId: "Ana", assistId: "Bia" },
        { id: "2", side: "b", at: 20_000 },
        { id: "3", side: "a", at: 30_000, scorerId: "Ana" },
      ],
    };
    expect(liveScore(l)).toEqual([2, 1]);
    expect(goalLimitReached(l)).toBe(true);
    const g = toGame(l);
    expect(g.durationMs).toBe(300_000);
    expect(g.a.players.find((p) => p.id === "Ana")).toMatchObject({ goals: 2, assists: 0 });
    expect(g.a.players.find((p) => p.id === "Bia")).toMatchObject({ goals: 0, assists: 1 });
    expect(g.b.extra).toBe(1);
  });
});
