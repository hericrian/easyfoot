import { useEffect, useState } from "react";
import {
  INSTALLABLE_EVENT,
  INSTALLED_EVENT,
  clearSavedPrompt,
  markInstalled,
  wasInstalledThisSession,
  getSavedPrompt,
  isChromium,
  isIosSafari,
  isMacSafari,
  isStandalone,
  platform,
  type InstallPromptEvent,
} from "../lib/pwa";

const DISMISS_KEY = "easyfoot:install-dismissed";

function ShareIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 11v9h14v-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Convite de instalação com três comportamentos, porque não existe API universal:
 * botão real no Chromium, instrução no iPhone/iPad e Safari do Mac, aviso nos demais.
 * `variant="compact"` mostra só o botão/linha curta (usado no topo); "card" é o completo.
 */
export function InstallApp({ variant = "card" }: { variant?: "card" | "compact" }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(() => getSavedPrompt());
  const [installed, setInstalled] = useState(() => isStandalone() || wasInstalledThisSession());
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const target = platform();

  useEffect(() => {
    const onAvailable = () => setPrompt(getSavedPrompt());
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener(INSTALLABLE_EVENT, onAvailable);
    window.addEventListener(INSTALLED_EVENT, onInstalled);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onMode = () => setInstalled(isStandalone());
    mq?.addEventListener?.("change", onMode);
    return () => {
      window.removeEventListener(INSTALLABLE_EVENT, onAvailable);
      window.removeEventListener(INSTALLED_EVENT, onInstalled);
      mq?.removeEventListener?.("change", onMode);
    };
  }, []);

  const install = async () => {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") markInstalled();
    } catch {
      /* prompt já usado */
    } finally {
      // Aceito ou recusado, o prompt não pode ser reutilizado.
      clearSavedPrompt();
      setPrompt(null);
      setBusy(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (installed) return null;

  if (variant === "compact") {
    if (!prompt) return null;
    return (
      <button type="button" className="btn sm install-chip" onClick={install} disabled={busy}>
        <DownloadIcon />
        {busy ? "Abrindo…" : "Instalar app"}
      </button>
    );
  }

  if (dismissed && !prompt) return null;

  let body: JSX.Element;
  if (prompt) {
    body = (
      <button type="button" className="btn primary block" onClick={install} disabled={busy}>
        <DownloadIcon />
        {busy ? "Abrindo…" : "Instalar o EasyFoot"}
      </button>
    );
  } else if (target === "ios") {
    body = isIosSafari() ? (
      <ol className="install-steps">
        <li>
          Toque em <strong>Compartilhar</strong> <ShareIcon /> na barra do Safari
        </li>
        <li>
          Escolha <strong>Adicionar à Tela de Início</strong>
        </li>
        <li>
          Toque em <strong>Adicionar</strong>
        </li>
      </ol>
    ) : (
      <p className="install-note">
        Toque em <strong>Compartilhar</strong> <ShareIcon /> e depois em <strong>Adicionar à Tela de Início</strong>. Se a opção não aparecer, abra{" "}
        <strong>easyfoot.pages.dev</strong> no <strong>Safari</strong>.
      </p>
    );
  } else if (isMacSafari()) {
    body = (
      <p className="install-note">
        No Safari, abra o menu <strong>Arquivo</strong> → <strong>Adicionar ao Dock</strong>.
      </p>
    );
  } else if (!isChromium()) {
    body = (
      <p className="install-note">
        Para instalar, abra o EasyFoot no <strong>Chrome</strong> ou no <strong>Edge</strong>. O Firefox não instala aplicativos web.
      </p>
    );
  } else {
    body = (
      <p className="install-note">
        {target === "android" ? (
          <>
            Toque no menu <strong>⋮</strong> do Chrome e escolha <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).
          </>
        ) : (
          <>
            Clique no ícone de instalar na barra de endereço, ou no menu <strong>⋮</strong> → <strong>Transmitir, salvar e compartilhar</strong> →{" "}
            <strong>Instalar página como app</strong>.
          </>
        )}
      </p>
    );
  }

  return (
    <aside className="install-card" aria-labelledby="install-title">
      <div className="install-head">
        <img src="/icons/icon-192.png" alt="" width={48} height={48} />
        <div>
          <h2 id="install-title">Instale o EasyFoot</h2>
          <p className="muted">Ícone na tela inicial, abre em tela cheia e funciona sem internet.</p>
        </div>
        {!prompt && (
          <button type="button" className="icon-btn" aria-label="Dispensar" onClick={dismiss}>
            ✕
          </button>
        )}
      </div>
      <ul className="platforms" aria-label="Plataformas suportadas">
        <li className={target === "ios" || target === "mac" ? "on" : undefined}>iPhone / Mac</li>
        <li className={target === "android" ? "on" : undefined}>Android</li>
        <li className={target === "windows" ? "on" : undefined}>Windows / PC</li>
      </ul>
      {body}
    </aside>
  );
}
