import { useState, type FormEvent } from "react";
import { go, useStore } from "../app/store";
import type { Match } from "../types";
import { todayISO, uid } from "../lib/util";
import { addMinutes, slotOf } from "../lib/slots";

function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  const d = (bh * 60 + bm - (ah * 60 + am) + 1440) % 1440;
  return d || 60;
}

export function MatchInfoFields({
  value,
  onChange,
}: {
  value: Pick<Match, "title" | "location" | "date" | "time" | "endTime">;
  onChange: (v: Pick<Match, "title" | "location" | "date" | "time" | "endTime">) => void;
}) {
  const slot = slotOf(value);
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
      <label className="field span-2">
        <span>Data</span>
        <input type="date" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} />
      </label>
      <label className="field">
        <span>Início</span>
        <input
          type="time"
          value={value.time}
          onChange={(e) => {
            const time = e.target.value;
            // mantém a duração ao mudar o início
            const dur = value.time && value.endTime ? minutesBetween(value.time, value.endTime) : 60;
            onChange({ ...value, time, endTime: time ? addMinutes(time, dur) : value.endTime });
          }}
        />
      </label>
      <label className="field">
        <span>Fim</span>
        <input type="time" value={value.endTime ?? ""} onChange={(e) => onChange({ ...value, endTime: e.target.value })} />
      </label>
      {slot && (
        <p className="footnote span-2">
          Ranking do horário: <strong>{slot.label}</strong>. Partidas no mesmo dia da semana e horário somam no mesmo ranking.
        </p>
      )}
    </div>
  );
}

export function NewMatch() {
  const { setDb } = useStore();
  const [info, setInfo] = useState<Pick<Match, "title" | "location" | "date" | "time" | "endTime">>({ title: "Pelada", location: "", date: todayISO(), time: "20:00", endTime: "21:00" });

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
