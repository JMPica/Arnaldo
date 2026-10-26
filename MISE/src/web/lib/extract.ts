/**
 * Extracción LOCAL en el navegador (sin servicios externos):
 *  - PDF con texto embebido → pdf.js
 *  - Foto o PDF escaneado → OCR con Tesseract.js (modelo español auto-alojado en /ocr)
 * El resultado es texto no confiable que solo alimenta una propuesta revisable.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type Progress = (stage: string, value: number) => void;

async function pdfDoc(data: ArrayBuffer) {
  return pdfjs.getDocument({ data: new Uint8Array(data), disableFontFace: true, useSystemFonts: false }).promise;
}

/** Reconstruye líneas agrupando los fragmentos de texto por coordenada vertical. */
export async function pdfText(data: ArrayBuffer, maxPages = 10): Promise<{ text: string; pages: number }> {
  const doc = await pdfDoc(data.slice(0));
  const out: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as { str: string; transform: number[] }[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5]! / 3) * 3;
      const arr = rows.get(y) ?? [];
      arr.push({ x: it.transform[4]!, s: it.str });
      rows.set(y, arr);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => out.push(items.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim()));
  }
  return { text: out.join('\n'), pages: doc.numPages };
}

/** Renderiza páginas de un PDF escaneado a imágenes para OCR. */
export async function pdfToImages(data: ArrayBuffer, maxPages = 3): Promise<Blob[]> {
  const doc = await pdfDoc(data.slice(0));
  const blobs: Blob[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    blobs.push(await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png')));
  }
  return blobs;
}

export async function ocrImages(images: Blob[], onProgress?: Progress): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('spa', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    gzip: true,
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => onProgress?.(m.status, m.progress),
  });
  try {
    const parts: string[] = [];
    for (const img of images) parts.push((await worker.recognize(img)).data.text);
    return parts.join('\n');
  } finally {
    await worker.terminate();
  }
}

/** Reduce fotos grandes del móvil antes de subirlas (máx. 2000 px, JPEG 0,85). */
export async function compressImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1_500_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85));
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
