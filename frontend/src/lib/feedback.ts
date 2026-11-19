/**
 * Retorno físico do modo ao vivo: apito (Web Audio, sem arquivo), vibração e tela
 * sempre acesa. Tudo é opcional — cada API é detectada e falha em silêncio.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Precisa ser chamado num toque do usuário (iOS só libera áudio assim). */
export function primeAudio(): void {
  const a = audio();
  if (!a) return;
  const g = a.createGain();
  g.gain.value = 0;
  g.connect(a.destination);
  const o = a.createOscillator();
  o.connect(g);
  o.start();
  o.stop(a.currentTime + 0.01);
}

/** Apito de árbitro: tom agudo com trinado. `long` = fim de jogo (três apitos). */
export function whistle(kind: "short" | "end" = "short"): void {
  const a = audio();
  if (!a) return;
  const blasts = kind === "end" ? [0, 0.42, 0.84] : [0];
  const len = kind === "end" ? 0.34 : 0.22;
  for (const t0 of blasts) {
    const start = a.currentTime + t0;
    const osc = a.createOscillator();
    const lfo = a.createOscillator();
    const lfoGain = a.createGain();
    const gain = a.createGain();
    osc.type = "square";
    osc.frequency.value = 2650;
    lfo.frequency.value = 38; // o "trinado" da bolinha do apito
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015);
    gain.gain.setValueAtTime(0.12, start + len - 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
    osc.connect(gain).connect(a.destination);
    osc.start(start);
    lfo.start(start);
    osc.stop(start + len + 0.02);
    lfo.stop(start + len + 0.02);
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sem suporte */
  }
}

type Sentinel = { release: () => Promise<void>; released?: boolean };
let lock: Sentinel | null = null;

/** Mantém a tela acesa enquanto o cronômetro roda. */
export async function keepAwake(on: boolean): Promise<void> {
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } }).wakeLock;
    if (on) {
      if (wl && (!lock || lock.released)) lock = await wl.request("screen");
    } else if (lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}
