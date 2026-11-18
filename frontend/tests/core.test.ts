import { describe, expect, it } from "vitest";
import { parseList } from "../src/lib/parser";
import { draftOrder, drawTeams } from "../src/lib/draw";
import { computeRanking } from "../src/lib/ranking";
import type { Entry, Match } from "../src/types";

describe("parseList", () => {
  it("lê lista numerada típica do WhatsApp", () => {
    const text = `⚽ PELADA QUINTA 20H ⚽
📍 Arena Society - quadra 2
💰 R$ 20,00 pix
1. Carlos 🧤
2- João
3) Pedro Henrique ✅
4 - marcos
5.
6. Zé (pago)
GOLEIROS:
1. Rafa
Reservas:
1. Lucas
2. Tiago`;
    const out = parseList(text);
    expect(out.map((e) => e.name)).toEqual(["Carlos", "João", "Pedro Henrique", "Marcos", "Zé", "Rafa", "Lucas", "Tiago"]);
    expect(out.filter((e) => e.gk).map((e) => e.name)).toEqual(["Carlos", "Rafa"]);
    expect(out.filter((e) => e.reserve).map((e) => e.name)).toEqual(["Lucas", "Tiago"]);
  });

  it("identifica goleiro por palavra-chave e remove o marcador do nome", () => {
    const out = parseList("1. Bruno (G)\n2. Léo goleiro\n3. Gabriel - gol\n4. Golias\n5. Diego 🥅");
    expect(out).toEqual([
      { name: "Bruno", gk: true, reserve: false },
      { name: "Léo", gk: true, reserve: false },
      { name: "Gabriel", gk: true, reserve: false },
      { name: "Golias", gk: false, reserve: false },
      { name: "Diego", gk: true, reserve: false },
    ]);
  });

  it("aceita goleiros inline e remove duplicados sem acento", () => {
    const out = parseList("Goleiros: Rafa, Beto\n1. João\n2. joao\n3. JOÃO");
    expect(out.map((e) => [e.name, e.gk])).toEqual([
      ["Rafa", true],
      ["Beto", true],
      ["João", false],
    ]);
  });

  it("ignora data, hora, links e frases longas", () => {
    const out = parseList("Jogo dia 20/11 às 20:00\nhttps://maps.app/x\nQuem não pagar não joga, combinado?\nAna\nBia");
    expect(out.map((e) => e.name)).toEqual(["Ana", "Bia"]);
  });

  it("remove prefixo de exportação do WhatsApp", () => {
    const out = parseList("[18/11 20:31] Fulano: 1. Caio\n[18/11 20:32] Ciclano: 2. Davi 🧤");
    expect(out.map((e) => [e.name, e.gk])).toEqual([
      ["Caio", false],
      ["Davi", true],
    ]);
  });
});

const mk = (n: number, gks = 0): Entry[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, gk: i < gks, reserve: false }));

describe("drawTeams", () => {
  it("distribui todos com diferença máxima de 1 e um goleiro por time", () => {
    for (let run = 0; run < 50; run++) {
      const entries = [...mk(17, 3), { id: "r", name: "Reserva", gk: false, reserve: true }];
      const teams = drawTeams(entries, 3);
      const ids = teams.flatMap((t) => t.playerIds);
      expect(new Set(ids).size).toBe(17);
      expect(ids).not.toContain("r");
      const sizes = teams.map((t) => t.playerIds.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      for (const t of teams) expect(t.playerIds.filter((id) => ["p0", "p1", "p2"].includes(id)).length).toBe(1);
    }
  });

  it("equilibra pela força quando há scores", () => {
    const entries = mk(10);
    const scores = Object.fromEntries(entries.map((e, i) => [e.id, i < 5 ? 0.9 : 0.1]));
    const teams = drawTeams(entries, 2, scores);
    const strong = teams.map((t) => t.playerIds.filter((id) => scores[id] > 0.5).length);
    expect(Math.abs(strong[0] - strong[1])).toBeLessThanOrEqual(1);
  });
});

describe("draftOrder", () => {
  it("serpentina e alternada", () => {
    expect(draftOrder(2, 6, 1, true)).toEqual([1, 0, 0, 1, 1, 0]);
    expect(draftOrder(2, 5, 0, false)).toEqual([0, 1, 0, 1, 0]);
    expect(draftOrder(3, 6, 0, true)).toEqual([0, 1, 2, 2, 1, 0]);
  });
});

describe("computeRanking", () => {
  it("calcula jogos, vitórias, gols e aproveitamento", () => {
    const side = (teamId: string, players: [string, number][], extra = 0) => ({
      teamId,
      name: teamId,
      color: "#000",
      players: players.map(([name, goals]) => ({ id: name, name, goals })),
      extra,
    });
    const m: Match = {
      id: "m",
      title: "t",
      location: "",
      date: "",
      time: "",
      createdAt: 0,
      entries: [],
      teams: [],
      games: [
        { id: "g1", createdAt: 0, a: side("A", [["Ana", 2], ["Bia", 0]]), b: side("B", [["Caio", 1]]) },
        { id: "g2", createdAt: 0, a: side("A", [["Ana", 0], ["Bia", 0]]), b: side("B", [["Caio", 0]], 0) },
      ],
    };
    const r = computeRanking([m]);
    const ana = r.find((x) => x.name === "Ana")!;
    expect(ana).toMatchObject({ games: 2, wins: 1, draws: 1, losses: 0, goals: 2 });
    expect(ana.pct).toBeCloseTo(4 / 6);
    expect(r[0].name).toBe("Ana");
    expect(r.find((x) => x.name === "Caio")).toMatchObject({ wins: 0, draws: 1, losses: 1 });
  });
});
