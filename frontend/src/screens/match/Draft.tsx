import { useMemo, useState } from "react";
import type { Entry, Team } from "../../types";
import { draftOrder, emptyTeams } from "../../lib/draw";
import { shuffle } from "../../lib/util";
import { Swatch } from "../../components/ui";

type Phase = "captains" | "coin" | "picking";

export function Draft({
  entries,
  teamCount,
  onDone,
  onCancel,
}: {
  entries: Entry[];
  teamCount: number;
  onDone: (teams: Team[]) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("captains");
  const [captains, setCaptains] = useState<string[]>([]);
  const [separateGk, setSeparateGk] = useState(true);
  const [snake, setSnake] = useState(true);
  const [first, setFirst] = useState<number | null>(null);
  const [coin, setCoin] = useState<{ a: number; b: number } | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [base, setBase] = useState<Team[]>([]);

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const shells = useMemo(() => emptyTeams(teamCount), [teamCount]);

  const toggleCaptain = (id: string) =>
    setCaptains((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < teamCount ? [...c, id] : c));

  const randomCaptains = () => {
    const pool = entries.filter((e) => !e.gk);
    const src = pool.length >= teamCount ? pool : entries;
    setCaptains(shuffle(src).slice(0, teamCount).map((e) => e.id));
  };

  const startCoin = () => {
    // Times-base: capitão + (opcional) um goleiro sorteado para quem ainda não tem
    const teams = shells.map((t, i) => ({ ...t, playerIds: [captains[i]] }));
    if (separateGk) {
      const freeGks = shuffle(entries.filter((e) => e.gk && !captains.includes(e.id)));
      for (const t of teams) {
        const hasGk = t.playerIds.some((id) => byId.get(id)?.gk);
        if (!hasGk && freeGks.length) t.playerIds.push(freeGks.shift()!.id);
      }
    }
    setBase(teams);
    setFirst(null);
    setCoin(null);
    setPicks([]);
    setPhase("coin");
  };

  const taken = new Set(base.flatMap((t) => t.playerIds));
  const pool = entries.filter((e) => !taken.has(e.id));
  const order = first === null ? [] : draftOrder(teamCount, pool.length, first, snake);
  const remaining = pool.filter((e) => !picks.includes(e.id));
  const turn = order[picks.length];

  const teamsNow: Team[] = base.map((t, i) => ({
    ...t,
    playerIds: [...t.playerIds, ...picks.filter((_, k) => order[k] === i)],
  }));

  const pick = (id: string) => {
    const next = [...picks, id];
    setPicks(next);
    if (next.length >= pool.length) {
      onDone(base.map((t, i) => ({ ...t, playerIds: [...t.playerIds, ...next.filter((_, k) => order[k] === i)] })));
    }
  };

  const capName = (i: number) => byId.get(captains[i])?.name ?? `Capitão ${i + 1}`;

  if (phase === "captains") {
    return (
      <div className="stack">
        <div className="card">
          <div className="section-head">
            <h2>Escolha {teamCount} capitães</h2>
            <span className="muted">
              {captains.length}/{teamCount}
            </span>
          </div>
          <ul className="players">
            {entries.map((e) => {
              const idx = captains.indexOf(e.id);
              return (
                <li key={e.id}>
                  <button type="button" className={`player${idx >= 0 ? " selected" : ""}`} aria-pressed={idx >= 0} onClick={() => toggleCaptain(e.id)}>
                    {idx >= 0 && <span className="cap-badge">C{idx + 1}</span>}
                    {e.gk && <span aria-label="goleiro">🧤</span>}
                    {e.name}
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="setting check">
            <div>
              <strong>Goleiros separados</strong>
              <small className="muted">Cada time recebe um goleiro sorteado antes do draft</small>
            </div>
            <input type="checkbox" checked={separateGk} onChange={(e) => setSeparateGk(e.target.checked)} />
          </label>
          <label className="setting check">
            <div>
              <strong>Ordem serpentina</strong>
              <small className="muted">1-2, 2-1, 1-2… quem escolhe por último na rodada começa a próxima</small>
            </div>
            <input type="checkbox" checked={snake} onChange={(e) => setSnake(e.target.checked)} />
          </label>
          <div className="row">
            <button type="button" className="btn" onClick={randomCaptains}>
              🎲 Sortear capitães
            </button>
            <button type="button" className="btn primary" disabled={captains.length !== teamCount} onClick={startCoin}>
              Continuar
            </button>
          </div>
        </div>
        <button type="button" className="btn ghost block" onClick={onCancel}>
          Cancelar draft
        </button>
      </div>
    );
  }

  if (phase === "coin") {
    const play = () => {
      if (teamCount === 2) {
        const a = Math.floor(Math.random() * 6);
        const b = Math.floor(Math.random() * 6);
        setCoin({ a, b });
        setFirst((a + b) % 2 === 0 ? 0 : 1);
      } else {
        setFirst(Math.floor(Math.random() * teamCount));
      }
    };
    return (
      <div className="card coin">
        <h2>{teamCount === 2 ? "Par ou ímpar" : "Quem começa?"}</h2>
        {teamCount === 2 ? (
          <p className="muted">
            <strong>{capName(0)}</strong> é PAR · <strong>{capName(1)}</strong> é ÍMPAR
          </p>
        ) : (
          <p className="muted">Sorteio da ordem de escolha entre os capitães.</p>
        )}

        {first !== null && (
          <div className="coin-result" key={`${coin?.a}-${coin?.b}-${first}`}>
            {coin && (
              <div className="hands" aria-label={`${coin.a} mais ${coin.b} é ${coin.a + coin.b}`}>
                <span>{coin.a}</span>+<span>{coin.b}</span>=<strong>{coin.a + coin.b}</strong>
                <em>{(coin.a + coin.b) % 2 === 0 ? "PAR" : "ÍMPAR"}</em>
              </div>
            )}
            <p>
              <strong>{capName(first)}</strong> escolhe primeiro!
            </p>
          </div>
        )}

        <div className="row center">
          <button type="button" className={`btn${first === null ? " primary" : ""}`} onClick={play}>
            {first === null ? (teamCount === 2 ? "Jogar par ou ímpar" : "Sortear") : "Jogar de novo"}
          </button>
          {first !== null && (
            <button type="button" className="btn primary" onClick={() => (pool.length ? setPhase("picking") : onDone(base))}>
              Começar escolhas
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="turn-banner" aria-live="polite">
        {turn !== undefined ? (
          <>
            <Swatch color={teamsNow[turn].color} />
            <span>
              Vez de <strong>{capName(turn)}</strong> ({teamsNow[turn].name})
            </span>
            <span className="muted">{remaining.length} restantes</span>
          </>
        ) : (
          <span>Finalizando…</span>
        )}
      </div>

      <div className="card">
        <h3>Disponíveis</h3>
        <ul className="players">
          {remaining.map((e) => (
            <li key={e.id}>
              <button type="button" className="player pickable" onClick={() => pick(e.id)}>
                {e.gk && <span aria-label="goleiro">🧤</span>}
                {e.name}
              </button>
            </li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="btn sm" disabled={!picks.length} onClick={() => setPicks((p) => p.slice(0, -1))}>
            ↶ Desfazer
          </button>
          <button type="button" className="btn sm ghost" onClick={onCancel}>
            Cancelar draft
          </button>
        </div>
      </div>

      <div className="teams">
        {teamsNow.map((t, i) => (
          <article key={t.id} className={`team${i === turn ? " on-turn" : ""}`}>
            <header>
              <Swatch color={t.color} />
              <strong className="team-name">{t.name}</strong>
              <span className="muted">{t.playerIds.length}</span>
            </header>
            <ul className="players">
              {t.playerIds.map((id) => {
                const e = byId.get(id);
                if (!e) return null;
                return (
                  <li key={id}>
                    <span className="player static">
                      {id === captains[i] && <span className="cap-badge">C</span>}
                      {e.gk && <span aria-label="goleiro">🧤</span>}
                      {e.name}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
