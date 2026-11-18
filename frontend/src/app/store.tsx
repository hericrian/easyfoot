import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DB, Match } from "../types";
import { loadDB, requestPersistence, saveDB } from "../lib/store";

type Toast = { id: number; text: string; leaving?: boolean };

type Ctx = {
  db: DB;
  setDb: (fn: (d: DB) => DB) => void;
  updateMatch: (id: string, fn: (m: Match) => Match) => void;
  toast: (text: string) => void;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDbState] = useState<DB>(() => loadDB());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const warned = useRef(false);
  const seq = useRef(0);

  const toast = useCallback((text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 2600);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  useEffect(() => {
    if (!saveDB(db) && !warned.current) {
      warned.current = true;
      toast("Não foi possível salvar neste navegador (modo privado?). Exporte um backup no Ranking.");
    }
  }, [db, toast]);

  useEffect(() => {
    if (db.matches.length) requestPersistence();
  }, [db.matches.length]);

  const setDb = useCallback((fn: (d: DB) => DB) => setDbState((d) => fn(d)), []);
  const updateMatch = useCallback(
    (id: string, fn: (m: Match) => Match) =>
      setDbState((d) => ({ ...d, matches: d.matches.map((m) => (m.id === id ? fn(m) : m)) })),
    [],
  );

  const value = useMemo(() => ({ db, setDb, updateMatch, toast }), [db, setDb, updateMatch, toast]);

  return (
    <StoreCtx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.leaving ? " leaving" : ""}`}>
            {t.text}
          </div>
        ))}
      </div>
    </StoreCtx.Provider>
  );
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("StoreProvider ausente");
  return c;
}

/** Rotas por hash — funcionam em qualquer host estático sem configuração. */
export function useRoute(): string[] {
  const read = () => (window.location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function go(path: string) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}
