import * as pdfjsLib from "pdfjs-dist";
// Vite's `?url` suffix resolves this to a hashed asset URL at build time, so the worker ships
// as a static file rather than needing a CDN — extraction never leaves the browser.
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
}

// Runs entirely client-side: only the extracted text (never the raw file) crosses the network
// to the server, keeping large binaries off the wire and avoiding any file-upload plumbing.
export async function extractPdfText(file: File): Promise<PdfExtractionResult> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    pageTexts.push(pageText);
    page.cleanup();
  }
  await doc.cleanup();

  return { text: pageTexts.join("\n\n"), pageCount: doc.numPages };
}
