export type Review = { id: number; name: string; rating: number; comment: string; createdAt: number };
export type ReviewPage = {
  summary: { count: number; avg: number; counts: number[] };
  reviews: Review[];
  next: number | null;
};

export async function fetchReviews(before?: number): Promise<ReviewPage> {
  const res = await fetch(`/api/reviews${before ? `?before=${before}` : ""}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postReview(input: { name: string; rating: number; comment: string; website: string }): Promise<void> {
  const res = await fetch("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let msg = "Não foi possível enviar agora. Tente de novo.";
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* resposta sem JSON */
    }
    throw new Error(msg);
  }
}

const rtf = typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl ? new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }) : null;

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.round((ts - now) / 1000);
  const abs = Math.abs(s);
  const fmt = (v: number, u: Intl.RelativeTimeFormatUnit) => (rtf ? rtf.format(v, u) : `${Math.abs(v)} ${u}`);
  if (abs < 60) return "agora";
  if (abs < 3600) return fmt(Math.round(s / 60), "minute");
  if (abs < 86400) return fmt(Math.round(s / 3600), "hour");
  if (abs < 86400 * 30) return fmt(Math.round(s / 86400), "day");
  if (abs < 86400 * 365) return fmt(Math.round(s / (86400 * 30)), "month");
  return fmt(Math.round(s / (86400 * 365)), "year");
}
