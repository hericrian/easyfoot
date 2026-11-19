/**
 * Notificações Web Push (funcionam com o app fechado).
 * - Android/PC: Chrome, Edge, Firefox.
 * - iPhone/iPad: só com o EasyFoot instalado na tela inicial (iOS 16.4+).
 * O servidor (Cloudflare) guarda a inscrição do aparelho e dispara os avisos agendados.
 */
import { VAPID_PUBLIC_KEY } from "../config/push";
import { idToken } from "./auth";

export type PushState = "unsupported" | "install-ios" | "default" | "granted" | "denied";

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function standalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  if (!supported) return isIOS() && !standalone() ? "install-ios" : "unsupported";
  return Notification.permission as PushState;
}

function keyBytes(b64url: string): ArrayBuffer {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const s = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

async function authHeaders(): Promise<Record<string, string>> {
  const t = await idToken();
  return t ? { authorization: `Bearer ${t}`, "content-type": "application/json" } : { "content-type": "application/json" };
}

/** Pede permissão e registra este aparelho para receber notificações. */
export async function enablePush(): Promise<PushState> {
  const state = pushState();
  if (state === "unsupported" || state === "install-ios") return state;
  const perm = state === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return perm as PushState;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    await fetch("/api/push/subscribe", { method: "POST", headers: await authHeaders(), body: JSON.stringify(sub.toJSON()) });
  } catch (err) {
    console.warn("push subscribe", err);
  }
  return "granted";
}

export type ScheduledPush = { at: number; title: string; body: string; url?: string; tag?: string };

/**
 * Substitui o grupo de avisos agendados (ex.: "live:<id>") por estes itens.
 * Lista vazia cancela o grupo. Silencioso se não houver login ou permissão.
 */
export async function schedulePush(group: string, items: ScheduledPush[]): Promise<void> {
  if (pushState() !== "granted") return;
  const headers = await authHeaders();
  if (!headers.authorization) return;
  try {
    await fetch("/api/push/schedule", { method: "POST", headers, body: JSON.stringify({ group, items }) });
  } catch {
    /* offline: o aviso local continua funcionando com o app aberto */
  }
}

/** Lembretes do horário da pelada: 1 h e 15 min antes do início. */
export function scheduleMatchReminders(m: { id: string; title: string; date: string; time: string; location: string }): void {
  const [y, mo, d] = m.date.split("-").map(Number);
  const [h, mi] = m.time.split(":").map(Number);
  if (!y || !mo || !d || !Number.isFinite(h) || !Number.isFinite(mi)) return;
  const start = new Date(y, mo - 1, d, h, mi).getTime();
  const where = m.location ? ` · ${m.location}` : "";
  const hour = `${h}h${mi ? String(mi).padStart(2, "0") : ""}`;
  const url = `/#/partida/${m.id}`;
  const items: ScheduledPush[] = [
    { at: start - 60 * 60_000, title: `${m.title || "Pelada"} daqui a 1 hora`, body: `Hoje às ${hour}${where}. Confira a lista e os times.`, url, tag: `match-${m.id}` },
    { at: start - 15 * 60_000, title: `${m.title || "Pelada"} em 15 minutos`, body: `Bola rola às ${hour}${where}.`, url, tag: `match-${m.id}` },
  ].filter((i) => i.at > Date.now());
  void schedulePush(`match:${m.id}`, items);
}
