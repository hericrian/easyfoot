import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "./store";
import { Sheet } from "../components/ui";
import { IconBell, IconCheck } from "../components/icons";
import { friendlyAuthError, hadSession, signInWithGoogle, signOutAccount, watchAccount, type Account } from "../lib/auth";
import { enablePush, pushState, type PushState } from "../lib/push";
import { syncGames } from "../lib/cloud";

type Ctx = {
  account: Account | null;
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  openAccount: () => void;
  push: PushState;
  askNotifications: () => void;
};

const AccountCtx = createContext<Ctx | null>(null);
const ASKED = "easyfoot:notify-asked";

export function AccountProvider({ children }: { children: ReactNode }) {
  const { toast, db } = useStore();
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(!hadSession());
  const [sheet, setSheet] = useState(false);
  const [notifyAsk, setNotifyAsk] = useState(false);
  const [push, setPush] = useState<PushState>(() => pushState());
  const [busy, setBusy] = useState(false);

  // Só carrega o Firebase se a pessoa já entrou neste aparelho (ou ao tocar em "Entrar").
  useEffect(() => {
    if (!hadSession()) return;
    let off: (() => void) | undefined;
    void watchAccount((a) => {
      setAccount(a);
      setReady(true);
    }).then((u) => (off = u));
    return () => off?.();
  }, []);

  const maybeAskNotifications = useCallback(() => {
    let asked = false;
    try {
      asked = localStorage.getItem(ASKED) === "1";
    } catch {
      /* ignore */
    }
    if (!asked && pushState() === "default") setNotifyAsk(true);
  }, []);

  const signIn = useCallback(async () => {
    setBusy(true);
    try {
      const a = await signInWithGoogle();
      if (a) {
        setAccount(a);
        setReady(true);
        void watchAccount(setAccount);
        toast(`Olá, ${a.name.split(" ")[0]}!`);
        maybeAskNotifications();
      }
    } catch (err) {
      toast(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  }, [toast, maybeAskNotifications]);

  // Ranking online: publica jogos novos/alterados de quem está logado (com pequena espera)
  useEffect(() => {
    if (!account) return;
    const t = setTimeout(() => void syncGames(db.matches), 1500);
    return () => clearTimeout(t);
  }, [account, db.matches]);

  // Volta de um login por redirecionamento: pergunta das notificações na primeira vez
  useEffect(() => {
    if (account) maybeAskNotifications();
  }, [account, maybeAskNotifications]);

  const signOut = useCallback(async () => {
    await signOutAccount();
    setAccount(null);
    setSheet(false);
    toast("Você saiu da conta.");
  }, [toast]);

  const enable = useCallback(async () => {
    try {
      localStorage.setItem(ASKED, "1");
    } catch {
      /* ignore */
    }
    setNotifyAsk(false);
    const result = await enablePush();
    setPush(pushState());
    if (result === "granted") toast("Notificações ativadas.");
    else if (result === "denied") toast("Notificações bloqueadas. Dá para liberar nos ajustes do navegador.");
    else if (result === "install-ios") toast("No iPhone, instale o EasyFoot na tela inicial para receber notificações.");
    else if (result === "unsupported") toast("Este navegador não suporta notificações.");
  }, [toast]);

  const value = useMemo<Ctx>(
    () => ({ account, ready, signIn, signOut, openAccount: () => setSheet(true), push, askNotifications: () => setNotifyAsk(true) }),
    [account, ready, signIn, signOut, push],
  );

  return (
    <AccountCtx.Provider value={value}>
      {children}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Sua conta">
        {account ? (
          <div className="account-sheet">
            <Avatar account={account} size={64} />
            <strong>{account.name}</strong>
            <span className="muted">{account.email}</span>
            <div className="list inset account-rows">
              <div className="row-item">
                <IconBell size={20} />
                <span className="grow">
                  <strong>Notificações</strong>
                  <small>
                    {push === "granted"
                      ? "Ativadas neste aparelho"
                      : push === "denied"
                        ? "Bloqueadas nos ajustes do navegador"
                        : push === "install-ios"
                          ? "Instale o app na tela inicial para ativar"
                          : push === "unsupported"
                            ? "Não suportadas neste navegador"
                            : "Desativadas"}
                  </small>
                </span>
                {push === "default" && (
                  <button type="button" className="btn sm primary" onClick={() => void enable()}>
                    Ativar
                  </button>
                )}
                {push === "granted" && <IconCheck size={20} />}
              </div>
            </div>
            <button type="button" className="btn danger-text block" onClick={() => void signOut()}>
              Sair da conta
            </button>
          </div>
        ) : (
          <div className="account-sheet">
            <p className="muted center">Entre para avaliar o app e receber avisos da pelada.</p>
            <GoogleButton busy={busy} onClick={() => void signIn()} />
          </div>
        )}
      </Sheet>

      <Sheet open={notifyAsk} onClose={() => setNotifyAsk(false)} title="Ativar notificações?">
        <div className="notify-ask">
          <span className="notify-icon" aria-hidden>
            <IconBell size={30} />
          </span>
          <p>O EasyFoot pode avisar mesmo com o app fechado:</p>
          <ul>
            <li>Hora de substituir e fim do tempo do jogo</li>
            <li>Lembrete antes do horário da pelada</li>
            <li>Novidades do app</li>
          </ul>
          <button type="button" className="btn primary lg block" onClick={() => void enable()}>
            Permitir notificações
          </button>
          <button
            type="button"
            className="btn ghost block"
            onClick={() => {
              try {
                localStorage.setItem(ASKED, "1");
              } catch {
                /* ignore */
              }
              setNotifyAsk(false);
            }}
          >
            Agora não
          </button>
        </div>
      </Sheet>
    </AccountCtx.Provider>
  );
}

export function useAccount(): Ctx {
  const c = useContext(AccountCtx);
  if (!c) throw new Error("AccountProvider ausente");
  return c;
}

export function Avatar({ account, size = 30 }: { account: Account; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (account.photo && !broken) {
    return (
      <img className="avatar-img" src={account.photo} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    );
  }
  return (
    <span className="avatar-img initials" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {account.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Botão no padrão de marca do Google (fundo claro, "G" colorido). */
export function GoogleButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button type="button" className="google-btn" onClick={onClick} disabled={busy}>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {busy ? "Abrindo…" : "Continuar com o Google"}
    </button>
  );
}

/** Botão compacto da barra/hero: foto quando logado, "Entrar" quando não. */
export function AccountButton({ onDark = false }: { onDark?: boolean }) {
  const { account, ready, openAccount } = useAccount();
  if (!ready) return <span className="account-btn placeholder" aria-hidden />;
  return account ? (
    <button type="button" className="account-btn" onClick={openAccount} aria-label={`Conta de ${account.name}`}>
      <Avatar account={account} />
    </button>
  ) : (
    <button type="button" className={`btn sm signin-btn${onDark ? " on-dark" : ""}`} onClick={openAccount}>
      Entrar
    </button>
  );
}
