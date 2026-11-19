import { describe, expect, it } from "vitest";
import { groupOf, groupOrder } from "../src/lib/cloud";

describe("ranking compartilhado", () => {
  it("separa por horário fixo e local, ignorando acento e maiúsculas", () => {
    const base = { date: "2026-11-17", time: "20:00", endTime: "21:00" };
    const a = groupOf({ ...base, location: "Arena São José" })!;
    const b = groupOf({ ...base, date: "2026-11-24", location: "arena sao jose" })!;
    const c = groupOf({ ...base, location: "Quadra Central" })!;
    expect(a.key).toBe(b.key); // mesma terça, semanas diferentes, mesmo local
    expect(a.key).not.toBe(c.key); // mesmo horário, outro local
    expect(a.label).toBe("Terça · 20h às 21h · Arena São José");
    expect(groupOf({ ...base, location: "" })!.label).toBe("Terça · 20h às 21h");
  });

  it("ordena de segunda a domingo e pelo horário", () => {
    const keys = ["0-09:00-10:00|", "5-20:00-21:00|", "2-21:00-22:00|", "2-20:00-21:00|"];
    expect([...keys].sort((x, y) => groupOrder(x) - groupOrder(y))).toEqual(["2-20:00-21:00|", "2-21:00-22:00|", "5-20:00-21:00|", "0-09:00-10:00|"]);
  });
});
