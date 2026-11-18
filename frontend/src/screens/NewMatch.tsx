import { useState, type FormEvent } from "react";
import { go, useStore } from "../app/store";
import type { Match } from "../types";
import { todayISO, uid } from "../lib/util";

export function MatchInfoFields({
  value,
  onChange,
}: {
  value: Pick<Match, "title" | "location" | "date" | "time">;
  onChange: (v: Pick<Match, "title" | "location" | "date" | "time">) => void;
}) {
  return (
    <div className="form-grid">
      <label className="field span-2">
        <span>Nome</span>
        <input value={value.title} maxLength={60} onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder="Pelada de quinta" />
      </label>
      <label className="field span-2">
        <span>Local</span>
        <input
          value={value.location}
          maxLength={80}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          placeholder="Arena Society, quadra 2"
        />
      </label>
      <label className="field">
        <span>Data</span>
        <input type="date" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} />
      </label>
      <label className="field">
        <span>Horário</span>
        <input type="time" value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} />
      </label>
    </div>
  );
}

export function NewMatch() {
  const { setDb } = useStore();
  const [info, setInfo] = useState({ title: "Pelada", location: "", date: todayISO(), time: "20:00" });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m: Match = {
      id: uid(),
      ...info,
      title: info.title.trim() || "Pelada",
      location: info.location.trim(),
      createdAt: Date.now(),
      entries: [],
      teams: [],
      games: [],
    };
    setDb((d) => ({ ...d, matches: [m, ...d.matches] }));
    go(`/partida/${m.id}`);
  };

  return (
    <section className="panel narrow">
      <h1>Nova partida</h1>
      <p className="muted">Só o básico. Dá pra mudar depois.</p>
      <form onSubmit={submit}>
        <MatchInfoFields value={info} onChange={setInfo} />
        <button type="submit" className="btn primary lg block">
          Continuar para a lista →
        </button>
      </form>
    </section>
  );
}
