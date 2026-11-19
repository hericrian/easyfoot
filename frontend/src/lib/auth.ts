/**
 * Login com Google (Firebase Auth). O SDK é carregado sob demanda para não pesar
 * a primeira abertura do app — quem nunca entra na conta nem baixa o Firebase.
 */
import type { Auth, User } from "firebase/auth";
import { firebaseConfig } from "../config/firebase";

export type Account = { uid: string; name: string; email: string; photo: string | null };

let authPromise: Promise<Auth> | null = null;

async function getAuthLazy(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ initializeApp, getApps }, { getAuth, browserLocalPersistence, setPersistence }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
    ]);
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const auth = getAuth(app);
    auth.languageCode = "pt-BR";
    await setPersistence(auth, browserLocalPersistence);
    return auth;
  })();
  return authPromise;
}

function toAccount(u: User | null): Account | null {
  if (!u) return null;
  return { uid: u.uid, name: u.displayName || u.email?.split("@")[0] || "Jogador", email: u.email || "", photo: u.photoURL };
}

const HINT = "easyfoot:signed-in";

/** Já entrou neste aparelho antes? Evita baixar o SDK para quem nunca usou login. */
export function hadSession(): boolean {
  try {
    return localStorage.getItem(HINT) === "1";
  } catch {
    return false;
  }
}

function setHint(on: boolean) {
  try {
    if (on) localStorage.setItem(HINT, "1");
    else localStorage.removeItem(HINT);
  } catch {
    /* ignore */
  }
}

export async function watchAccount(cb: (a: Account | null) => void): Promise<() => void> {
  const auth = await getAuthLazy();
  const { onAuthStateChanged, getRedirectResult } = await import("firebase/auth");
  // Conclui um login por redirecionamento (usado no iPhone instalado como app)
  getRedirectResult(auth).catch(() => undefined);
  return onAuthStateChanged(auth, (u) => {
    setHint(!!u);
    cb(toAccount(u));
  });
}

function isStandaloneIOS(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios && (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function signInWithGoogle(): Promise<Account | null> {
  const auth = await getAuthLazy();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  // No app instalado do iPhone, pop-ups abrem fora do app: usa redirecionamento.
  if (isStandaloneIOS()) {
    await signInWithRedirect(auth, provider);
    return null;
  }
  try {
    const res = await signInWithPopup(auth, provider);
    setHint(true);
    return toAccount(res.user);
  } catch (err) {
    const code = (err as { code?: string }).code || "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return null;
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
    throw err;
  }
}

export async function signOutAccount(): Promise<void> {
  const auth = await getAuthLazy();
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
  setHint(false);
}

/** Token de identidade para a API (o servidor confere a assinatura do Google). */
export async function idToken(): Promise<string | null> {
  if (!authPromise && !hadSession()) return null;
  const auth = await getAuthLazy();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || "";
  if (code === "auth/network-request-failed") return "Sem conexão. Tente de novo quando a internet voltar.";
  if (code === "auth/unauthorized-domain") return "Este endereço não está liberado para login.";
  if (code === "auth/too-many-requests") return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo.";
}
