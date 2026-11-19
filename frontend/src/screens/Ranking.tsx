import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useStore } from "../app/store";
import { useAccount } from "../app/account";
import { computeRanking } from "../lib/ranking";
import { validateDB } from "../lib/store";
import { Empty } from "../components/ui";
import { IconDownload, IconTrophy } from "../components/icons";
import { todayISO } from "../lib/util";
import { groupBySlot } from "../lib/slots";
import { fetchShared, hasUnsyncedGames, type SharedGame, type SharedGroup } from "../lib/cloud";
import type { Match } from "../types";

type Sort = "pct" | "wins" | "goals" | "assists" | "games";
type Source = "online" | "local";

const chipStyle = { display: "inline-flex", alignItems: "center", textDecoration: "none" } as const;

export function Ranking({ slot }: { slot?: string }) {
  const { db, setDb, toast } = useStore();
  const { account, openAccount } = useAccount();
  const [sort, setSort] = useState<Sort>("pct");
  const [source, setSource] = useState<Source>("online");
  const [shared, setShared] = useState<{ groups: SharedGroup[]; games: SharedGame[] } | null>(null);
  const [sharedError, setSharedError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = slot ? decodeURIComponent(slot) : null;

  // Ranking compartilhado (banco D1): todos veem o mesmo, em qualquer aparelho
  useEffect(() => {
    let alive = true;
    fetchShared()
      .then((d) => alive && setShared(d))
      .catch(() => alive && setSharedError(true));
    return () => {
      alive = false;
    };
  }, []);
  const online = source === "online" && !sharedError;

  // Mantém o horário escolhido visível na fileira de chips
  useEffect(() => {
    document.querySelector('.slot-chips [aria-checked="true"]')?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [selected, shared, source]);

  // Local: horários fixos deste aparelho
  const slots = useMemo(() => groupBySlot(db.matches.filter((m) => m.games.length > 0)), [db.matches]);
  const localCurrent = slots.find((s) => s.key === selected) ?? null;
  const onlineCurrent = shared?.groups.find((g) => g.key === selected) ?? null;

  const scope: Match[] = useMemo(() => {
    if (online) {
      const games = (shared?.games ?? []).filter((g) => !onlineCurrent || g.grp === onlineCurrent.key);
      return [{ id: "shared", title: "", location: "", date: "", time: "", createdAt: 0, entries: [], teams: [], games }];
    }
    return localCurrent ? localCurrent.matches : db.matches;
  }, [online, shared, onlineCurrent, localCurrent, db.matches]);

  const rows = useMemo(() => {
    const r = computeRanking(scope);
    if (sort === "pct") return r;
    return [...r].sort((a, b) => b[sort] - a[sort] || b.pct - a.pct || a.name.localeCompare(b.name));
  }, [scope, sort]);

  const totalGames = scope.reduce((n, m) => n + m.games.length, 0);
  const label = online ? (onlineCurrent ? onlineCurrent.label : "Todas as peladas") : localCurrent ? localCurrent.label : "Partidas deste aparelho";
  const unsynced = !account && hasUnsyncedGames(db.matches);

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
          <p className="eyebrow">{label}</p>
          <h1>Ranking</h1>
        </div>
        <span className="muted">
          {totalGames} {totalGames === 1 ? "jogo" : "jogos"}
        </span>
      </div>

      <div className="segmented" role="tablist" aria-label="Origem do ranking">
        <button type="button" role="tab" aria-selected={online} onClick={() => setSource("online")} disabled={sharedError}>
          Online · todos
        </button>
        <button type="button" role="tab" aria-selected={!online} onClick={() => setSource("local")}>
          Neste aparelho
        </button>
      </div>
      {sharedError && <p className="hint warn">Sem conexão com o ranking online agora. Mostrando os jogos deste aparelho.</p>}
      {unsynced && (
        <div className="sync-hint">
          <span>Seus jogos ainda estão só neste aparelho. Entre com Google para eles entrarem no ranking online.</span>
          <button type="button" className="btn sm primary" onClick={openAccount}>
            Entrar
          </button>
        </div>
      )}

      {online ? (
        (shared?.groups.length ?? 0) > 0 && (
          <nav className="slot-chips" aria-label="Ranking por horário">
            <a className="chip-btn" role="radio" aria-checked={!onlineCurrent} href="#/ranking" style={chipStyle}>
              Geral
            </a>
            {shared!.groups.map((g) => (
              <a key={g.key} className="chip-btn" role="radio" aria-checked={onlineCurrent?.key === g.key} href={`#/ranking/${encodeURIComponent(g.key)}`} style={chipStyle}>
                {g.label}
                <small>{g.count}</small>
              </a>
            ))}
          </nav>
        )
      ) : (
        slots.length > 0 && (
          <nav className="slot-chips" aria-label="Ranking por horário">
            <a className="chip-btn" role="radio" aria-checked={!localCurrent} href="#/ranking" style={chipStyle}>
              Geral
            </a>
            {slots.map((s) => (
              <a key={s.key} className="chip-btn" role="radio" aria-checked={localCurrent?.key === s.key} href={`#/ranking/${s.key}`} style={chipStyle}>
                {s.short}
                <small>{s.matches.length}</small>
              </a>
            ))}
          </nav>
        )
      )}

      {rows.length === 0 ? (
        <Empty icon={<IconTrophy size={40} />} title="Ranking vazio">
          <p className="muted">{online && !shared ? "Carregando o ranking online…" : "Registre o resultado de um jogo e o ranking aparece aqui."}</p>
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
        <p className="muted">As partidas ficam salvas neste aparelho; os jogos de quem está logado também vão para o ranking online. Exporte para guardar ou passar para outro celular.</p>
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
