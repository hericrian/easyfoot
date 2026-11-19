/**
 * API de avaliações públicas — Cloudflare Pages Function + D1.
 *
 *   GET  /api/reviews?before=<id>   → resumo (média, total, distribuição) + página de avaliações
 *   POST /api/reviews               → { name?, rating 1..5, comment?, website (isca) }
 *
 * Antispam: origem obrigatória do próprio site, campo-isca para robôs, sem links no
 * comentário e no máximo 2 avaliações por IP a cada 24 h (o IP é guardado só como hash).
 * Moderação: no painel D1, `UPDATE reviews SET hidden = 1 WHERE id = ?`.
 */

interface D1Result<T> {
  results: T[];
}
interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface Env {
  DB: { prepare(sql: string): D1Prepared };
  /** Opcional: sal secreto para o hash de IP (wrangler pages secret put REVIEWS_SALT). */
  REVIEWS_SALT?: string;
}
interface Ctx {
  request: Request;
  env: Env;
}

const PAGE = 20;
const MAX_PER_DAY = 2;
const DAY = 24 * 60 * 60 * 1000;
const ALLOWED_HOSTS = [/^easyfoot\.pages\.dev$/, /^[a-z0-9-]+\.easyfoot\.pages\.dev$/, /^localhost$/, /^127\.0\.0\.1$/];

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...extra },
  });
}

function clean(s: unknown, max: number): string {
  return String(s ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return ALLOWED_HOSTS.some((re) => re.test(new URL(origin).hostname));
  } catch {
    return false;
  }
}

type Row = { id: number; name: string; rating: number; comment: string; created_at: number };

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const before = Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER;

  const [summary, dist, page] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE hidden = 0").first<{ count: number; avg: number }>(),
    env.DB.prepare("SELECT rating, COUNT(*) AS n FROM reviews WHERE hidden = 0 GROUP BY rating").all<{ rating: number; n: number }>(),
    env.DB.prepare("SELECT id, name, rating, comment, created_at FROM reviews WHERE hidden = 0 AND id < ? ORDER BY id DESC LIMIT ?")
      .bind(before, PAGE + 1)
      .all<Row>(),
  ]);

  const counts = [0, 0, 0, 0, 0];
  for (const r of dist.results) if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1] = r.n;
  const rows = page.results.slice(0, PAGE);

  return json(
    {
      summary: { count: summary?.count ?? 0, avg: Math.round((summary?.avg ?? 0) * 10) / 10, counts },
      reviews: rows.map((r) => ({ id: r.id, name: r.name, rating: r.rating, comment: r.comment, createdAt: r.created_at })),
      next: page.results.length > PAGE ? rows[rows.length - 1].id : null,
    },
    200,
    { "cache-control": "public, max-age=15" },
  );
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!originAllowed(request)) return json({ error: "Origem não permitida." }, 403);
  if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ error: "Formato inválido." }, 415);
  const raw = await request.text();
  if (raw.length > 4000) return json({ error: "Avaliação muito longa." }, 413);

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Formato inválido." }, 400);
  }

  // Campo-isca invisível: humanos deixam vazio. Robô recebe "sucesso" e nada é salvo.
  if (clean(body.website, 200)) return json({ ok: true }, 201);

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Escolha de 1 a 5 estrelas." }, 400);
  const name = clean(body.name, 40).replace(/\n/g, " ") || "Anônimo";
  const comment = clean(body.comment, 600);
  if (/(https?:\/\/|www\.|\.(com|net|org|xyz|io|ru)\b)/i.test(`${name} ${comment}`)) {
    return json({ error: "Links não são permitidos nas avaliações." }, 400);
  }

  const ip = request.headers.get("cf-connecting-ip") || "local";
  const ipHash = await sha256(`${env.REVIEWS_SALT || "easyfoot-reviews-v1"}:${ip}`);
  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM reviews WHERE ip_hash = ? AND created_at > ?").bind(ipHash, now - DAY).first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_PER_DAY) return json({ error: "Você já avaliou hoje. Obrigado!" }, 429);

  await env.DB.prepare("INSERT INTO reviews (name, rating, comment, created_at, ip_hash) VALUES (?, ?, ?, ?, ?)")
    .bind(name, rating, comment, now, ipHash)
    .run();

  return json({ ok: true }, 201);
}
