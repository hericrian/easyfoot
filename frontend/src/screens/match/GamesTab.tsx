import { useState } from "react";
import { go, useStore } from "../../app/store";
import type { Game, GameSide, Match } from "../../types";
import { gameScore, sideScore } from "../../lib/ranking";
import { nextPairing, sideFrom, standings } from "../../lib/games";
import { clock, liveScore } from "../../lib/live";
import { gameText, shareText, whatsappUrl } from "../../lib/share";
import { uid } from "../../lib/util";
import { Empty, Sheet, Stepper, Swatch } from "../../components/ui";
import { IconChevronRight, IconPencil, IconShare, IconShirt, IconTimer, IconWhistle } from "../../components/icons";

export function GamesTab({ match }: { match: Match }) {
  const { updateMatch, toast } = useStore();
  const [editing, setEditing] = useState<Game | null>(null);
  const isNew = editing ? !match.games.some((g) => g.id === editing.id) : false;

  if (match.teams.length < 2) {
    return (
      <Empty icon={<IconShirt size={40} />} title="Monte os times primeiro">
        <p className="muted">Depois do sorteio, os jogos e a classificação aparecem aqui.</p>
        <a className="btn primary" href={`#/partida/${match.id}/times`}>
          Ir para os times
        </a>
      </Empty>
    );
  }

  const startManual = () => {
    const [a, b] = nextPairing(match);
    setEditing({ id: uid(), createdAt: Date.now(), a: sideFrom(a, match), b: sideFrom(b, match) });
  };

  const save = () => {
    if (!editing) return;
    if (editing.a.teamId === editing.b.teamId) {
      toast("Escolha dois times diferentes.");
      return;
    }
    updateMatch(match.id, (m) => ({
      ...m,
      games: m.games.some((g) => g.id === editing.id) ? m.games.map((g) => (g.id === editing.id ? editing : g)) : [...m.games, editing],
    }));
    const [a, b] = gameScore(editing);
    toast(`${editing.a.name} ${a} x ${b} ${editing.b.name} — salvo.`);
    setEditing(null);
  };

  const remove = () => {
    if (!editing || !window.confirm("Apagar este jogo? Ele sai do ranking.")) return;
    updateMatch(match.id, (m) => ({ ...m, games: m.games.filter((g) => g.id !== editing.id) }));
    setEditing(null);
    toast("Jogo apagado.");
  };

  const setSide = (key: "a" | "b", side: GameSide) => setEditing((g) => (g ? { ...g, [key]: side } : g));
  const setGoal = (key: "a" | "b", pid: string, goals: number) =>
    setEditing((g) => (g ? { ...g, [key]: { ...g[key], players: g[key].players.map((p) => (p.id === pid ? { ...p, goals } : p)) } } : g));

  const table = standings(match);
  const games = [...match.games].reverse();
  const live = match.live;

  const sideEditor = (key: "a" | "b") => {
    if (!editing) return null;
    const side = editing[key];
    return (
      <div className="side">
        <label className="field">
          <span className="sr-only">Time {key === "a" ? "1" : "2"}</span>
          <select
            value={side.teamId}
            onChange={(e) => {
              const t = match.teams.find((x) => x.id === e.target.value);
              if (t) setSide(key, sideFrom(t, match));
            }}
          >
            {match.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <ul className="list inset">
          {side.players.map((p) => (
            <li key={p.id} className="row-item">
              <span className="grow">{p.name}</span>
              <Stepper size="sm" value={p.goals} min={0} max={30} label={`gols de ${p.name}`} onChange={(v) => setGoal(key, p.id, v)} />
            </li>
          ))}
          <li className="row-item">
            <span className="grow muted">Gol contra / sem autor</span>
            <Stepper size="sm" value={side.extra} min={0} max={30} label="gols sem autor" onChange={(v) => setSide(key, { ...side, extra: v })} />
          </li>
        </ul>
      </div>
    );
  };

  return (
    <div className="stack">
      {live ? (
        <a className="live-card" href={`#/partida/${match.id}/ao-vivo`}>
          <span className="live-pill">
            <span className="dot" aria-hidden /> {live.runningSince ? "Ao vivo" : "Pausado"}
          </span>
          <strong>
            {live.a.name} {liveScore(live).join(" x ")} {live.b.name}
          </strong>
          <IconChevronRight size={18} />
        </a>
      ) : (
        <div className="cta-pair">
          <button type="button" className="btn primary lg" onClick={() => go(`/partida/${match.id}/ao-vivo`)}>
            <IconWhistle /> Jogar ao vivo
          </button>
          <button type="button" className="btn lg" onClick={startManual}>
            <IconPencil /> Lançar placar
          </button>
        </div>
      )}

      {table.length > 0 && (
        <section className="group">
          <h2 className="group-title">Classificação da partida</h2>
          <div className="table-wrap">
            <table className="rank compact">
              <thead>
                <tr>
                  <th className="left">Time</th>
                  <th>J</th>
                  <th>V</th>
                  <th>E</th>
                  <th>D</th>
                  <th>SG</th>
                </tr>
              </thead>
              <tbody>
                {table.map((r) => (
                  <tr key={r.teamId}>
                    <td className="left name">
                      <Swatch color={r.color} /> {r.name}
                    </td>
                    <td>{r.j}</td>
                    <td className="strong">{r.v}</td>
                    <td>{r.e}</td>
                    <td>{r.d}</td>
                    <td>{r.gp - r.gc > 0 ? `+${r.gp - r.gc}` : r.gp - r.gc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {games.length === 0 ? (
        <p className="footnote center">Nenhum jogo ainda. Use "Jogar ao vivo" para cronômetro e placar, ou lance um resultado.</p>
      ) : (
        <section className="group">
          <h2 className="group-title">Jogos</h2>
          <ul className="games">
            {games.map((g, i) => {
              const [a, b] = gameScore(g);
              const scorers = [...g.a.players, ...g.b.players].filter((p) => p.goals > 0 || (p.assists ?? 0) > 0);
              return (
                <li key={g.id} className="game">
                  <div className="game-top">
                    <span className="eyebrow">
                      Jogo {games.length - i}
                      {g.durationMs ? (
                        <>
                          {" "}
                          · <IconTimer size={13} /> {clock(g.durationMs)}
                        </>
                      ) : null}
                    </span>
                    <div className="row">
                      <button
                        type="button"
                        className="icon-btn sm"
                        aria-label="Compartilhar resultado"
                        onClick={async () => {
                          const r = await shareText(gameText(match, g));
                          if (r === "copied") toast("Resultado copiado.");
                        }}
                      >
                        <IconShare size={17} />
                      </button>
                      <button type="button" className="icon-btn sm" aria-label="Editar jogo" onClick={() => setEditing(JSON.parse(JSON.stringify(g)) as Game)}>
                        <IconPencil size={17} />
                      </button>
                    </div>
                  </div>
                  <div className="scoreline">
                    <span className="team-label">
                      <Swatch color={g.a.color} />
                      {g.a.name}
                    </span>
                    <strong className="score">
                      {a}
                      <small>×</small>
                      {b}
                    </strong>
                    <span className="team-label right">
                      {g.b.name}
                      <Swatch color={g.b.color} />
                    </span>
                  </div>
                  {scorers.length > 0 && (
                    <p className="scorers">
                      {scorers
                        .map((p) => {
                          const parts = [];
                          if (p.goals) parts.push(`${p.goals} ${p.goals > 1 ? "gols" : "gol"}`);
                          if (p.assists) parts.push(`${p.assists} assist.`);
                          return `${p.name} (${parts.join(", ")})`;
                        })
                        .join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {match.games.length > 0 && (
        <a className="btn ghost block" href="#/ranking">
          Ver ranking geral <IconChevronRight size={18} />
        </a>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={isNew ? "Lançar placar" : "Editar jogo"}>
        {editing && (
          <>
            <div className="big-score" aria-live="polite">
              <span>{sideScore(editing.a)}</span>
              <small>×</small>
              <span>{sideScore(editing.b)}</span>
            </div>
            <div className="sides">
              {sideEditor("a")}
              {sideEditor("b")}
            </div>
            <div className="sheet-actions">
              <button type="button" className="btn primary lg block" onClick={save}>
                Salvar resultado
              </button>
              {!isNew && (
                <>
                  <a className="btn whatsapp block" href={whatsappUrl(gameText(match, editing))} target="_blank" rel="noopener noreferrer">
                    Enviar no WhatsApp
                  </a>
                  <button type="button" className="btn danger-text block" onClick={remove}>
                    Apagar jogo
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
