import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { IconDownload, IconX } from "./icons";

/**
 * Visualizador de imagem em tela cheia: pinça para zoom, arrastar para mover,
 * duplo toque alterna 1x/2.5x, roda do mouse e botões +/−. Esc ou ✕ fecham.
 */
export function ZoomViewer({ open, onClose, src, alt, download }: { open: boolean; onClose: () => void; src: string; alt: string; download?: { href: string; name: string } }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setT({ s: 1, x: 0, y: 0 });
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const clamp = (s: number) => Math.min(6, Math.max(1, s));
  const zoomTo = (s: number) => setT((p) => (clamp(s) === 1 ? { s: 1, x: 0, y: 0 } : { ...p, s: clamp(s) }));

  const onDown = (e: RPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: t.s };
    } else {
      const now = Date.now();
      if (now - lastTap.current < 280) zoomTo(t.s > 1 ? 1 : 2.5);
      lastTap.current = now;
    }
  };
  const onMove = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const s = clamp((pinch.current.s * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d);
      setT((p) => ({ ...p, s }));
    } else if (pointers.current.size === 1 && t.s > 1) {
      setT((p) => ({ ...p, x: p.x + (cur.x - prev.x), y: p.y + (cur.y - prev.y) }));
    }
  };
  const onUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (t.s <= 1.02) setT({ s: 1, x: 0, y: 0 });
  };

  return (
    <dialog ref={ref} className="viewer" onClose={onClose} aria-label={alt}>
      {open && (
        <>
          <div
            className="viewer-stage"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onWheel={(e) => zoomTo(t.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              className={pointers.current.size ? "dragging" : undefined}
              style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})` }}
            />
          </div>
          <div className="viewer-bar">
            <button type="button" className="viewer-btn" aria-label="Diminuir zoom" onClick={() => zoomTo(t.s / 1.5)} disabled={t.s <= 1}>
              −
            </button>
            <span className="viewer-zoom">{Math.round(t.s * 100)}%</span>
            <button type="button" className="viewer-btn" aria-label="Aumentar zoom" onClick={() => zoomTo(t.s * 1.5)} disabled={t.s >= 6}>
              +
            </button>
            {download && (
              <a className="viewer-btn" href={download.href} download={download.name} aria-label="Baixar imagem">
                <IconDownload size={20} />
              </a>
            )}
          </div>
          <button type="button" className="viewer-close" aria-label="Fechar" onClick={onClose}>
            <IconX size={20} />
          </button>
        </>
      )}
    </dialog>
  );
}
