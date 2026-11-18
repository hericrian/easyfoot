import type { Game, Match } from "../types";
import { gameScore } from "./ranking";
import { formatDate } from "./util";

export const SITE_URL = "https://easyfoot.pages.dev";

function header(m: Match): string {
  const when = formatDate(m.date, m.time);
  return `⚽ *${m.title || "Pelada"}*${when ? `\n📅 ${when}` : ""}${m.location ? `\n📍 ${m.location}` : ""}`;
}

export function teamsText(m: Match): string {
  const byId = new Map(m.entries.map((e) => [e.id, e]));
  const blocks = m.teams.map((t) => {
    const lines = t.playerIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => Number(b!.gk) - Number(a!.gk))
      .map((e) => `${e!.gk ? "🧤" : "▪️"} ${e!.name}`);
    return `*${t.name}*\n${lines.join("\n") || "—"}`;
  });
  const reserves = m.entries.filter((e) => e.reserve).map((e) => e.name);
  const res = reserves.length ? `\n\n*Reservas*\n${reserves.join(", ")}` : "";
  return `${header(m)}\n\n${blocks.join("\n\n")}${res}\n\nTimes sorteados no EasyFoot\n${SITE_URL}`;
}

export function gameText(m: Match, g: Game): string {
  const [a, b] = gameScore(g);
  const scorers = [...g.a.players, ...g.b.players]
    .filter((p) => p.goals > 0)
    .sort((x, y) => y.goals - x.goals)
    .map((p) => `⚽ ${p.name}${p.goals > 1 ? ` (${p.goals})` : ""}`);
  return `${header(m)}\n\n*${g.a.name} ${a} x ${b} ${g.b.name}*${scorers.length ? `\n\n${scorers.join("\n")}` : ""}\n\n${SITE_URL}`;
}

export async function shareText(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return "shared";
    }
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") return "shared";
  }
  return copyText(text);
}

export async function copyText(text: string): Promise<"copied" | "failed"> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok ? "copied" : "failed";
    } catch {
      return "failed";
    }
  }
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
