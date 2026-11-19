/**
 * POST /api/push/schedule — { group, items: [{ at, title, body, url?, tag? }] }
 * Substitui todos os avisos do grupo da pessoa logada (lista vazia = cancelar).
 * Quem dispara na hora certa é o Worker agendado "easyfoot-push" (cron a cada minuto).
 */
import { json, originAllowed, type Ctx } from "../../../server/env";
import { userFromRequest } from "../../../server/firebaseToken";

const MAX_ITEMS = 30;
const MAX_AHEAD = 7 * 24 * 60 * 60 * 1000;

const clean = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, max);

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!originAllowed(request)) return json({ error: "Origem não permitida." }, 403);
  const user = await userFromRequest(request);
  if (!user) return json({ error: "Entre com sua conta Google." }, 401);

  let body: { group?: unknown; items?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Formato inválido." }, 400);
  }
  const group = clean(body.group, 80);
  if (!/^[a-z]+:[A-Za-z0-9_-]+$/.test(group)) return json({ error: "Grupo inválido." }, 400);
  const now = Date.now();
  const items = (Array.isArray(body.items) ? body.items : [])
    .slice(0, MAX_ITEMS)
    .map((i: Record<string, unknown>) => ({
      at: Number(i.at),
      title: clean(i.title, 80),
      body: clean(i.body, 200),
      url: /^\/[^\s]*$/.test(String(i.url || "/")) ? String(i.url || "/").slice(0, 200) : "/",
      tag: clean(i.tag, 60),
    }))
    .filter((i) => Number.isFinite(i.at) && i.at > now - 60_000 && i.at < now + MAX_AHEAD && i.title);

  const stmts = [env.DB.prepare("DELETE FROM push_schedule WHERE uid = ? AND grp = ?").bind(user.uid, group)];
  for (const i of items) {
    stmts.push(
      env.DB.prepare("INSERT INTO push_schedule (uid, grp, send_at, title, body, url, tag) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
        user.uid,
        group,
        i.at,
        i.title,
        i.body,
        i.url,
        i.tag,
      ),
    );
  }
  await env.DB.batch(stmts);
  return json({ ok: true, scheduled: items.length });
}
