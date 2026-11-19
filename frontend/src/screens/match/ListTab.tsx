import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { go, useStore } from "../../app/store";
import type { Entry, Match } from "../../types";
import { parseList } from "../../lib/parser";
import { nameKey, plural, uid } from "../../lib/util";
import { IconBench, IconCamera, IconGlove, IconPlus, IconShirt, IconX } from "../../components/icons";

const PLACEHOLDER = `Cole aqui a lista do grupo, por exemplo:

⚽ Pelada quinta 20h
1. Carlos 🧤
2. João
3. Pedro
4. Marcos
Reservas:
1. Lucas`;

export function ListTab({ match }: { match: Match }) {
  const { updateMatch, toast } = useStore();
  const [text, setText] = useState("");
  const [ocr, setOcr] = useState<{ p: number; label: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newGk, setNewGk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = match.entries.filter((e) => !e.reserve);
  const reserves = match.entries.filter((e) => e.reserve);
  const gkCount = active.filter((e) => e.gk).length;

  const setEntries = (fn: (list: Entry[]) => Entry[]) =>
    updateMatch(match.id, (m) => {
      const entries = fn(m.entries);
      const ids = new Set(entries.map((e) => e.id));
      return { ...m, entries, teams: m.teams.map((t) => ({ ...t, playerIds: t.playerIds.filter((p) => ids.has(p)) })) };
    });

  const importText = (replace: boolean) => {
    const parsed = parseList(text);
    if (!parsed.length) {
      toast("Não encontrei nomes nesse texto. Confira a lista ou adicione manualmente.");
      return;
    }
    const base = replace ? [] : match.entries;
    const known = new Set(base.map((e) => nameKey(e.name)));
    const fresh: Entry[] = [];
    for (const p of parsed) {
      const k = nameKey(p.name);
      if (known.has(k)) continue;
      known.add(k);
      fresh.push({ id: uid(), ...p });
    }
    updateMatch(match.id, (m) => ({ ...m, entries: [...base, ...fresh], teams: replace ? [] : m.teams }));
    const gks = fresh.filter((p) => p.gk).length;
    setText("");
    toast(
      fresh.length
        ? `${plural(fresh.length, "jogador adicionado", "jogadores adicionados")}${gks ? ` · ${plural(gks, "goleiro", "goleiros")}` : ""}. Revise abaixo.`
        : "Todos esses nomes já estavam na lista.",
    );
  };

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    setOcr({ p: 0, label: "Iniciando…" });
    try {
      const { ocrImages } = await import("../../lib/ocr");
      const out = await ocrImages(files, (p, label) => setOcr({ p, label }));
      if (!out.trim()) {
        toast("Não consegui ler texto na imagem. Tente um print mais nítido ou cole a lista.");
      } else {
        setText((t) => (t.trim() ? `${t.trim()}\n${out}` : out));
        toast("Texto extraído. Confira e toque em “Ler lista”.");
      }
    } catch (err) {
      console.error(err);
      toast(navigator.onLine ? "Falha ao ler a imagem. Tente de novo ou cole a lista." : "Sem internet: o leitor de imagem precisa baixar na primeira vez.");
    } finally {
      setOcr(null);
    }
  };

  const addOne = (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (match.entries.some((x) => nameKey(x.name) === nameKey(name))) {
      toast(`${name} já está na lista.`);
      return;
    }
    setEntries((list) => [...list, { id: uid(), name, gk: newGk, reserve: false }]);
    setNewName("");
    setNewGk(false);
  };

  const patch = (id: string, p: Partial<Entry>) => setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const remove = (id: string) => setEntries((list) => list.filter((e) => e.id !== id));

  const row = (e: Entry) => (
    <li key={e.id} className={`entry${e.gk ? " is-gk" : ""}`}>
      <button
        type="button"
        className="toggle gk"
        aria-pressed={e.gk}
        aria-label={e.gk ? `${e.name} é goleiro. Tocar para tornar jogador de linha` : `Marcar ${e.name} como goleiro`}
        title="Goleiro"
        onClick={() => patch(e.id, { gk: !e.gk })}
      >
        <IconGlove size={19} />
      </button>
      <input
        aria-label="Nome do jogador"
        value={e.name}
        maxLength={40}
        onChange={(ev) => patch(e.id, { name: ev.target.value })}
        onBlur={(ev) => {
          const v = ev.target.value.trim();
          if (!v) remove(e.id);
          else if (v !== e.name) patch(e.id, { name: v });
        }}
      />
      <button
        type="button"
        className="toggle res"
        aria-pressed={e.reserve}
        title={e.reserve ? "Mover para confirmados" : "Mover para reservas"}
        onClick={() => patch(e.id, { reserve: !e.reserve })}
      >
        <IconBench size={18} />
      </button>
      <button type="button" className="toggle del" aria-label={`Remover ${e.name}`} onClick={() => remove(e.id)}>
        <IconX size={16} />
      </button>
    </li>
  );

  return (
    <div className="stack">
      <div className="card">
        <h2>Importar lista</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={text ? Math.min(14, Math.max(6, text.split("\n").length + 1)) : 7}
          aria-label="Lista do WhatsApp"
        />
        {ocr && (
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ocr.p * 100)}>
            <div className="bar" style={{ transform: `scaleX(${Math.max(0.03, ocr.p)})` }} />
            <span>{ocr.label}</span>
          </div>
        )}
        <div className="row">
          <button type="button" className="btn primary" disabled={!text.trim()} onClick={() => importText(false)}>
            Ler lista
          </button>
          <button type="button" className="btn" disabled={!!ocr} onClick={() => fileRef.current?.click()}>
            <IconCamera size={18} /> Enviar print
          </button>
          {match.entries.length > 0 && text.trim() && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                if (window.confirm("Substituir a lista atual (e os times) por esta?")) importText(true);
              }}
            >
              Substituir lista
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        </div>
        <p className="hint">O print é lido no próprio aparelho. Goleiros são reconhecidos por 🧤, 🥅, “goleiro”, “gol” ou pela seção “Goleiros:”.</p>
      </div>

      <div className="card">
        <div className="section-head">
          <h2>Confirmados</h2>
          <span className="muted">
            {active.length} · {plural(gkCount, "goleiro", "goleiros")}
          </span>
        </div>
        {active.length === 0 ? (
          <p className="muted">Ninguém ainda. Importe a lista acima ou adicione abaixo.</p>
        ) : (
          <ul className="entries">{active.map(row)}</ul>
        )}

        <form className="add-row" onSubmit={addOne}>
          <button type="button" className="toggle gk" aria-pressed={newGk} aria-label="Novo jogador é goleiro" onClick={() => setNewGk((v) => !v)}>
            <IconGlove size={19} />
          </button>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Adicionar jogador" maxLength={40} aria-label="Nome do novo jogador" />
          <button type="submit" className="btn primary sm" disabled={!newName.trim()} aria-label="Adicionar jogador">
            <IconPlus size={18} />
          </button>
        </form>

        {reserves.length > 0 && (
          <>
            <div className="section-head sub">
              <h3>Reservas</h3>
              <span className="muted">{reserves.length} · fora do sorteio</span>
            </div>
            <ul className="entries">{reserves.map(row)}</ul>
          </>
        )}
      </div>

      <button type="button" className="btn primary lg block sticky-cta" disabled={active.length < 2} onClick={() => go(`/partida/${match.id}/times`)}>
        <IconShirt size={20} />
        {active.length < 2 ? "Adicione pelo menos 2 jogadores" : `Montar times com ${active.length}`}
      </button>
    </div>
  );
}
