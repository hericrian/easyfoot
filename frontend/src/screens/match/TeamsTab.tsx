import { useMemo, useState } from "react";
import { go, useStore } from "../../app/store";
import type { Entry, Match, Team } from "../../types";
import { TEAM_COLORS, drawTeams, suggestedTeamCount } from "../../lib/draw";
import { strengthByKey } from "../../lib/ranking";
import { shareText, teamsText, whatsappUrl } from "../../lib/share";
import { nameKey } from "../../lib/util";
import { Empty, GkBadge, Stepper, Swatch } from "../../components/ui";
import { IconList, IconShare, IconShuffle, IconWhistle } from "../../components/icons";
import { Draft } from "./Draft";

type Mode = "setup" | "draft" | "view";

export function TeamsTab({ match }: { match: Match }) {
  const { db, updateMatch, toast } = useStore();
  const active = match.entries.filter((e) => !e.reserve);
  const [mode, setMode] = useState<Mode>(match.teams.length ? "view" : "setup");
  const [teamCount, setTeamCount] = useState(() => (match.teams.length >= 2 ? match.teams.length : suggestedTeamCount(match.entries)));
  const [method, setMethod] = useState<"auto" | "draft">("auto");
  const [balance, setBalance] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);

  const strength = useMemo(() => strengthByKey(db.matches), [db.matches]);
  const known = active.filter((e) => strength.has(nameKey(e.name))).length;
  const byId = new Map(match.entries.map((e) => [e.id, e]));

  if (active.length < 2) {
    return (
      <Empty icon={<IconList size={40} />} title="Faltam jogadores">
        <p className="muted">Monte a lista primeiro — pelo menos 2 confirmados.</p>
        <a className="btn primary" href={`#/partida/${match.id}/lista`}>
          Ir para a lista
        </a>
      </Empty>
    );
  }

  const maxTeams = Math.max(2, Math.min(8, Math.floor(active.length / 2)));
  const perTeam = active.length / teamCount;
  const gks = active.filter((e) => e.gk).length;

  const setTeams = (teams: Team[]) => updateMatch(match.id, (m) => ({ ...m, teams }));

  const runDraw = (count: number = teamCount) => {
    let scores: Record<string, number> | undefined;
    if (balance) {
      scores = {};
      for (const e of active) scores[e.id] = strength.get(nameKey(e.name)) ?? 0.5;
    }
    const fresh = drawTeams(match.entries, count, scores);
    // Mantém nomes/cores que o usuário personalizou
    setTeams(fresh.map((t, i) => (match.teams[i] ? { ...t, name: match.teams[i].name, color: match.teams[i].color } : t)));
    setMode("view");
    setMoving(null);
  };

  if (mode === "draft") {
    return (
      <Draft
        entries={active}
        teamCount={teamCount}
        onCancel={() => setMode(match.teams.length ? "view" : "setup")}
        onDone={(teams) => {
          setTeams(teams);
          setMode("view");
          toast("Draft concluído!");
        }}
      />
    );
  }

  if (mode === "setup") {
    return (
      <div className="stack">
        <div className="card">
          <h2>Como montar os times?</h2>
          <div className="option-grid">
            <button type="button" className="option" aria-pressed={method === "auto"} onClick={() => setMethod("auto")}>
              <IconShuffle size={26} />
              <strong>Sorteio</strong>
              <small>Automático e equilibrado</small>
            </button>
            <button type="button" className="option" aria-pressed={method === "draft"} onClick={() => setMethod("draft")}>
              <IconWhistle size={26} />
              <strong>Draft</strong>
              <small>Capitães escolhem</small>
            </button>
          </div>

          <div className="setting">
            <div>
              <strong>Número de times</strong>
              <small className="muted">
                ≈ {perTeam % 1 === 0 ? perTeam : perTeam.toFixed(1)} por time · {gks} {gks === 1 ? "goleiro" : "goleiros"}
              </small>
            </div>
            <Stepper value={teamCount} onChange={setTeamCount} min={2} max={maxTeams} label="número de times" />
          </div>

          {gks > 0 && gks < teamCount && <p className="hint warn">Há menos goleiros que times — algum time vai ficar sem goleiro fixo.</p>}

          {method === "auto" && (
            <label className={`setting check${known ? "" : " disabled"}`}>
              <div>
                <strong>Equilibrar pelo ranking</strong>
                <small className="muted">
                  {known ? `Usa o aproveitamento de ${known} jogador(es) com histórico` : "Disponível depois de registrar jogos"}
                </small>
              </div>
              <input type="checkbox" checked={balance && !!known} disabled={!known} onChange={(e) => setBalance(e.target.checked)} />
            </label>
          )}

          <button type="button" className="btn primary lg block" onClick={() => (method === "auto" ? runDraw(teamCount) : setMode("draft"))}>
            {method === "auto" ? "Sortear times" : "Começar draft"}
          </button>
        </div>
        {match.teams.length > 0 && (
          <button type="button" className="btn ghost block" onClick={() => setMode("view")}>
            Voltar aos times atuais
          </button>
        )}
      </div>
    );
  }

  const assigned = new Set(match.teams.flatMap((t) => t.playerIds));
  const unassigned = active.filter((e) => !assigned.has(e.id));
  const movingEntry = moving ? byId.get(moving) : undefined;

  const moveTo = (teamId: string | null) => {
    if (!moving) return;
    setTeams(
      match.teams.map((t) => {
        const without = t.playerIds.filter((p) => p !== moving);
        return t.id === teamId ? { ...t, playerIds: [...without, moving] } : { ...t, playerIds: without };
      }),
    );
    setMoving(null);
  };

  const patchTeam = (id: string, p: Partial<Team>) => setTeams(match.teams.map((t) => (t.id === id ? { ...t, ...p } : t)));

  const share = async () => {
    const r = await shareText(teamsText(match));
    if (r === "copied") toast("Times copiados. É só colar no grupo.");
    if (r === "failed") toast("Não foi possível compartilhar neste navegador.");
  };

  const playerChip = (e: Entry) => (
    <li key={e.id}>
      <button type="button" className={`player${moving === e.id ? " selected" : ""}`} aria-pressed={moving === e.id} onClick={() => setMoving(moving === e.id ? null : e.id)}>
        {e.gk && <GkBadge />}
        {e.name}
      </button>
    </li>
  );

  return (
    <div className="stack">
      {movingEntry && (
        <div className="move-bar" role="region" aria-label="Mover jogador">
          <span>
            Mover <strong>{movingEntry.name}</strong> para:
          </span>
          <div className="row">
            {match.teams.map((t) => (
              <button key={t.id} type="button" className="btn sm" disabled={t.playerIds.includes(movingEntry.id)} onClick={() => moveTo(t.id)}>
                <Swatch color={t.color} /> {t.name.replace(/^Time /, "")}
              </button>
            ))}
            <button type="button" className="btn sm ghost" onClick={() => setMoving(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="teams">
        {match.teams.map((t) => {
          const players = t.playerIds.map((id) => byId.get(id)).filter((e): e is Entry => !!e);
          players.sort((a, b) => Number(b.gk) - Number(a.gk));
          return (
            <article key={t.id} className="team">
              <header>
                <details className="color-pick">
                  <summary aria-label={`Cor do ${t.name}`}>
                    <Swatch color={t.color} />
                  </summary>
                  <div className="color-menu">
                    {TEAM_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={c.name}
                        onClick={(ev) => {
                          const oldName = TEAM_COLORS.find((x) => x.hex === t.color)?.name;
                          patchTeam(t.id, { color: c.hex, name: oldName && t.name === `Time ${oldName}` ? `Time ${c.name}` : t.name });
                          (ev.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                        }}
                      >
                        <Swatch color={c.hex} />
                      </button>
                    ))}
                  </div>
                </details>
                <input className="team-name" value={t.name} maxLength={24} aria-label="Nome do time" onChange={(e) => patchTeam(t.id, { name: e.target.value })} />
                <span className="muted">{players.length}</span>
              </header>
              <ul className="players">{players.map(playerChip)}</ul>
            </article>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="card">
          <div className="section-head">
            <h3>Sem time</h3>
            <span className="muted">toque para mover</span>
          </div>
          <ul className="players">{unassigned.map(playerChip)}</ul>
        </div>
      )}

      <p className="hint">Toque num jogador para trocá-lo de time. Toque no nome do time para renomear.</p>

      <div className="row wrap">
        <button type="button" className="btn primary" onClick={share}>
          <IconShare size={18} /> Compartilhar
        </button>
        <a className="btn whatsapp" href={whatsappUrl(teamsText(match))} target="_blank" rel="noopener noreferrer">
          Enviar no WhatsApp
        </a>
        <button
          type="button"
          className="btn"
          onClick={() => {
            const count = match.teams.length || teamCount;
            setTeamCount(count);
            runDraw(count);
            toast("Times sorteados de novo.");
          }}
        >
          <IconShuffle size={18} /> Sortear de novo
        </button>
        <button type="button" className="btn ghost" onClick={() => setMode("setup")}>
          Mudar formato
        </button>
      </div>

      <button type="button" className="btn primary lg block" onClick={() => go(`/partida/${match.id}/ao-vivo`)}>
        <IconWhistle size={20} /> Ir para o jogo ao vivo
      </button>
    </div>
  );
}
