/**
 * Verifica o ID token do Firebase Auth (JWT RS256 assinado pelo Google) sem SDK,
 * com WebCrypto — funciona em Cloudflare Workers/Pages Functions.
 * Regras: firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const PROJECT_ID = "easyfoot-app";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

type Jwk = JsonWebKey & { kid: string };
let cache: { keys: Jwk[]; until: number } | null = null;

async function keys(): Promise<Jwk[]> {
  if (cache && cache.until > Date.now()) return cache.keys;
  const res = await fetch(JWKS_URL);
  const data = (await res.json()) as { keys: Jwk[] };
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1] || 3600);
  cache = { keys: data.keys, until: Date.now() + maxAge * 1000 };
  return data.keys;
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return (() => { const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; })();
}

export type FirebaseUser = { uid: string; name: string; email: string; picture: string | null };

export async function verifyIdToken(token: string): Promise<FirebaseUser | null> {
  try {
    const [h, p, sig] = token.split(".");
    if (!h || !p || !sig) return null;
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    if (header.alg !== "RS256") return null;
    const now = Math.floor(Date.now() / 1000);
    if (claims.aud !== PROJECT_ID || claims.iss !== `https://securetoken.google.com/${PROJECT_ID}`) return null;
    if (!claims.sub || claims.exp < now || claims.iat > now + 300 || claims.auth_time > now + 300) return null;

    const jwk = (await keys()).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    return {
      uid: claims.sub,
      name: String(claims.name || claims.email?.split("@")[0] || "Jogador").slice(0, 40),
      email: String(claims.email || ""),
      picture: typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture : null,
    };
  } catch {
    return null;
  }
}

export async function userFromRequest(req: Request): Promise<FirebaseUser | null> {
  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  return m ? verifyIdToken(m[1]) : null;
}
