import { useEffect, useRef, useState } from "react";
import { go, useStore } from "../../app/store";
import type { GoalEvent, LiveGame, Match } from "../../types";
import { clock, elapsedMs, goalLimitReached, isRunning, liveScore, minuteOf, pause, remainingMs, start, toGame } from "../../lib/live";
import { inkOn, nextPairing, sideFrom, teamSurface } from "../../lib/games";
import { keepAwake, primeAudio, subChime, vibrate, whistle } from "../../lib/feedback";
import { uid } from "../../lib/util";
import { Empty, Sheet } from "../../components/ui";
import { IconFlag, IconPause, IconPlay, IconPlus, IconUndo, IconWhistle } from "../../components/icons";

/** Minutos. 60 = o horário inteiro da quadra, que é o padrão. */
const DURATIONS = [10, 15, 20, 30, 60];
const DEFAULT_DURATION = 60;
const LIMITS = [0, 1, 2, 3];
/** Lembrete de substituição (minutos). 0 = não lembrar. */
const SUB_OPTIONS = [0, 5, 10, 15, 20];
const PREF = "easyfoot:live-prefs";

function loadPrefs(): { limit: number; sub: number } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF) || "{}");
    return { limit: Number.isFinite(p.limit) ? p.limit : 0, sub: SUB_OPTIONS.includes(p.sub) ? p.sub : 0 };
  } catch {
    return { limit: 0, sub: 0 };
  }
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    // setInterval (e não requestAnimationFrame): continua disparando com a aba em
    // segundo plano, então apito e lembrete de troca tocam mesmo fora da tela.
    // ~4 atualizações/s bastam para mm:ss e economizam bateria.
    const id = window.setInterval(() => setNow(Date.now()), 250);
    const onVis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active]);
  return now;
}

export function LiveTab({ match }: { match: Match }) {
  const { updateMatch, toast } = useStore();
  const live = match.live ?? null;

  if (match.teams.length < 2) {
    return (
      <Empty icon={<IconWhistle size={40} />} title="Monte os times primeiro">
        <p className="muted">Com os times prontos, o cronômetro e o placar ao vivo ficam aqui.</p>
        <a className="btn primary" href={`#/partida/${match.id}/times`}>
          Ir para os times
        </a>
      </Empty>
    );
  }

  const setLive = (fn: (l: LiveGame | null) => LiveGame | null) => updateMatch(match.id, (m) => ({ ...m, live: fn(m.live ?? null) }));

  return live ? (
    <Scoreboard match={match} live={live} setLive={setLive} toast={toast} />
  ) : (
    <Setup
      match={match}
      onStart={(l) => {
        primeAudio();
        whistle("short");
        vibrate(30);
        setLive(() => l);
      }}
    />
  );
}

function Setup({ match, onStart }: { match: Match; onStart: (l: LiveGame) => void }) {
  const [pa, pb] = nextPairing(match);
  const [aId, setA] = useState(pa.id);
  const [bId, setB] = useState(pb.id);
  const prefs = loadPrefs();
  const [dur, setDur] = useState(DEFAULT_DURATION);
  const [custom, setCustom] = useState(false);
  const [customMin, setCustomMin] = useState("25");
  const [limit, setLimit] = useState(prefs.limit);
  const [sub, setSub] = useState(prefs.sub);
  const a = match.teams.find((t) => t.id === aId) ?? pa;
  const b = match.teams.find((t) => t.id === bId) ?? pb;
  const same = a.id === b.id;
  const minutes = custom ? Number(customMin) : dur;
  const invalid = custom && (!Number.isInteger(minutes) || minutes < 1 || minutes > 180);

  const begin = () => {
    try {
      localStorage.setItem(PREF, JSON.stringify({ limit, sub }));
    } catch {
      /* ignore */
    }
    onStart({
      id: uid(),
      createdAt: Date.now(),
      a: sideFrom(a, match),
      b: sideFrom(b, match),
      durationSec: minutes * 60,
      goalLimit: limit,
      subEveryMin: sub,
      subAlerts: 0,
      elapsedMs: 0,
      runningSince: Date.now(),
      events: [],
    });
  };

  return (
    <div className="stack">
      <section className="group">
        <h2 className="group-title">Confronto</h2>
        <div className="versus">
          <TeamSelect value={aId} onChange={setA} match={match} label="Time da esquerda" />
          <span className="vs">x</span>
          <TeamSelect value={bId} onChange={setB} match={match} label="Time da direita" />
        </div>
        {match.games.length > 0 && match.teams.length > 2 && <p className="footnote">Sugestão "ganhou fica": vencedor do último jogo contra o próximo da fila.</p>}
      </section>

      <section className="group">
        <h2 className="group-title">Tempo de jogo</h2>
        <div className="chips" role="radiogroup" aria-label="Tempo de jogo">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={!custom && dur === d}
              className="chip-btn"
              onClick={() => {
                setCustom(false);
                setDur(d);
              }}
            >
              {d === 60 ? "1 hora" : `${d} min`}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={custom} className="chip-btn" onClick={() => setCustom(true)}>
            Personalizar
          </button>
        </div>
        {custom && (
          <label className="custom-duration">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              value={customMin}
              autoFocus
              onChange={(e) => setCustomMin(e.target.value.replace(/\D/g, "").slice(0, 3))}
              aria-label="Minutos de jogo"
            />
            <span>minutos</span>
          </label>
        )}
        <h2 className="group-title">Acaba antes com</h2>
        <div className="chips" role="radiogroup" aria-label="Limite de gols">
          {LIMITS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={limit === l} className="chip-btn" onClick={() => setLimit(l)}>
              {l ? `${l} ${l === 1 ? "gol" : "gols"}` : "Só o tempo"}
            </button>
          ))}
        </div>
        <h2 className="group-title">Lembrete de substituição</h2>
        <div className="chips" role="radiogroup" aria-label="Lembrete de substituição">
          {SUB_OPTIONS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={sub === s} className="chip-btn" onClick={() => setSub(s)}>
              {s ? `A cada ${s} min` : "Não lembrar"}
            </button>
          ))}
        </div>
        {sub > 0 && <p className="footnote">Toca um sinal diferente do apito e vibra para lembrar de trocar, assim todo mundo joga.</p>}
      </section>

      <button type="button" className="btn primary lg block" disabled={same || invalid} onClick={begin}>
        <IconWhistle /> {same ? "Escolha times diferentes" : invalid ? "Tempo entre 1 e 180 minutos" : "Começar jogo"}
      </button>
      <p className="footnote center">O cronômetro usa o relógio do aparelho: não atrasa com a tela bloqueada.</p>
    </div>
  );
}

function TeamSelect({ value, onChange, match, label }: { value: string; onChange: (v: string) => void; match: Match; label: string }) {
  const t = match.teams.find((x) => x.id === value);
  return (
    <label className="team-select" style={{ ["--team" as string]: t?.color ?? "#888", ["--team-ink" as string]: inkOn(t?.color ?? "#888888") }}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {match.teams.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Scoreboard({
  match,
  live,
  setLive,
  toast,
}: {
  match: Match;
  live: LiveGame;
  setLive: (fn: (l: LiveGame | null) => LiveGame | null) => void;
  toast: (t: string) => void;
}) {
  const { updateMatch } = useStore();
  const running = isRunning(live);
  const now = useNow(running);
  const elapsed = elapsedMs(live, now);
  const remaining = remainingMs(live, now);
  const [sa, sb] = liveScore(live);
  const [goalFor, setGoalFor] = useState<"a" | "b" | null>(null);
  const [scorer, setScorer] = useState<string | null | undefined>(undefined); // undefined = escolhendo autor
  const [confirmEnd, setConfirmEnd] = useState(false);
  const prevRemaining = useRef<number | null>(remaining);
  const timeUp = remaining !== null && remaining <= 0;
  const limitHit = goalLimitReached(live);

  // Tela acesa enquanto a bola rola
  useEffect(() => {
    void keepAwake(running);
    const onVis = () => {
      if (document.visibilityState === "visible" && running) void keepAwake(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [running]);
  useEffect(() => () => void keepAwake(false), []);

  // Apito no fim do tempo — só na virada para zero, nunca ao reabrir a tela já esgotada
  useEffect(() => {
    const prev = prevRemaining.current;
    if (prev !== null && remaining !== null && prev > 0 && remaining <= 0) {
      whistle("end");
      vibrate([400, 120, 400, 120, 600]);
      toast("Tempo esgotado!");
    }
    prevRemaining.current = remaining;
  }, [remaining, toast]);

  // Lembrete de substituição a cada N minutos de bola rolando (não toca depois do fim do tempo)
  const subMs = (live.subEveryMin ?? 0) * 60_000;
  const subDue = subMs ? Math.floor(elapsed / subMs) : 0;
  const [subBanner, setSubBanner] = useState(false);
  useEffect(() => {
    if (!subMs || timeUp || limitHit) return;
    if (subDue > (live.subAlerts ?? 0)) {
      setLive((l) => (l ? { ...l, subAlerts: subDue } : l));
      subChime();
      vibrate([250, 120, 250, 120, 250]);
      setSubBanner(true);
    }
  }, [subDue, subMs, timeUp, limitHit, live.subAlerts, setLive]);
  const nextSubIn = subMs ? subMs - (elapsed % subMs) : null;

  const toggle = () => {
    primeAudio();
    vibrate(15);
    setLive((l) => (l ? (isRunning(l) ? pause(l) : start(l)) : l));
  };

  const openGoal = (side: "a" | "b") => {
    primeAudio();
    setGoalFor(side);
    setScorer(undefined);
  };

  const addGoal = (side: "a" | "b", scorerId?: string, assistId?: string) => {
    const ev: GoalEvent = { id: uid(), side, at: elapsedMs(live), scorerId, assistId };
    let reached = false;
    setLive((l) => {
      if (!l) return l;
      const next = { ...l, events: [...l.events, ev] };
      reached = goalLimitReached(next) && !goalLimitReached(l);
      return reached ? pause(next) : next;
    });
    setGoalFor(null);
    vibrate([40, 60, 40]);
    const sideData = live[side];
    const who = scorerId ? sideData.players.find((p) => p.id === scorerId)?.name : null;
    toast(who ? `Gol de ${who}!` : `Gol do ${sideData.name}!`);
    setTimeout(() => {
      if (reached) {
        whistle("end");
        toast(`${live.goalLimit} ${live.goalLimit === 1 ? "gol" : "gols"}: fim de jogo. Encerre para salvar.`);
      }
    }, 0);
  };

  const undo = () => {
    setLive((l) => (l && l.events.length ? { ...l, events: l.events.slice(0, -1) } : l));
    vibrate(15);
  };

  const finish = () => {
    const game = toGame(live);
    updateMatch(match.id, (m) => ({ ...m, games: [...m.games, game], live: null }));
    void keepAwake(false);
    whistle("end");
    toast(`${game.a.name} ${sa} x ${sb} ${game.b.name} — salvo.`);
    go(`/partida/${match.id}/jogos`);
  };

  const discard = () => {
    if (!window.confirm("Descartar este jogo? O placar não será salvo.")) return;
    updateMatch(match.id, (m) => ({ ...m, live: null }));
    void keepAwake(false);
  };

  const pct = live.durationSec ? Math.min(1, elapsed / (live.durationSec * 1000)) : 0;
  const nameOf = (id?: string) => (id ? [...live.a.players, ...live.b.players].find((p) => p.id === id)?.name : undefined);
  const goalSide = goalFor ? live[goalFor] : null;

  return (
    <div className="stack">
      {subBanner && (
        <div className="sub-banner" role="alert">
          <span className="sub-arrows" aria-hidden>
            ⇅
          </span>
          <div>
            <strong>Hora de substituir!</strong>
            <span>Troque quem está de fora para todo mundo jogar.</span>
          </div>
          <button type="button" className="btn sm" onClick={() => setSubBanner(false)}>
            Feito
          </button>
        </div>
      )}
      <section className={`scoreboard${running ? " is-running" : ""}${timeUp || limitHit ? " is-over" : ""}`} aria-label="Placar ao vivo">
        <div className="sb-status">
          <span className="live-pill">
            <span className="dot" aria-hidden />
            {timeUp || limitHit ? "Fim de jogo" : running ? "Ao vivo" : "Pausado"}
          </span>
          <span className="sb-rule">
            {[live.goalLimit > 0 ? `até ${live.goalLimit} ${live.goalLimit === 1 ? "gol" : "gols"}` : "", nextSubIn !== null && !timeUp ? `troca em ${clock(nextSubIn)}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>

        <div className="sb-main">
          <div className="sb-team">
            <span className="sb-color" style={{ background: teamSurface(live.a.color) }} />
            <span className="sb-name">{live.a.name}</span>
          </div>
          <div className="sb-score" aria-live="polite">
            <span key={`a${sa}`} className="num">
              {sa}
            </span>
            <span className="sep">:</span>
            <span key={`b${sb}`} className="num">
              {sb}
            </span>
          </div>
          <div className="sb-team">
            <span className="sb-color" style={{ background: teamSurface(live.b.color) }} />
            <span className="sb-name">{live.b.name}</span>
          </div>
        </div>

        <div className={`sb-clock${timeUp ? " over" : ""}`} role="timer" aria-label="Cronômetro">
          {remaining === null ? clock(elapsed) : clock(remaining, true)}
        </div>
        {live.durationSec > 0 && (
          <div className="sb-progress" aria-hidden>
            <div style={{ transform: `scaleX(${pct})` }} />
          </div>
        )}

        <div className="sb-controls">
          <button type="button" className="goal-btn" onClick={() => openGoal("a")} style={{ ["--team" as string]: teamSurface(live.a.color), ["--team-ink" as string]: inkOn(teamSurface(live.a.color)) }}>
            <IconPlus size={20} /> Gol
          </button>
          <button type="button" className="play-btn" onClick={toggle} aria-label={running ? "Pausar cronômetro" : "Iniciar cronômetro"}>
            {running ? <IconPause size={30} /> : <IconPlay size={30} />}
          </button>
          <button type="button" className="goal-btn" onClick={() => openGoal("b")} style={{ ["--team" as string]: teamSurface(live.b.color), ["--team-ink" as string]: inkOn(teamSurface(live.b.color)) }}>
            <IconPlus size={20} /> Gol
          </button>
        </div>
      </section>

      <section className="group">
        <div className="group-head">
          <h2 className="group-title">Lances</h2>
          {live.events.length > 0 && (
            <button type="button" className="text-btn" onClick={undo}>
              <IconUndo size={18} /> Desfazer último
            </button>
          )}
        </div>
        {live.events.length === 0 ? (
          <p className="footnote">Toque em "Gol" do time que marcou. Dá para indicar autor e assistência.</p>
        ) : (
          <ol className="timeline">
            {[...live.events].reverse().map((e) => (
              <li key={e.id}>
                <span className="min">{minuteOf(e.at)}</span>
                <span className="swatch" style={{ background: live[e.side].color }} aria-hidden />
                <span className="what">
                  <strong>{nameOf(e.scorerId) ?? "Gol contra / sem autor"}</strong>
                  {e.assistId && <span className="muted"> · assist. {nameOf(e.assistId)}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <button type="button" className={`btn lg block${timeUp || limitHit ? " primary" : ""}`} onClick={() => setConfirmEnd(true)}>
        <IconFlag /> Encerrar jogo
      </button>
      <button type="button" className="btn danger-text block" onClick={discard}>
        Descartar jogo
      </button>

      <Sheet open={!!goalFor} onClose={() => setGoalFor(null)} title={goalSide ? (scorer === undefined ? `Gol do ${goalSide.name}` : "Teve assistência?") : ""}>
        {goalFor && goalSide && (
          <div className="pick-grid">
            {scorer === undefined ? (
              <>
                {goalSide.players.map((p) => (
                  <button key={p.id} type="button" className="pick" onClick={() => setScorer(p.id)}>
                    {p.name}
                  </button>
                ))}
                <button type="button" className="pick subtle" onClick={() => addGoal(goalFor)}>
                  Gol contra / sem autor
                </button>
              </>
            ) : (
              <>
                {goalSide.players
                  .filter((p) => p.id !== scorer)
                  .map((p) => (
                    <button key={p.id} type="button" className="pick" onClick={() => addGoal(goalFor, scorer ?? undefined, p.id)}>
                      {p.name}
                    </button>
                  ))}
                <button type="button" className="pick strong" onClick={() => addGoal(goalFor, scorer ?? undefined)}>
                  Sem assistência
                </button>
              </>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} title="Encerrar jogo?">
        <div className="end-summary">
          <span>{live.a.name}</span>
          <strong>
            {sa} x {sb}
          </strong>
          <span>{live.b.name}</span>
        </div>
        <p className="footnote center">Tempo jogado: {clock(elapsed)}. O resultado entra na classificação e no ranking.</p>
        <button type="button" className="btn primary lg block" onClick={finish}>
          Salvar resultado
        </button>
        <button type="button" className="btn block" onClick={() => setConfirmEnd(false)}>
          Continuar jogando
        </button>
      </Sheet>
    </div>
  );
}
