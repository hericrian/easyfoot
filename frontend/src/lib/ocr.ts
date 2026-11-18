/**
 * OCR 100% no navegador (tesseract.js, open source). Nenhuma imagem sai do aparelho
 * além do download do motor/idioma do CDN na primeira vez.
 */

export type OcrProgress = (fraction: number, label: string) => void;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Escala, converte para cinza e inverte prints em modo escuro — melhora muito o OCR. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const img = await loadImage(file);
  const maxW = 1800;
  const scale = img.naturalWidth < 900 ? 2 : Math.min(1, maxW / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = g;
    sum += g;
  }
  const mean = sum / (px.length / 4);
  if (mean < 115) {
    for (let i = 0; i < px.length; i += 4) px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export async function ocrImages(files: File[], onProgress: OcrProgress): Promise<string> {
  onProgress(0, "Carregando leitor de imagem…");
  const { createWorker } = await import("tesseract.js");
  let current = 0;
  const worker = await createWorker("por", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress((current + m.progress) / files.length, `Lendo imagem ${current + 1} de ${files.length}…`);
      } else if (current === 0 && m.status) {
        onProgress(0.02, "Preparando OCR (só na primeira vez demora mais)…");
      }
    },
  });
  try {
    const texts: string[] = [];
    for (current = 0; current < files.length; current++) {
      const canvas = await prepare(files[current]);
      const { data } = await worker.recognize(canvas);
      texts.push(data.text);
    }
    onProgress(1, "Pronto");
    return texts.join("\n").trim();
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}
