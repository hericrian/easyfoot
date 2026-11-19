/** POST /api/push/subscribe — registra o aparelho da pessoa logada para receber notificações. */
import { json, originAllowed, type Ctx } from "../../../server/env";
import { userFromRequest } from "../../../server/firebaseToken";

const PUSH_HOSTS = /(^|\.)(googleapis\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com|mozaws\.net)$/;

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!originAllowed(request)) return json({ error: "Origem não permitida." }, 403);
  const user = await userFromRequest(request);
  if (!user) return json({ error: "Entre com sua conta Google." }, 401);

  let sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    sub = await request.json();
  } catch {
    return json({ error: "Formato inválido." }, 400);
  }
  const endpoint = String(sub.endpoint || "");
  let host = "";
  try {
    host = new URL(endpoint).hostname;
  } catch {
    /* inválido */
  }
  // Só aceita serviços de push reais (evita usar o servidor para requisições arbitrárias)
  if (!endpoint.startsWith("https://") || !PUSH_HOSTS.test(host) || !sub.keys?.p256dh || !sub.keys?.auth) {
    return json({ error: "Inscrição inválida." }, 400);
  }

  await env.DB.prepare(
    "INSERT INTO push_subscriptions (endpoint, uid, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(endpoint) DO UPDATE SET uid = excluded.uid, p256dh = excluded.p256dh, auth = excluded.auth",
  )
    .bind(endpoint, user.uid, sub.keys.p256dh, sub.keys.auth, Date.now())
    .run();
  return json({ ok: true }, 201);
}
