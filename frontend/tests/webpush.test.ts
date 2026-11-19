import { describe, expect, it } from "vitest";
import { encrypt, vapidJwt } from "../server/webpush";

const b64u = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
const unb64u = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

describe("Web Push (RFC 8291 / 8292)", () => {
  it("a mensagem cifrada é decifrada pelo aparelho (lado do navegador)", async () => {
    // Chaves do "navegador" (inscrição)
    const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    const uaPublic = new Uint8Array((await crypto.subtle.exportKey("raw", ua.publicKey)) as ArrayBuffer);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    const msg = JSON.stringify({ title: "Hora de substituir!", body: "Troque quem está de fora." });

    const body = await encrypt(new TextEncoder().encode(msg), { endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: b64u(uaPublic), auth: b64u(auth) } });

    // Decifra como o navegador faria
    const salt = body.slice(0, 16);
    const idlen = body[20];
    const asPublic = body.slice(21, 21 + idlen);
    const cipher = body.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.privateKey, 256));
    const info = new Uint8Array([...new TextEncoder().encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
    const ikm = await hkdf(auth, shared, info, 32);
    const cek = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(salt, ikm, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
    const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, cipher));

    expect(plain[plain.length - 1]).toBe(2); // delimitador do último registro
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe(msg);
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096);
  });

  it("o JWT VAPID tem assinatura ES256 válida e audiência do serviço de push", async () => {
    const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const priv = (await crypto.subtle.exportKey("jwk", kp.privateKey)) as JsonWebKey;
    const jwt = await vapidJwt("https://fcm.googleapis.com", priv);
    const [h, p, s] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, unb64u(s), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
  });
});
