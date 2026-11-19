import { describe, expect, it } from "vitest";
import { addMinutes, groupBySlot, hourLabel, slotOf } from "../src/lib/slots";
import type { Match } from "../src/types";

const m = (id: string, date: string, time: string, endTime?: string): Match => ({
  id,
  title: id,
  location: "",
  date,
  time,
  endTime,
  createdAt: 0,
  entries: [],
  teams: [],
  games: [],
});

describe("ranking por horário", () => {
  it("rotula dia da semana e faixa de horário", () => {
    // 2026-11-17 é terça; 2026-11-20 é sexta
    expect(slotOf(m("a", "2026-11-17", "20:00", "21:00"))?.label).toBe("Terça · 20h às 21h");
    expect(slotOf(m("b", "2026-11-20", "20:30", "21:30"))?.short).toBe("Sex 20h30 às 21h30");
    expect(hourLabel("07:05")).toBe("7h05");
    expect(addMinutes("23:30", 60)).toBe("00:30");
  });

  it("separa terça e sexta e junta semanas diferentes do mesmo horário", () => {
    const groups = groupBySlot([
      m("t1", "2026-11-17", "20:00", "21:00"),
      m("s1", "2026-11-20", "20:00", "21:00"),
      m("t2", "2026-11-24", "20:00", "21:00"),
      m("t3", "2026-11-24", "21:00", "22:00"),
    ]);
    expect(groups.map((g) => [g.label, g.matches.map((x) => x.id)])).toEqual([
      ["Terça · 20h às 21h", ["t1", "t2"]],
      ["Terça · 21h às 22h", ["t3"]],
      ["Sexta · 20h às 21h", ["s1"]],
    ]);
  });
});
