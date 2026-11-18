import { useEffect, useRef, type ReactNode } from "react";

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={`stepper ${size}`} role="group" aria-label={label}>
      <button type="button" aria-label={`Diminuir ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Aumentar ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  );
}

/** Bottom sheet no celular, diálogo centralizado no desktop. Usa <dialog> nativo (foco e Esc). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      {open && (
        <div className="sheet-body">
          <div className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span aria-hidden>{icon}</span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Swatch({ color }: { color: string }) {
  return <span className="swatch" style={{ background: color }} aria-hidden />;
}
