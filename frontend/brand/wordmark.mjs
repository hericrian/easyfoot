// Gera a marca do EasyFoot em SVG (texto convertido em curvas) e os PNGs do PWA.
//   node brand/wordmark.mjs
// Fonte: Saira Black Italic (SIL Open Font License) — as duas bolas substituem os "O" de FOOT.
import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ball } from "./ball3d.mjs";

const require = createRequire(import.meta.url);
const here = new URL(".", import.meta.url);
const pub = new URL("../public/", import.meta.url);

const FONT = process.env.EF_FONT || "@fontsource/saira/files/saira-latin-900-italic.woff";
const font = opentype.parse(readFileSync(require.resolve(FONT)).buffer);

const SIZE = 100;
const scale = SIZE / font.unitsPerEm;
const CAP = (font.tables.os2.sCapHeight || font.charToGlyph("H").getBoundingBox().y2) * scale;
const TRACK = 2; // espaçamento extra entre letras (unidades do SVG)

const f = (n) => Number(n.toFixed(2));

/** Escreve uma palavra; "o" minúsculo vira bola. Retorna { svg, width }. */
function word(text, x0, baseline, color, idp) {
  let x = x0;
  const out = [];
  const R = CAP * 0.53;
  const slant = Math.tan((11 * Math.PI) / 180); // acompanha a inclinação do itálico
  for (const ch of text) {
    if (ch === "o") {
      const cx = x + R + 3;
      const cy = baseline - CAP / 2;
      out.push(ball(cx + slant * (CAP / 2) * 0.35, cy, R, { paper: color, halo: color }));
      x = cx + R + 3 + TRACK;
      continue;
    }
    const g = font.charToGlyph(ch);
    out.push(`<path d="${g.getPath(x, baseline, SIZE).toPathData(2)}"/>`);
    x += g.advanceWidth * scale + TRACK;
  }
  return { svg: out.join(""), width: x - x0 - TRACK };
}

function wordmark({ layout, color = "#ffffff" }) {
  const pad = 6;
  const gap = CAP * 0.42;
  if (layout === "stacked") {
    const top = word("EASY", 0, 0, color, "s1");
    const bot = word("FooT", 0, 0, color, "s2");
    const W = Math.max(top.width, bot.width) + pad * 2;
    const lh = CAP + gap;
    const H = CAP * 2 + gap + pad * 2;
    const t = word("EASY", pad + (W - pad * 2 - top.width) / 2, pad + CAP, color, "s1");
    const b = word("FooT", pad + (W - pad * 2 - bot.width) / 2, pad + CAP + lh, color, "s2");
    return svgDoc(W, H, color, t.svg + b.svg);
  }
  const a = word("EASY", pad, pad + CAP, color, "h1");
  const b = word("FooT", pad + a.width + CAP * 0.32, pad + CAP, color, "h2");
  return svgDoc(pad * 2 + a.width + CAP * 0.32 + b.width, CAP + pad * 2, color, a.svg + b.svg);
}

function svgDoc(W, H, color, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" role="img" aria-label="EasyFoot"><title>EasyFoot</title><g fill="${color}">${body}</g></svg>\n`;
}

/** Ícone do app: só a bola, centralizada (zona segura do maskable incluída). */
function mark({ size = 512, inset = 0.19 } = {}) {
  const R = (size * (1 - inset * 2)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#000"/>${ball(size / 2, size / 2, R, { halo: "#ffffff" })}</svg>\n`;
}

const stacked = wordmark({ layout: "stacked" });
const inline = wordmark({ layout: "inline" });
const stackedInk = wordmark({ layout: "stacked", color: "#0a0a0a" });
const icon = mark();
const maskable = mark({ inset: 0.27 });

writeFileSync(new URL("easyfoot-logo.svg", here), stacked);
writeFileSync(new URL("easyfoot-logo-inline.svg", here), inline);
writeFileSync(new URL("easyfoot-logo-ink.svg", here), stackedInk);
writeFileSync(new URL("easyfoot-mark.svg", here), icon);
for (const [n, s] of [["easyfoot-logo.svg", stacked], ["easyfoot-logo-inline.svg", inline], ["easyfoot-mark.svg", icon]]) {
  writeFileSync(new URL(`assets/${n}`, pub), s);
}

const png = (svg, width, bg = "#000000") => new Resvg(svg, { fitTo: { mode: "width", value: width }, background: bg }).render().asPng();
const og = (() => {
  const vb = stacked.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const [w, h] = [Number(vb[1]), Number(vb[2])];
  const W = w * 2.6;
  const H = W / 1.905;
  return stacked.replace(vb[0], `viewBox="${f(-(W - w) / 2)} ${f(-(H - h) / 2)} ${f(W)} ${f(H)}"`);
})();
const files = {
  "icons/icon-192.png": png(icon, 192),
  "icons/icon-512.png": png(icon, 512),
  "icons/maskable-512.png": png(maskable, 512),
  "icons/apple-touch-icon.png": png(icon, 180),
  "icons/favicon-64.png": png(icon, 64),
  "icons/og-1200.png": png(og, 1200),
};
for (const [p, buf] of Object.entries(files)) writeFileSync(new URL(p, pub), buf);
console.log(`fonte: ${font.names.fullName?.en} · cap ${f(CAP)} · ${Object.keys(files).length} PNGs`);
