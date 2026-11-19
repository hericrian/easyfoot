/**
 * Ranking compartilhado.
 *   GET    /api/games?grp=<chave>   → { groups, games } (sem grp = todos os jogos: ranking geral)
 *   POST   /api/games               → { games: [...] } publica/atualiza jogos (exige login Google)
 *   DELETE /api/games?id=<id>       → remove um jogo publicado pela própria conta
 */
import { json, originAllowed, type Ctx } from "../../server/env";
import { userFromRequest } from "../../server/firebaseToken";

const MAX_GAMES_READ = 5000;
const MAX_PER_POST = 200;

type SideIn = { teamId?: unknown; name?: unknown; color?: unknown; extra?: unknown; players?: unknown };

const str = (v: unknown, max: number) =>
  String(v ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);
const int = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

function cleanSide(s: SideIn) {
  const players = (Array.isArray(s.players) ? s.players : []).slice(0, 40).map((p: Record<string, unknown>) => ({
    id: str(p.id, 60),
    name: str(p.name, 40),
    goals: int(p.goals, 50),
    assists: int(p.assists, 50),
  }));
  return {
    teamId: str(s.teamId, 60),
    name: str(s.name, 30) || "Time",
    color: /^#[0-9a-fA-F]{6}$/.test(String(s.color)) ? String(s.color) : "#888888",
    extra: int(s.extra, 50),
    players: players.filter((p) => p.name),
  };
}

export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  const grp = new URL(request.url).searchParams.get("grp");
  const [groups, games] = await Promise.all([
    env.DB.prepare("SELECT grp AS key, MAX(grp_label) AS label, COUNT(*) AS count FROM games GROUP BY grp ORDER BY grp").all<{ key: string; label: string; count: number }>(),
    (grp
      ? env.DB.prepare("SELECT id, grp, played_at, data FROM games WHERE grp = ? ORDER BY played_at DESC LIMIT ?").bind(grp, MAX_GAMES_READ)
      : env.DB.prepare("SELECT id, grp, played_at, data FROM games ORDER BY played_at DESC LIMIT ?").bind(MAX_GAMES_READ)
    ).all<{ id: string; grp: string; played_at: number; data: string }>(),
  ]);
  return json(
    {
      groups: groups.results,
      games: games.results.map((g) => ({ id: g.id, grp: g.grp, playedAt: g.played_at, ...JSON.parse(g.data) })),
    },
    200,
    { "cache-control": "public, max-age=10" },
  );
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!originAllowed(request)) return json({ error: "Origem não permitida." }, 403);
  const user = await userFromRequest(request);
  if (!user) return json({ error: "Entre com sua conta Google." }, 401);
  const raw = await request.text();
  if (raw.length > 500_000) return json({ error: "Envio muito grande." }, 413);

  let body: { games?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Formato inválido." }, 400);
  }
  const now = Date.now();
  const list = (Array.isArray(body.games) ? body.games : []).slice(0, MAX_PER_POST);
  const stmts = [];
  for (const g of list as Record<string, unknown>[]) {
    const id = str(g.id, 80);
    const grp = str(g.grp, 160);
    const label = str(g.grpLabel, 120);
    const playedAt = Number(g.playedAt);
    if (!id || !grp || !label || !Number.isFinite(playedAt)) continue;
    const data = JSON.stringify({ a: cleanSide(g.a as SideIn), b: cleanSide(g.b as SideIn) });
    // Só quem publicou pode atualizar o próprio jogo
    stmts.push(
      env.DB.prepare(
        "INSERT INTO games (id, uid, grp, grp_label, played_at, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(id) DO UPDATE SET grp = excluded.grp, grp_label = excluded.grp_label, played_at = excluded.played_at, " +
          "data = excluded.data, updated_at = excluded.updated_at WHERE games.uid = excluded.uid",
      ).bind(id, user.uid, grp, label, playedAt, data, now),
    );
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, saved: stmts.length });
}

export async function onRequestDelete({ request, env }: Ctx): Promise<Response> {
  if (!originAllowed(request)) return json({ error: "Origem não permitida." }, 403);
  const user = await userFromRequest(request);
  if (!user) return json({ error: "Entre com sua conta Google." }, 401);
  const id = str(new URL(request.url).searchParams.get("id"), 80);
  if (!id) return json({ error: "Jogo inválido." }, 400);
  await env.DB.prepare("DELETE FROM games WHERE id = ? AND uid = ?").bind(id, user.uid).run();
  return json({ ok: true });
}
