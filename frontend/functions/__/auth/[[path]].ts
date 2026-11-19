/**
 * Proxy do login do Firebase pelo próprio domínio (easyfoot.pages.dev/__/auth/*).
 * Assim a janela de login mostra easyfoot.pages.dev, e não o domínio técnico do
 * Firebase — e o login funciona no Safari/iOS, que bloqueia cookies de terceiros.
 * Ref.: firebase.google.com/docs/auth/web/redirect-best-practices (opção 3)
 */
const UPSTREAM = "https://easyfoot-app.firebaseapp.com";

export async function onRequest({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, UPSTREAM);
  const headers = new Headers(request.headers);
  headers.delete("host");
  const res = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
