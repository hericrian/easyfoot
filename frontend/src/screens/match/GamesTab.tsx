import { useState } from "react";
import { go, useStore } from "../../app/store";
import type { Game, GameSide, Match, Team } from "../../types";
import { gameScore, sideScore } from "../../lib/ranking";
import { gameText, shareText, whatsappUrl } from "../../lib/share";
import { uid } from "../../lib/util";
import { Empty, Sheet, Stepper, Swatch } from "../../components/ui";

function sideFrom(team: Team, match: Match, prev?: GameSide): GameSide {
  const byId = new Map(match.entries.map((e) => [e.id, e]));
  const goals = new Map(prev?.teamId === team.id ? prev.players.map((p) => [p.id, p.goals]) : []);
  return {
    teamId: team.id,
    name: team.name,
    color: team.color,
    players: team.playerIds
      .map((id) => byId.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ id: e.id, name: e.name, goals: goals.get(e.id) ?? 0 })),
    extra: prev?.teamId === team.id ? prev.extra : 0,
  };
}

/** "Ganhou fica": vencedor do último jogo enfrenta o próximo time da fila. */
function nextPairing(match: Match): [Team, Team] {
  const t = match.teams;
  const last = match.games[match.games.length - 1];
  if (!last || t.length < 3) return [t[0], t[1]];
  const [sa, sb] = gameScore(last);
  const stayId = sa >= sb ? last.a.teamId : last.b.teamId;
  const stay = t.find((x) => x.id === stayId) ?? t[0];
  const played = new Set([last.a.teamId, last.b.teamId]);
  const startIdx = Math.max(...[last.a.teamId, last.b.teamId].map((id) => t.findIndex((x) => x.id === id)));
  for (let k = 1; k <= t.length; k++) {
    const cand = t[(startIdx + k) % t.length];
    if (!played.has(cand.id)) return [stay, cand];
  }
  return [stay, t.find((x) => x.id !== stay.id) ?? t[1]];
}

function standings(match: Match) {
  const rows = new Map<string, { name: string; color: string; j: number; v: number; e: number; d: number; gp: number; gc: number }>();
  for (const t of match.teams) rows.set(t.id, { name: t.name, color: t.color, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 });
  for (const g of match.games) {
    const [a, b] = gameScore(g);
    for (const [side, mine, other] of [
      [g.a, a, b],
      [g.b, b, a],
    ] as const) {
      const r = rows.get(side.teamId) ?? { name: side.name, color: side.color, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 };
      r.j++;
      r.gp += mine;
      r.gc += other;
      if (mine > other) r.v++;
      else if (mine === other) r.e++;
      else r.d++;
      rows.set(side.teamId, r);
    }
  }
  return [...rows.values()].filter((r) => r.j > 0).sort((x, y) => y.v * 3 + y.e - (x.v * 3 + x.e) || y.gp - y.gc - (x.gp - x.gc) || y.gp - x.gp);
}

export function GamesTab({ match }: { match: Match }) {
  const { updateMatch, toast } = useStore();
  const [editing, setEditing] = useState<Game | null>(null);
  const isNew = editing ? !match.games.some((g) => g.id === editing.id) : false;

  if (match.teams.length < 2) {
    return (
      <Empty icon="🎲" title="Monte os times primeiro">
        <p className="muted">Depois do sorteio você registra placar e gols aqui.</p>
        <a className="btn primary" href={`#/partida/${match.id}/times`}>
          Ir para os times
        </a>
      </Empty>
    );
  }

  const startNew = () => {
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
    toast(`${editing.a.name} ${a} x ${b} ${editing.b.name} — salvo no ranking.`);
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
        <ul className="goal-list">
          {side.players.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              <Stepper size="sm" value={p.goals} min={0} max={30} label={`gols de ${p.name}`} onChange={(v) => setGoal(key, p.id, v)} />
            </li>
          ))}
          <li className="extra">
            <span>Gol contra / outros</span>
            <Stepper size="sm" value={side.extra} min={0} max={30} label="gols sem autor" onChange={(v) => setSide(key, { ...side, extra: v })} />
          </li>
        </ul>
      </div>
    );
  };

  return (
    <div className="stack">
      <button type="button" className="btn primary lg block" onClick={startNew}>
        + Registrar jogo
      </button>

      {table.length > 0 && (
        <div className="card">
          <h2>Classificação da partida</h2>
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
                  <tr key={r.name}>
                    <td className="left name">
                      <Swatch color={r.color} /> {r.name}
                    </td>
                    <td>{r.j}</td>
                    <td className="strong">{r.v}</td>
                    <td>{r.e}</td>
                    <td>{r.d}</td>
                    <td>{r.gp - r.gc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {games.length === 0 ? (
        <p className="muted center">Nenhum jogo registrado ainda.</p>
      ) : (
        <ul className="games">
          {games.map((g, i) => {
            const [a, b] = gameScore(g);
            const scorers = [...g.a.players, ...g.b.players].filter((p) => p.goals > 0);
            return (
              <li key={g.id} className="game">
                <div className="game-top">
                  <span className="muted">Jogo {games.length - i}</span>
                  <div className="row">
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={async () => {
                        const r = await shareText(gameText(match, g));
                        if (r === "copied") toast("Resultado copiado.");
                      }}
                    >
                      Compartilhar
                    </button>
                    <button type="button" className="btn sm" onClick={() => setEditing(JSON.parse(JSON.stringify(g)) as Game)}>
                      Editar
                    </button>
                  </div>
                </div>
                <div className="scoreline">
                  <span className="team-label">
                    <Swatch color={g.a.color} />
                    {g.a.name}
                  </span>
                  <strong className="score">
                    {a} <small>x</small> {b}
                  </strong>
                  <span className="team-label right">
                    {g.b.name}
                    <Swatch color={g.b.color} />
                  </span>
                </div>
                {scorers.length > 0 && (
                  <p className="scorers">
                    {scorers.map((p) => `⚽ ${p.name}${p.goals > 1 ? ` ×${p.goals}` : ""}`).join("  ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {match.games.length > 0 && (
        <button type="button" className="btn ghost block" onClick={() => go("/ranking")}>
          Ver ranking geral →
        </button>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={isNew ? "Novo jogo" : "Editar jogo"}>
        {editing && (
          <>
            <div className="big-score" aria-live="polite">
              <span>{sideScore(editing.a)}</span>
              <small>x</small>
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
