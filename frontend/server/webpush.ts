/**
 * Envio de Web Push sem dependências (WebCrypto):
 * - criptografia do conteúdo "aes128gcm" (RFC 8291 / RFC 8188)
 * - autenticação VAPID com JWT ES256 (RFC 8292)
 */

export type PushSubscriptionJSON = { endpoint: string; keys: { p256dh: string; auth: string } };

const enc = new TextEncoder();

function b64u(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return (() => { const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; })();
}

function concat(...parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

export async function encrypt(payload: Uint8Array<ArrayBuffer>, sub: PushSubscriptionJSON): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = fromB64u(sub.keys.p256dh);
  const authSecret = fromB64u(sub.keys.auth);

  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const record = concat(payload, new Uint8Array([2])); // delimitador do último registro
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, record));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export async function vapidJwt(audience: string, privateJwk: JsonWebKey): Promise<string> {
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://easyfoot.pages.dev" })));
  const key = await crypto.subtle.importKey("jwk", { ...privateJwk, key_ops: ["sign"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64u(sig)}`;
}

function publicKeyFromJwk(jwk: JsonWebKey): string {
  return b64u(concat(new Uint8Array([4]), fromB64u(jwk.x!), fromB64u(jwk.y!)));
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Envia uma notificação. Retorna o status HTTP do serviço de push (404/410 = inscrição expirada). */
export async function sendPush(sub: PushSubscriptionJSON, msg: PushMessage, privateJwkJson: string): Promise<number> {
  const jwk = JSON.parse(privateJwkJson) as JsonWebKey;
  const body = await encrypt(enc.encode(JSON.stringify(msg)), sub);
  const audience = new URL(sub.endpoint).origin;
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "3600",
      urgency: "high",
      authorization: `vapid t=${await vapidJwt(audience, jwk)}, k=${publicKeyFromJwk(jwk)}`,
    },
    body,
  });
  return res.status;
}
