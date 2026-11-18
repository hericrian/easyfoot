/**
 * Instalação do PWA.
 *
 * `beforeinstallprompt` (Chrome/Edge/Brave/Opera em Android, Windows, Mac e ChromeOS)
 * dispara UMA vez, cedo. Se ninguém estiver ouvindo naquele instante, o convite se perde.
 * Por isso `startInstallCapture()` roda no bootstrap (main.tsx), e não dentro de um
 * componente que talvez monte depois.
 *
 * iOS/iPadOS não têm esse evento nem API: a instalação é manual pelo Safari
 * (Compartilhar → Adicionar à Tela de Início). Safari no Mac usa Arquivo → Adicionar ao Dock.
 * Firefox desktop não instala PWA.
 */

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const INSTALLABLE_EVENT = "easyfoot:installable";
export const INSTALLED_EVENT = "easyfoot:installed";

let saved: InstallPromptEvent | null = null;
let listening = false;
let installedThisSession = false;

export function wasInstalledThisSession(): boolean {
  return installedThisSession;
}

export function markInstalled(): void {
  installedThisSession = true;
  saved = null;
  window.dispatchEvent(new Event(INSTALLED_EVENT));
}

export function getSavedPrompt(): InstallPromptEvent | null {
  return saved;
}

export function clearSavedPrompt(): void {
  saved = null;
}

export function startInstallCapture(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Sem isto o Chrome mostra a barra dele em qualquer tela.
    e.preventDefault();
    saved = e as InstallPromptEvent;
    window.dispatchEvent(new Event(INSTALLABLE_EVENT));
  });
  window.addEventListener("appinstalled", () => markInstalled());
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isChromium(): boolean {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  if (brands?.length) return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(b.brand));
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg\//.test(ua) && !/Firefox|FxiOS|CriOS|EdgiOS/.test(ua);
}

export type Platform = "windows" | "android" | "ios" | "mac" | "other";

/** Só para escolher o texto de ajuda; quem decide se há botão é o prompt existir. */
export function platform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const iPadAsMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPod|iPad/.test(ua) || iPadAsMac) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "mac";
  return "other";
}

/** No iOS só o Safari (e, desde o iOS 16.4, outros navegadores pelo menu Compartilhar) instala. */
export function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return platform() === "ios" && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

export function isMacSafari(): boolean {
  const ua = navigator.userAgent;
  return platform() === "mac" && /Safari/.test(ua) && !/Chrome|Chromium|Edg\/|Firefox/.test(ua);
}
