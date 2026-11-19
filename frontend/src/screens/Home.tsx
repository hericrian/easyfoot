import { go, useStore } from "../app/store";
import { formatDate, plural } from "../lib/util";
import { gameScore } from "../lib/ranking";
import { liveScore } from "../lib/live";
import { InstallApp } from "../components/InstallApp";
import { IconCamera, IconChevronRight, IconShuffle, IconWhistle } from "../components/icons";

export function Home() {
  const { db } = useStore();
  const matches = [...db.matches].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time) || b.createdAt - a.createdAt);
  const live = matches.filter((m) => m.live);

  return (
    <>
      <section className="hero">
        <img className="hero-logo" src="/assets/easyfoot-logo.svg" alt="EasyFoot" width={289} height={179} />
        <p className="hero-tag">Da lista do grupo ao apito final.</p>
        <div className="hero-actions">
          <a className="btn hero-primary lg" href="#/nova">
            Nova partida
          </a>
          <a className="btn hero-secondary lg" href="#/ranking">
            Ranking
          </a>
        </div>
      </section>

      {live.map((m) => (
        <a key={m.id} className="live-card" href={`#/partida/${m.id}/ao-vivo`}>
          <span className="live-pill">
            <span className="dot" aria-hidden /> {m.live!.runningSince ? "Ao vivo" : "Pausado"}
          </span>
          <strong>
            {m.live!.a.name} {liveScore(m.live!).join(" x ")} {m.live!.b.name}
          </strong>
          <IconChevronRight size={18} />
        </a>
      ))}

      <InstallApp />

      {matches.length === 0 ? (
        <section className="group how">
          <h2 className="group-title">Como funciona</h2>
          <ol className="list inset steps">
            <li className="row-item">
              <span className="step-icon">
                <IconCamera size={20} />
              </span>
              <span className="grow">
                <strong>Cole a lista ou envie o print</strong>
                <small>Nomes, goleiros e reservas reconhecidos sozinhos.</small>
              </span>
            </li>
            <li className="row-item">
              <span className="step-icon">
                <IconShuffle size={20} />
              </span>
              <span className="grow">
                <strong>Sorteie ou faça o draft</strong>
                <small>Times equilibrados, um goleiro em cada.</small>
              </span>
            </li>
            <li className="row-item">
              <span className="step-icon">
                <IconWhistle size={20} />
              </span>
              <span className="grow">
                <strong>Jogue com cronômetro e placar</strong>
                <small>Gols, assistências e ranking automáticos.</small>
              </span>
            </li>
          </ol>
        </section>
      ) : (
        <section className="group">
          <div className="group-head">
            <h2 className="group-title">Partidas</h2>
            <span className="footnote">{plural(matches.length, "partida", "partidas")}</span>
          </div>
          <ul className="list inset">
            {matches.map((m) => {
              const active = m.entries.filter((e) => !e.reserve).length;
              const last = m.games[m.games.length - 1];
              return (
                <li key={m.id}>
                  <button type="button" className="row-item tappable" onClick={() => go(`/partida/${m.id}`)}>
                    <span className="grow">
                      <strong>
                        {m.title || "Pelada"}
                        {m.live && <span className="live-dot static inline" aria-label="ao vivo" />}
                      </strong>
                      <small>
                        {[formatDate(m.date, m.time), m.location].filter(Boolean).join(" · ") || "Sem data"} · {plural(active, "jogador", "jogadores")}
                        {m.games.length > 0 && ` · ${plural(m.games.length, "jogo", "jogos")}`}
                      </small>
                    </span>
                    {last && (
                      <span className="mini-score">
                        <span className="swatch" style={{ background: last.a.color }} />
                        {gameScore(last).join("–")}
                        <span className="swatch" style={{ background: last.b.color }} />
                      </span>
                    )}
                    <IconChevronRight size={18} className="chev" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
