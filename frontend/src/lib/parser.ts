import { nameKey } from "./util";

export type ParsedEntry = { name: string; gk: boolean; reserve: boolean };

type Section = "line" | "gk" | "reserve";

const GK_EMOJI = /🧤|🥅/u;
// "goleiro", "gol", "gk", "(g)" como palavra isolada (com suporte a acentos ao redor).
const GK_WORD = /(^|[^\p{L}\d])(goleir[oa]s?|gol|gk|arqueiro)(?=$|[^\p{L}\d])/iu;
const GK_WORD_G = /(^|[^\p{L}\d])(goleir[oa]s?|gol|gk|arqueiro)(?=$|[^\p{L}\d])/giu;
const GK_PAREN = /[([]\s*(g|gl|gol|gk)\s*[)\]]/giu;

const EMOJI =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}✅✔☑❌❎]/gu;

const HEADER =
  /^(goleir[oa]s?|gks?|reservas?|suplentes?|lista de espera|espera|banco|fila|linha|jogadores(?: de linha)?|confirmados|titulares)\s*(?:\([^)]*\))?\s*(:|[-–—]|$)\s*(.*)$/iu;

const NOISE_PATTERN =
  /\d{1,2}\s*[/.]\s*\d{1,2}|\d{1,2}\s*[:h]\s*\d{2}|r\$|https?:|www\.|\.com|@/iu;

const NOISE_WORDS =
  /(^|[^\p{L}])(local|quadra|campo|arena|endere[cç]o|valor|pix|hor[aá]rio|data|chave|mensalidade|avulso|lista|pelada|futebol|society|racha|jogo|partida|presen[cç]a|confirma[rç]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|hoje|amanh[aã]|pagamento|pagar|colete|bola|regras?|obs|atenção|aten[cç][aã]o|grupo|time|times)(?=$|[^\p{L}])/iu;

const STATUS_SUFFIX = /[\s\-–—|,]*[([]?\s*(pago|paga|pix|ok|confirmad[oa]|vai|vou|presente)\s*[)\]]?\s*$/iu;

function stripEmoji(s: string): string {
  return s.replace(EMOJI, " ");
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 2 && ["da", "de", "do", "di", "e"].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function letters(s: string): number {
  return (s.match(/\p{L}/gu) || []).length;
}

function sectionFor(word: string): Section {
  const w = word.toLowerCase();
  if (w.startsWith("goleir") || w.startsWith("gk")) return "gk";
  if (/^(reserva|suplente|lista de espera|espera|banco|fila)/.test(w)) return "reserve";
  return "line";
}

export function parseLine(raw: string, section: Section): ParsedEntry | null {
  let s = raw;
  const gk = section === "gk" || GK_EMOJI.test(s) || GK_WORD.test(stripEmoji(s)) || GK_PAREN.test(s);
  GK_PAREN.lastIndex = 0;

  s = stripEmoji(s);
  const numbered = /^\s*\d{1,3}\s*(?:[-.)º°ª:–—]|\s)/.test(s);

  s = s
    .replace(/^\s*[-•·*>+]+\s*/, "")
    .replace(/^\s*\d{1,3}\s*[-.)º°ª:–—]?\s*/, "")
    .replace(GK_PAREN, " ")
    .replace(GK_WORD_G, "$1 ")
    .replace(/\(\s*\)|\[\s*\]/g, " ");

  for (let i = 0; i < 2; i++) s = s.replace(STATUS_SUFFIX, "");

  s = s
    .replace(/^[\s\-–—.,:;|/]+|[\s\-–—.,:;|/]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!s || letters(s) < 2) return null;
  if (s.length > 40) return null;
  if (NOISE_PATTERN.test(s)) return null;
  if (/[?!]/.test(s)) return null;

  const words = s.split(" ").length;
  if (!numbered) {
    if (words > 4 || s.length > 32) return null;
    if (NOISE_WORDS.test(s)) return null;
  } else if (NOISE_WORDS.test(s) && words > 2) {
    return null;
  }

  // Remove lixo de OCR nas pontas (ex.: "| João" ou "João ~")
  s = s.replace(/^[^\p{L}\d]+|[^\p{L}\d)]+$/gu, "").trim();
  if (letters(s) < 2) return null;

  if (s === s.toUpperCase() || s === s.toLowerCase()) s = titleCase(s);

  return { name: s, gk, reserve: section === "reserve" };
}

/**
 * Lê uma lista colada do WhatsApp (ou texto de OCR) e devolve jogadores.
 * Entende numeração, emojis, seções "Goleiros:" / "Reservas:" e marcadores de goleiro.
 */
export function parseList(text: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  const seen = new Set<string>();
  let section: Section = "line";

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine
      .replace(/^\s*\[[^\]]{3,40}\]\s*[^:]{1,40}:\s*/, "") // prefixo de exportação do WhatsApp
      .replace(/[*_~`]/g, "")
      .trim();
    if (!line) continue;

    const plain = stripEmoji(line).replace(/^\s*[-•·*>]+\s*/, "").trim();
    const h = plain.match(HEADER);
    let isHeader = false;
    let lineSection = section;
    if (h) {
      const [, word, sep, rest] = h;
      // "Goleiros:" ou "Goleiros" sozinho → cabeçalho. "Goleiro João" sem ":" é jogador.
      if (sep === ":" || !rest.trim()) {
        isHeader = true;
        line = rest.trim();
        if (!line) {
          section = sectionFor(word); // seção vale para as próximas linhas
          continue;
        }
        lineSection = sectionFor(word); // "Goleiros: A, B" vale só para esta linha
      }
    }

    const parts = isHeader || (/[,;]/.test(line) && line.split(/[,;]/).every((p) => p.trim().split(/\s+/).length <= 3))
      ? line.split(/[,;]/)
      : [line];

    for (const part of parts) {
      const e = parseLine(part, lineSection);
      if (!e) continue;
      const k = nameKey(e.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
  }
  return out;
}
