import { go, useStore } from "../app/store";
import { formatDate, plural } from "../lib/util";
import { gameScore } from "../lib/ranking";

export function Home() {
  const { db } = useStore();
  const matches = [...db.matches].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time) || b.createdAt - a.createdAt);

  return (
    <>
      <section className="hero">
        <img className="logo" src="/assets/easyfoot-logo.webp" alt="EasyFoot" width={1200} height={433} />
        <p>Cole a lista do grupo, revise, sorteie e jogue.</p>
        <div className="actions">
          <a className="btn primary lg" href="#/nova">
            Criar partida
          </a>
          <a className="btn ghost-dark lg" href="#/ranking">
            Ver ranking
          </a>
        </div>
      </section>

      {matches.length === 0 ? (
        <section className="features">
          <article>
            <span aria-hidden>📋</span>
            <h2>Lista fácil</h2>
            <p>Cole a lista do WhatsApp ou envie o print. Goleiros com 🧤 são reconhecidos automaticamente.</p>
          </article>
          <article>
            <span aria-hidden>🎲</span>
            <h2>Sorteio ou draft</h2>
            <p>Times equilibrados num toque, ou capitães escolhendo no par ou ímpar.</p>
          </article>
          <article>
            <span aria-hidden>🏆</span>
            <h2>Ranking</h2>
            <p>Jogos, vitórias, gols e aproveitamento calculados sozinhos.</p>
          </article>
        </section>
      ) : (
        <section className="section">
          <div className="section-head">
            <h2>Suas partidas</h2>
            <span className="muted">{plural(matches.length, "partida", "partidas")}</span>
          </div>
          <ul className="match-list">
            {matches.map((m) => {
              const active = m.entries.filter((e) => !e.reserve).length;
              const last = m.games[m.games.length - 1];
              return (
                <li key={m.id}>
                  <button type="button" className="match-card" onClick={() => go(`/partida/${m.id}`)}>
                    <div>
                      <strong>{m.title || "Pelada"}</strong>
                      <span className="muted">
                        {[formatDate(m.date, m.time), m.location].filter(Boolean).join(" · ") || "Sem data"}
                      </span>
                    </div>
                    <div className="match-meta">
                      <span className="chip">{plural(active, "jogador", "jogadores")}</span>
                      {m.teams.length > 0 && <span className="chip">{plural(m.teams.length, "time", "times")}</span>}
                      {last && (
                        <span className="chip dark">
                          {last.a.name.replace(/^Time /, "")} {gameScore(last).join(" x ")} {last.b.name.replace(/^Time /, "")}
                        </span>
                      )}
                    </div>
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
