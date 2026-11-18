import { useState } from "react";
import { go, useStore } from "../app/store";
import { Empty, Sheet } from "../components/ui";
import { formatDate } from "../lib/util";
import { MatchInfoFields } from "./NewMatch";
import { ListTab } from "./match/ListTab";
import { TeamsTab } from "./match/TeamsTab";
import { GamesTab } from "./match/GamesTab";

const TABS = [
  ["lista", "Lista"],
  ["times", "Times"],
  ["jogos", "Jogos"],
] as const;
type Tab = (typeof TABS)[number][0];

export function MatchScreen({ id, tab }: { id: string; tab?: string }) {
  const { db, updateMatch, setDb, toast } = useStore();
  const match = db.matches.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", location: "", date: "", time: "" });

  if (!match) {
    return (
      <section className="panel">
        <Empty icon="🤷" title="Partida não encontrada">
          <p className="muted">Ela pode ter sido apagada ou está em outro aparelho.</p>
          <a className="btn primary" href="#/">
            Voltar ao início
          </a>
        </Empty>
      </section>
    );
  }

  const current: Tab = (TABS.find(([k]) => k === tab)?.[0] ?? "lista") as Tab;
  const counts = {
    lista: match.entries.filter((e) => !e.reserve).length,
    times: match.teams.length,
    jogos: match.games.length,
  };

  const openEdit = () => {
    setDraft({ title: match.title, location: match.location, date: match.date, time: match.time });
    setEditing(true);
  };

  const remove = () => {
    if (!window.confirm(`Apagar "${match.title}"? Os jogos dela saem do ranking.`)) return;
    setDb((d) => ({ ...d, matches: d.matches.filter((m) => m.id !== id) }));
    toast("Partida apagada.");
    go("/");
  };

  return (
    <section className="panel">
      <header className="match-head">
        <div>
          <h1>{match.title || "Pelada"}</h1>
          <p className="muted">{[formatDate(match.date, match.time), match.location].filter(Boolean).join(" · ") || "Sem data definida"}</p>
        </div>
        <button type="button" className="btn sm" onClick={openEdit}>
          Editar
        </button>
      </header>

      <nav className="tabs" aria-label="Etapas da partida">
        {TABS.map(([k, label], i) => (
          <a key={k} href={`#/partida/${id}/${k}`} aria-current={current === k ? "page" : undefined}>
            <span className="tab-step">{i + 1}</span>
            {label}
            {counts[k] > 0 && <span className="tab-count">{counts[k]}</span>}
          </a>
        ))}
      </nav>

      {current === "lista" && <ListTab match={match} />}
      {current === "times" && <TeamsTab match={match} />}
      {current === "jogos" && <GamesTab match={match} />}

      <Sheet open={editing} onClose={() => setEditing(false)} title="Editar partida">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMatch(id, (m) => ({ ...m, ...draft, title: draft.title.trim() || "Pelada", location: draft.location.trim() }));
            setEditing(false);
            toast("Partida atualizada.");
          }}
        >
          <MatchInfoFields value={draft} onChange={setDraft} />
          <button type="submit" className="btn primary block">
            Salvar
          </button>
          <button type="button" className="btn danger-text block" onClick={remove}>
            Apagar partida
          </button>
        </form>
      </Sheet>
    </section>
  );
}
