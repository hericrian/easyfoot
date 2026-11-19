// Tipos mínimos do D1 e do ambiente das Functions/Worker (sem depender de @cloudflare/workers-types).
export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1 {
  prepare(sql: string): D1Prepared;
  batch(statements: D1Prepared[]): Promise<unknown[]>;
}
export interface Env {
  DB: D1;
  VAPID_PRIVATE_JWK?: string;
  REVIEWS_SALT?: string;
}
export type Ctx = { request: Request; env: Env };

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "x-content-type-options": "nosniff", ...extra },
  });
}

const ALLOWED_HOSTS = [/^easyfoot\.pages\.dev$/, /^[a-z0-9-]+\.easyfoot\.pages\.dev$/, /^localhost$/, /^127\.0\.0\.1$/];

export function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return ALLOWED_HOSTS.some((re) => re.test(new URL(origin).hostname));
  } catch {
    return false;
  }
}
