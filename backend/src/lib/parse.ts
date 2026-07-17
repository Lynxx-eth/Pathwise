// Extract plain text from uploaded course materials (Step 2, parsing pipeline).
// Supports PDF, DOCX, and PPTX — the only types the app accepts.
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import mammoth from "mammoth";
import JSZip from "jszip";

export type ParseKind = "pdf" | "docx" | "pptx";

export function kindFor(filename: string, mimeType: string): ParseKind | null {
  const ext = extname(filename).toLowerCase();
  if (mimeType === "application/pdf" || ext === ".pdf") return "pdf";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  )
    return "docx";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === ".pptx"
  )
    return "pptx";
  return null;
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // Use the legacy build — it runs in Node without a browser worker.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    // Silence noisy font warnings during extraction.
    verbosity: 0,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    pages.push(line);
  }
  await doc.destroy();
  return pages.join("\n");
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function parsePptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  // Slide XML files, in slide order.
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const n = (p: string) => Number(p.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return n(a) - n(b);
    });

  const out: string[] = [];
  for (const path of slidePaths) {
    const xml = await zip.files[path].async("string");
    // <a:t> holds run text in DrawingML.
    const runs = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map((m) =>
      decodeXmlEntities(m[1])
    );
    if (runs.length) out.push(runs.join(" "));
  }
  return out.join("\n");
}

/** Read a saved file and extract its text. Throws on unsupported types. */
export async function extractText(
  storagePath: string,
  filename: string,
  mimeType: string
): Promise<string> {
  const kind = kindFor(filename, mimeType);
  if (!kind) throw new Error(`Unsupported file type: ${filename} (${mimeType})`);

  const buffer = await readFile(storagePath);
  switch (kind) {
    case "pdf":
      return normalize(await parsePdf(buffer));
    case "docx":
      return normalize(await parseDocx(buffer));
    case "pptx":
      return normalize(await parsePptx(buffer));
  }
}

// Collapse excess whitespace but keep line breaks (topic heuristics use them).
function normalize(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
