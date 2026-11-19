/**
 * easyfoot-push — roda a cada minuto (Cron Trigger), pega os avisos vencidos em
 * push_schedule e envia para todos os aparelhos da pessoa. Inscrições expiradas
 * (404/410) são removidas.
 */
import type { Env } from "../server/env";
import { sendPush, type PushSubscriptionJSON } from "../server/webpush";

type Due = { id: number; uid: string; send_at: number; title: string; body: string; url: string; tag: string };
type Sub = { endpoint: string; p256dh: string; auth: string };

async function run(env: Env): Promise<{ sent: number; removed: number }> {
  if (!env.VAPID_PRIVATE_JWK) return { sent: 0, removed: 0 };
  const now = Date.now();
  const due = (
    await env.DB.prepare("SELECT id, uid, send_at, title, body, url, tag FROM push_schedule WHERE send_at <= ? ORDER BY send_at LIMIT 200").bind(now).all<Due>()
  ).results;
  if (!due.length) return { sent: 0, removed: 0 };

  // Remove primeiro para nunca enviar o mesmo aviso duas vezes, mesmo se algo falhar depois
  await env.DB.batch(due.map((d) => env.DB.prepare("DELETE FROM push_schedule WHERE id = ?").bind(d.id)));

  let sent = 0;
  let removed = 0;
  const subsByUid = new Map<string, Sub[]>();
  for (const d of due) {
    if (!subsByUid.has(d.uid)) {
      subsByUid.set(d.uid, (await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE uid = ?").bind(d.uid).all<Sub>()).results);
    }
    // Avisos atrasados mais de 10 min não fazem mais sentido (ex.: troca de um jogo antigo)
    if (now - d.send_at > 10 * 60_000) continue;
    for (const s of subsByUid.get(d.uid)!) {
      const sub: PushSubscriptionJSON = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        const status = await sendPush(sub, { title: d.title, body: d.body, url: d.url, tag: d.tag || undefined }, env.VAPID_PRIVATE_JWK);
        if (status === 404 || status === 410) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(s.endpoint).run();
          removed++;
        } else if (status < 300) sent++;
      } catch {
        /* falha pontual de rede: segue para o próximo */
      }
    }
  }
  return { sent, removed };
}

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(run(env));
  },
};
