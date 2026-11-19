import { useState, type ReactNode } from "react";
import { go, useStore } from "../app/store";
import { Empty, Sheet } from "../components/ui";
import { IconList, IconPencil, IconShirt, IconTrophy, IconWhistle } from "../components/icons";
import { formatDate } from "../lib/util";
import { MatchInfoFields } from "./NewMatch";
import { ListTab } from "./match/ListTab";
import { TeamsTab } from "./match/TeamsTab";
import { GamesTab } from "./match/GamesTab";
import { LiveTab } from "./match/Live";

const TABS: [string, string, ReactNode][] = [
  ["lista", "Lista", <IconList key="l" size={18} />],
  ["times", "Times", <IconShirt key="t" size={18} />],
  ["ao-vivo", "Ao vivo", <IconWhistle key="v" size={18} />],
  ["jogos", "Jogos", <IconTrophy key="j" size={18} />],
];

export function MatchScreen({ id, tab }: { id: string; tab?: string }) {
  const { db, updateMatch, setDb, toast } = useStore();
  const match = db.matches.find((m) => m.id === id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", location: "", date: "", time: "" });

  if (!match) {
    return (
      <section className="panel">
        <Empty icon={<IconList size={40} />} title="Partida não encontrada">
          <p className="muted">Ela pode ter sido apagada ou está em outro aparelho.</p>
          <a className="btn primary" href="#/">
            Voltar às partidas
          </a>
        </Empty>
      </section>
    );
  }

  const fallback = match.live ? "ao-vivo" : "lista";
  const current = TABS.find(([k]) => k === tab)?.[0] ?? fallback;
  const counts: Record<string, number> = {
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
      <header className="page-head">
        <div>
          <p className="eyebrow">{[formatDate(match.date, match.time), match.location].filter(Boolean).join(" · ") || "Sem data definida"}</p>
          <h1>{match.title || "Pelada"}</h1>
        </div>
        <button type="button" className="icon-btn" aria-label="Editar partida" onClick={openEdit}>
          <IconPencil size={18} />
        </button>
      </header>

      <nav className="segmented tabs" aria-label="Etapas da partida">
        {TABS.map(([k, label, icon]) => (
          <a key={k} href={`#/partida/${id}/${k}`} aria-current={current === k ? "page" : undefined}>
            {k === "ao-vivo" && match.live ? <span className="live-dot static" aria-label="ao vivo" /> : icon}
            <span>{label}</span>
            {counts[k] > 0 && <span className="tab-count">{counts[k]}</span>}
          </a>
        ))}
      </nav>

      {current === "lista" && <ListTab match={match} />}
      {current === "times" && <TeamsTab match={match} />}
      {current === "ao-vivo" && <LiveTab match={match} />}
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
          <button type="submit" className="btn primary lg block">
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
