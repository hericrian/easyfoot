import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useStore } from "../app/store";
import { Avatar, GoogleButton, useAccount } from "../app/account";
import { Sheet } from "../components/ui";
import { ZoomViewer } from "../components/ZoomViewer";
import { IconCopy, IconExpand } from "../components/icons";
import { fetchReviews, postReview, timeAgo, type Review, type ReviewPage } from "../lib/reviews";
import { copyText } from "../lib/share";
import support from "../config/support.json";

const REVIEWED = "easyfoot:reviewed";

function Star({ fill, size = 16 }: { fill: number; size?: number }) {
  // fill: 0..1 (permite meia estrela no resumo)
  const id = `s${Math.round(fill * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="var(--star)" />
          <stop offset={`${fill * 100}%`} stopColor="var(--star-off)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2.6l2.85 5.95 6.5.82-4.78 4.5 1.2 6.46L12 17.2l-5.77 3.13 1.2-6.46-4.78-4.5 6.5-.82z"
      />
    </svg>
  );
}

export function Stars({ value, size }: { value: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value.toLocaleString("pt-BR")} de 5 estrelas`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} fill={Math.max(0, Math.min(1, value - i))} />
      ))}
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ["Muito ruim", "Ruim", "Ok", "Bom", "Excelente"];
  return (
    <div className="star-input" role="radiogroup" aria-label="Sua nota">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}: ${labels[n - 1]}`} onClick={() => onChange(n)}>
          <Star size={40} fill={value >= n ? 1 : 0} />
        </button>
      ))}
      <span className="star-label" aria-hidden>
        {value ? labels[value - 1] : "Toque para avaliar"}
      </span>
    </div>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

function avatarHue(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function Community({ focus }: { focus?: string }) {
  const { toast } = useStore();
  const { account, signIn } = useAccount();
  const [data, setData] = useState<ReviewPage | null>(null);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [honey, setHoney] = useState("");
  const [sending, setSending] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [reviewed, setReviewed] = useState(() => {
    try {
      return localStorage.getItem(REVIEWED) === "1";
    } catch {
      return false;
    }
  });

  const load = useCallback(async () => {
    try {
      setError(false);
      setData(await fetchReviews());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focus === "apoie") setTimeout(() => document.getElementById("apoie")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [focus]);

  const more = async () => {
    if (!data?.next) return;
    setLoadingMore(true);
    try {
      const page = await fetchReviews(data.next);
      setData({ ...page, reviews: [...data.reviews, ...page.reviews] });
    } catch {
      toast("Não foi possível carregar mais avaliações.");
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) {
      toast("Escolha de 1 a 5 estrelas.");
      return;
    }
    setSending(true);
    try {
      await postReview({ rating, comment: comment.trim(), website: honey });
      setWriting(false);
      setReviewed(true);
      try {
        localStorage.setItem(REVIEWED, "1");
      } catch {
        /* ignore */
      }
      setRating(0);
      setComment("");
      toast("Obrigado pela avaliação!");
      void load();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const copyPix = async () => {
    const r = await copyText(support.pix);
    toast(r === "copied" ? "Código Pix copiado. Cole no app do seu banco." : "Não foi possível copiar.");
  };

  const s = data?.summary;
  const max = s ? Math.max(1, ...s.counts) : 1;

  return (
    <section className="panel">
      <header className="page-head">
        <div>
          <p className="eyebrow">Comunidade</p>
          <h1>Avaliações</h1>
        </div>
      </header>

      <section className="rating-card" aria-label="Resumo das avaliações">
        {s ? (
          <>
            <div className="rating-big">
              <strong>{s.count ? s.avg.toLocaleString("pt-BR", { minimumFractionDigits: 1 }) : "–"}</strong>
              <Stars value={s.avg} size={18} />
              <span className="footnote">{s.count === 1 ? "1 avaliação" : `${s.count.toLocaleString("pt-BR")} avaliações`}</span>
            </div>
            <ol className="rating-bars" aria-label="Distribuição das notas">
              {[5, 4, 3, 2, 1].map((n) => (
                <li key={n}>
                  <span>{n}</span>
                  <span className="bar" aria-hidden>
                    <span style={{ transform: `scaleX(${s.counts[n - 1] / max})` }} />
                  </span>
                  <span className="sr-only">{s.counts[n - 1]} avaliações com {n} estrelas</span>
                </li>
              ))}
            </ol>
          </>
        ) : error ? (
          <div className="rating-empty">
            <p className="muted">Não foi possível carregar as avaliações.</p>
            <button type="button" className="btn sm" onClick={() => void load()}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <div className="rating-empty" aria-busy="true">
            <span className="skeleton" />
            <span className="skeleton short" />
          </div>
        )}
      </section>

      {account ? (
        <button type="button" className="btn primary lg block" onClick={() => setWriting(true)}>
          {reviewed ? "Editar minha avaliação" : "Avaliar o EasyFoot"}
        </button>
      ) : (
        <div className="signin-to-review">
          <p className="footnote center">Para avaliar, entre com sua conta Google — assim cada avaliação é de uma pessoa real.</p>
          <GoogleButton onClick={() => void signIn()} />
        </div>
      )}

      {data && data.reviews.length > 0 && (
        <ul className="reviews">
          {data.reviews.map((r: Review) => (
            <li key={r.id} className="review">
              <div className="review-head">
                {r.photo ? (
                  <img className="avatar photo" src={r.photo} alt="" width={38} height={38} referrerPolicy="no-referrer" loading="lazy" />
                ) : (
                  <span className="avatar" style={{ ["--h" as string]: avatarHue(r.name) }} aria-hidden>
                    {initials(r.name)}
                  </span>
                )}
                <div>
                  <strong>
                    {r.name}
                    {r.verified && (
                      <span className="verified" title="Conta Google verificada">
                        ✓ Conta Google
                      </span>
                    )}
                  </strong>
                  <span className="review-meta">
                    <Stars value={r.rating} size={13} /> <span className="footnote">{timeAgo(r.createdAt)}</span>
                  </span>
                </div>
              </div>
              {r.comment && <p className="review-text">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
      {data && data.reviews.length === 0 && <p className="footnote center">Ainda não há avaliações. Seja o primeiro!</p>}
      {data?.next && (
        <button type="button" className="btn ghost block" onClick={more} disabled={loadingMore}>
          {loadingMore ? "Carregando…" : "Ver mais avaliações"}
        </button>
      )}

      <section className="support" id="apoie" aria-labelledby="support-title">
        <div className="support-text">
          <p className="eyebrow">Pix</p>
          <h2 id="support-title">Pague o horário ou apoie o EasyFoot</h2>
          <p className="muted">Use este Pix para acertar o horário da quadra ou colaborar com o desenvolvimento do app. Qualquer valor ajuda a manter o EasyFoot gratuito e sem anúncios.</p>
        </div>
        <button type="button" className="qr-frame" onClick={() => setZoom(true)} aria-label="Abrir QR code do Pix em tela cheia">
          <img src="/assets/pix-qr.svg" alt="QR code do Pix" width={220} height={220} />
          <span className="qr-hint">
            <IconExpand size={15} /> Toque para ampliar
          </span>
        </button>
        <div className="support-actions">
          <button type="button" className="btn primary lg" onClick={copyPix}>
            <IconCopy /> Copiar código Pix
          </button>
          <button type="button" className="btn lg" onClick={() => setZoom(true)}>
            <IconExpand /> Ver em tela cheia
          </button>
        </div>
        <p className="footnote center">No app do banco: Pix → Ler QR code, ou Pix copia e cola.</p>
      </section>

      <ZoomViewer open={zoom} onClose={() => setZoom(false)} src="/assets/pix-qr.svg" alt="QR code do Pix do EasyFoot" download={{ href: "/assets/pix-qr.png", name: "easyfoot-pix.png" }} />

      <Sheet open={writing} onClose={() => setWriting(false)} title="Avaliar o EasyFoot">
        <form onSubmit={submit} className="review-form">
          <StarInput value={rating} onChange={setRating} />
          {account && (
            <div className="posting-as">
              <Avatar account={account} size={32} />
              <span>
                Publicando como <strong>{account.name}</strong>
              </span>
            </div>
          )}
          <label className="field">
            <span>Comentário (opcional)</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={600} rows={4} placeholder="O que achou? O que podemos melhorar?" />
          </label>
          <label className="honey" aria-hidden="true">
            Não preencha
            <input tabIndex={-1} autoComplete="off" value={honey} onChange={(e) => setHoney(e.target.value)} name="website" />
          </label>
          <p className="footnote">Sua avaliação fica pública com seu nome e foto do Google. Avaliar de novo substitui a anterior.</p>
          <button type="submit" className="btn primary lg block" disabled={sending || !rating}>
            {sending ? "Enviando…" : "Publicar avaliação"}
          </button>
        </form>
      </Sheet>
    </section>
  );
}
