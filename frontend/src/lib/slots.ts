import type { Match } from "../types";

/** Horário fixo da pelada: dia da semana + início + fim (ex.: "Terça · 20h às 21h"). */
export type Slot = { key: string; label: string; short: string; order: number };

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "20:00" → "20h", "20:30" → "20h30". */
export function hourLabel(t: string): string {
  const [h, m] = t.split(":");
  if (!h) return "";
  return m && m !== "00" ? `${Number(h)}h${m}` : `${Number(h)}h`;
}

export function weekday(date: string): number | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay();
}

/** Soma minutos a "HH:mm" (para sugerir o fim da partida). */
export function addMinutes(t: string, mins: number): string {
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function slotOf(m: Pick<Match, "date" | "time" | "endTime">): Slot | null {
  const wd = weekday(m.date);
  if (wd === null || !m.time) return null;
  const range = m.endTime ? `${hourLabel(m.time)} às ${hourLabel(m.endTime)}` : hourLabel(m.time);
  const [h, mm] = m.time.split(":").map(Number);
  return {
    key: `${wd}-${m.time}-${m.endTime || ""}`,
    label: `${DAYS[wd]} · ${range}`,
    short: `${DAYS_SHORT[wd]} ${range}`,
    // segunda primeiro, domingo por último; depois pelo horário
    order: ((wd + 6) % 7) * 1440 + h * 60 + (mm || 0),
  };
}

export type SlotGroup = Slot & { matches: Match[] };

export function groupBySlot(matches: Match[]): SlotGroup[] {
  const map = new Map<string, SlotGroup>();
  for (const m of matches) {
    const s = slotOf(m);
    if (!s) continue;
    const g = map.get(s.key) ?? { ...s, matches: [] };
    g.matches.push(m);
    map.set(s.key, g);
  }
  return [...map.values()].sort((a, b) => a.order - b.order);
}
