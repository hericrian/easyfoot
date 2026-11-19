import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useStore } from "../app/store";
import { computeRanking } from "../lib/ranking";
import { validateDB } from "../lib/store";
import { Empty } from "../components/ui";
import { IconDownload, IconTrophy } from "../components/icons";
import { todayISO } from "../lib/util";
import { groupBySlot } from "../lib/slots";

type Sort = "pct" | "wins" | "goals" | "assists" | "games";

export function Ranking({ slot }: { slot?: string }) {
  const { db, setDb, toast } = useStore();
  const [sort, setSort] = useState<Sort>("pct");
  const fileRef = useRef<HTMLInputElement>(null);

  // Rankings por horário fixo (dia da semana + início + fim). "Geral" soma tudo.
  const slots = useMemo(() => groupBySlot(db.matches.filter((m) => m.games.length > 0)), [db.matches]);
  const current = slots.find((s) => s.key === slot) ?? null;
  const scope = current ? current.matches : db.matches;

  const rows = useMemo(() => {
    const r = computeRanking(scope);
    if (sort === "pct") return r;
    return [...r].sort((a, b) => b[sort] - a[sort] || b.pct - a.pct || a.name.localeCompare(b.name));
  }, [scope, sort]);

  const totalGames = scope.reduce((n, m) => n + m.games.length, 0);

  const exportBackup = () => {
    try {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `easyfoot-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Backup baixado.");
    } catch {
      toast("Não foi possível gerar o backup.");
    }
  };

  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = validateDB(JSON.parse(await file.text()));
      if (!data) throw new Error("inválido");
      const known = new Set(db.matches.map((m) => m.id));
      const added = data.matches.filter((m) => !known.has(m.id));
      setDb((d) => ({ ...d, matches: [...d.matches, ...added] }));
      toast(added.length ? `${added.length} partida(s) importada(s).` : "Nenhuma partida nova no arquivo.");
    } catch {
      toast("Arquivo de backup inválido.");
    }
  };

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">{current ? current.label : "Todas as partidas"}</p>
          <h1>Ranking</h1>
        </div>
        <span className="muted">
          {totalGames} {totalGames === 1 ? "jogo" : "jogos"}
        </span>
      </div>

      {slots.length > 0 && (
        <nav className="slot-chips" aria-label="Ranking por horário">
          <a className="chip-btn" role="radio" aria-checked={!current} href="#/ranking" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            Geral
          </a>
          {slots.map((s) => (
            <a
              key={s.key}
              className="chip-btn"
              role="radio"
              aria-checked={current?.key === s.key}
              href={`#/ranking/${s.key}`}
              style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
            >
              {s.short}
              <small>{s.matches.length}</small>
            </a>
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        <Empty icon={<IconTrophy size={40} />} title="Ranking vazio">
          <p className="muted">Registre o resultado de um jogo e o ranking aparece aqui.</p>
          <a className="btn primary" href="#/nova">
            Criar partida
          </a>
        </Empty>
      ) : (
        <>
          <div className="segmented" role="tablist" aria-label="Ordenar por">
            {(
              [
                ["pct", "Aprov."],
                ["wins", "Vitórias"],
                ["goals", "Gols"],
                ["assists", "Assist."],
                ["games", "Jogos"],
              ] as [Sort, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={sort === k} onClick={() => setSort(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="table-wrap">
            <table className="rank">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col" className="left">
                    Jogador
                  </th>
                  <th scope="col" title="Jogos">
                    J
                  </th>
                  <th scope="col" title="Vitórias">
                    V
                  </th>
                  <th scope="col" title="Empates">
                    E
                  </th>
                  <th scope="col" title="Derrotas">
                    D
                  </th>
                  <th scope="col" title="Gols">
                    G
                  </th>
                  <th scope="col" title="Assistências">
                    A
                  </th>
                  <th scope="col" title="Aproveitamento">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="pos">
                      <span className={`pos-badge p${i + 1}`}>{i + 1}</span>
                    </td>
                    <td className="left name">{r.name}</td>
                    <td>{r.games}</td>
                    <td>{r.wins}</td>
                    <td>{r.draws}</td>
                    <td>{r.losses}</td>
                    <td>{r.goals}</td>
                    <td>{r.assists}</td>
                    <td className="strong">{Math.round(r.pct * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Aproveitamento = pontos ganhos (vitória 3, empate 1) ÷ pontos possíveis.</p>
        </>
      )}

      <div className="backup group">
        <h2 className="group-title">Backup</h2>
        <p className="muted">Os dados ficam salvos neste aparelho. Exporte para guardar ou passar para outro celular.</p>
        <div className="row">
          <button type="button" className="btn" onClick={exportBackup} disabled={!db.matches.length}>
            <IconDownload size={18} /> Exportar backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Importar backup
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        </div>
      </div>
    </section>
  );
}
