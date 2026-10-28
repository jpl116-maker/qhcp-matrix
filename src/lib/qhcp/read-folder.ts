import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const TEXT_EXT = new Set(["txt", "md", "csv", "html", "htm", "json", "eml", "log"]);
const SHEET_EXT = new Set(["xlsx", "xls", "xlsm", "xlsb"]);
const MAX_FILES = 25;
const MAX_BYTES = 8_000_000;
const MAX_PDF_PAGES = 12;
const MAX_FILE_CHARS = 4_000;
const MAX_DOSSIER = 48_000;

const NAME_WEIGHT = [
  "license",
  "licen",
  "lease",
  "residency",
  "agreement",
  "brochure",
  "marketing",
  "offering",
  "memorandum",
  "disclosure",
  "health",
  "regulat",
  "certificate",
  "assisted",
  "independent",
  "resident",
];

export type ReadProgress = {
  index: number;
  total: number;
  name: string;
};

export function dossierParts(dossier: string, files: string[]) {
  return files.flatMap((file) => {
    const marker = `--- ${file} ---`;
    const start = dossier.indexOf(marker);
    if (start < 0) return [];
    const next = dossier.indexOf("\n--- ", start + marker.length);
    const text = dossier.slice(start, next === -1 ? undefined : next).trim();
    return text.length > 40 ? [{ file, text }] : [];
  });
}

export type FolderRead = {
  dossier: string;
  filesRead: string[];
  filesSkipped: number;
  truncated: boolean;
};

function extension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function clean(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToText(html: string) {
  return clean(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function weight(name: string) {
  const lower = name.toLowerCase();
  return NAME_WEIGHT.reduce((score, key) => score + (lower.includes(key) ? 1 : 0), 0);
}

async function pdfToText(data: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const parts: string[] = [];
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  for (let index = 1; index <= pages; index += 1) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    if (line.trim()) parts.push(line);
  }
  if (doc.numPages > pages) parts.push("[later pages omitted]");
  return clean(parts.join("\n"));
}

async function sheetToText(data: ArrayBuffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(new Uint8Array(data), { type: "array" });
  const parts: string[] = [];
  for (const name of workbook.SheetNames.slice(0, 8)) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`Sheet: ${name}\n${csv}`);
  }
  return clean(parts.join("\n\n"));
}

async function docxToText(data: ArrayBuffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return clean(result.value);
}

async function fileToText(file: File) {
  const ext = extension(file.name);
  if (ext === "pdf") return pdfToText(await file.arrayBuffer());
  if (ext === "docx") return docxToText(await file.arrayBuffer());
  if (SHEET_EXT.has(ext)) return sheetToText(await file.arrayBuffer());
  if (ext === "html" || ext === "htm") return htmlToText(await file.text());
  if (TEXT_EXT.has(ext)) return clean(await file.text());
  return "";
}

export async function readFolder(
  files: File[],
  onFile?: (progress: ReadProgress) => void,
): Promise<FolderRead> {
  const ranked = files
    .filter((file) => file.size > 0 && file.size <= MAX_BYTES)
    .map((file) => ({ file, ext: extension(file.name), score: weight(file.name) }))
    .filter((item) => item.ext === "pdf" || item.ext === "docx" || SHEET_EXT.has(item.ext) || TEXT_EXT.has(item.ext))
    .sort((a, b) => b.score - a.score || a.file.name.localeCompare(b.file.name));

  const skipped = files.length - ranked.length;
  const chosen = ranked.slice(0, MAX_FILES);
  const blocks: string[] = [];
  const filesRead: string[] = [];
  let used = 0;
  let truncated = ranked.length > chosen.length;

  for (let index = 0; index < chosen.length; index += 1) {
    const item = chosen[index];
    const label = item.file.webkitRelativePath || item.file.name;
    onFile?.({ index, total: chosen.length, name: label });
    if (used >= MAX_DOSSIER) {
      truncated = true;
      break;
    }
    let text = "";
    try {
      text = await fileToText(item.file);
    } catch {
      continue;
    }
    if (!text) continue;
    if (text.length > MAX_FILE_CHARS) {
      text = `${text.slice(0, MAX_FILE_CHARS)}\n[file truncated]`;
      truncated = true;
    }
    const room = MAX_DOSSIER - used;
    if (text.length > room) {
      text = `${text.slice(0, room)}\n[dossier truncated]`;
      truncated = true;
    }
    blocks.push(`--- ${label} ---\n${text}`);
    filesRead.push(label);
    used += text.length;
  }

  return {
    dossier: blocks.join("\n\n"),
    filesRead,
    filesSkipped: skipped + (ranked.length - chosen.length),
    truncated,
  };
}
