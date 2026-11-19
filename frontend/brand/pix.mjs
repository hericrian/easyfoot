// Gera o QR code do Pix (SVG nítido + PNG para download) a partir de src/config/support.json.
//   node brand/pix.mjs
import QRCode from "qrcode";
import { readFileSync, writeFileSync } from "node:fs";

const { pix } = JSON.parse(readFileSync(new URL("../src/config/support.json", import.meta.url), "utf8"));
const opts = { errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } };

const svg = await QRCode.toString(pix, { ...opts, type: "svg" });
writeFileSync(new URL("../public/assets/pix-qr.svg", import.meta.url), svg);
await QRCode.toFile(new URL("../public/assets/pix-qr.png", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), pix, { ...opts, width: 1024 });
console.log("QR do Pix gerado");
