import type { Answer } from "./score";

function sameUrl(left: string, right: string) {
  const a = normalizeUrl(left);
  const b = normalizeUrl(right);
  return Boolean(a && b && a === b);
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function pathDepth(value: string) {
  const normalized = normalizeUrl(value);
  if (!normalized) return 0;
  return new URL(normalized).pathname.split("/").filter(Boolean).length;
}

function resolveListed(files: string[], name: string) {
  return files.find((file) => sameUrl(file, name) || file === name) || name;
}
function baseName(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function escapeReg(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchFile(files: string[], value: string) {
  const needle = value.trim().toLowerCase();
  if (!needle) return "";
  const exact = files.find((file) => {
    const lower = file.toLowerCase();
    if (lower === needle || sameUrl(file, value)) return true;
    if (/^https?:\/\//i.test(file)) return false;
    return baseName(file).toLowerCase() === needle;
  });
  if (exact) return exact;
  const byBase = files.filter((file) => /^https?:\/\//i.test(file) && baseName(normalizeUrl(file) || file).toLowerCase() === needle);
  if (byBase.length === 1) return byBase[0];
  return (
    files.find((file) => {
      if (/^https?:\/\//i.test(file)) return false;
      const lower = file.toLowerCase();
      const base = baseName(file).toLowerCase();
      if (base.length < 6) return false;
      return needle.includes(base) || needle.includes(lower);
    }) ?? ""
  );
}

function sections(dossier: string) {
  return dossier
    .split(/^--- /m)
    .slice(1)
    .map((part) => {
      const marker = part.indexOf(" ---");
      if (marker === -1) return null;
      return { name: part.slice(0, marker).trim(), text: part.slice(marker + 4) };
    })
    .filter((section): section is { name: string; text: string } => section !== null && section.name.length > 0);
}

function pickPage(hits: { name: string; text: string }[], pageCount: number) {
  if (!hits.length) return null;
  const boilerplate = hits.length > 1 && hits.length / pageCount >= 0.6;
  const ranked = [...hits].sort((a, b) => {
    const depth = pathDepth(a.name) - pathDepth(b.name);
    return boilerplate ? depth : -depth;
  });
  return ranked[0];
}

export function locateSource(files: string[], dossier: string, quote: string) {
  const wanted = normalize(quote);
  const needle = wanted.toLowerCase();
  if (needle.length < 16) return "";
  const parts = sections(dossier);
  if (!parts.length) return "";
  const pick = (hits: { name: string; text: string }[]) => {
    const chosen = pickPage(hits, parts.length);
    return chosen ? resolveListed(files, chosen.name) : "";
  };
  const verbatim = parts.filter((section) => normalize(section.text).toLowerCase().includes(needle));
  const found = pick(verbatim);
  if (found) return found;
  const words = wanted.split(" ").filter((word) => word.length > 2);
  for (let size = Math.min(words.length, 14); size >= 5; size -= 1) {
    for (let index = 0; index + size <= words.length; index += 1) {
      const phrase = words.slice(index, index + size).join(" ").toLowerCase();
      const hits = parts.filter((section) => normalize(section.text).toLowerCase().includes(phrase));
      if (hits.length) return pick(hits);
    }
  }
  return "";
}

function sectionForText(files: string[], dossier: string, evidence: string) {
  const words = evidence
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 4);
  if (words.length < 3) return "";
  let best = "";
  let bestScore = 0;
  for (const section of sections(dossier)) {
    const body = section.text.toLowerCase();
    const score = words.reduce((total, word) => total + (body.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = matchFile(files, section.name) || section.name;
    }
  }
  return bestScore >= 3 ? best : "";
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function sectionText(files: string[], dossier: string, cited: string) {
  const listed = sections(dossier);
  const exact = listed.find((section) => section.name.toLowerCase() === cited.toLowerCase() || sameUrl(section.name, cited));
  if (exact) return exact.text;
  if (/^https?:\/\//i.test(cited)) return "";
  const base = baseName(cited).toLowerCase();
  return listed.find((section) => baseName(section.name).toLowerCase() === base)?.text ?? "";
}

const QUOTE_LIMIT = 220;

function wordsOf(text: string) {
  return new Set(text.toLowerCase().split(/\W+/).filter((word) => word.length > 3));
}

function overlap(candidate: string, wantedWords: Set<string>) {
  const words = candidate.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
  const hits = words.filter((word) => wantedWords.has(word)).length;
  return { hits, score: words.length === 0 ? 0 : hits / words.length };
}

function bestPiece(pieces: string[], wantedWords: Set<string>, minHits: number, minScore: number) {
  let best = "";
  for (const piece of pieces) {
    const { hits, score } = overlap(piece, wantedWords);
    if (hits < minHits || score < minScore) continue;
    if (!best || piece.length < best.length) best = piece;
  }
  return best;
}

function clip(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= QUOTE_LIMIT) return trimmed;
  const cut = trimmed.slice(0, QUOTE_LIMIT);
  const space = cut.lastIndexOf(" ");
  return (space > 80 ? cut.slice(0, space) : cut).trim();
}

function findVerbatim(section: string, rough: string) {
  const source = normalize(section);
  const wanted = normalize(rough).replace(/^["“”']+|["“”']+$/g, "");
  if (!source || wanted.length < 12) return clip(wanted);
  const wantedWords = wordsOf(wanted);
  const at = source.toLowerCase().indexOf(wanted.toLowerCase());
  const passage = at >= 0 ? source.slice(at, at + wanted.length) : "";
  if (passage && passage.length <= QUOTE_LIMIT) return passage;
  const pool = passage || source;
  const sentences = pool.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length >= 20);
  const sentence = bestPiece(sentences, wantedWords, 3, 0.5);
  if (sentence && sentence.length <= QUOTE_LIMIT) return sentence;
  const base = sentence || (passage.length <= QUOTE_LIMIT ? passage : "") || wanted;
  if (base.length <= QUOTE_LIMIT) return base;
  const clause = bestPiece(
    base.split(/\s*;\s*/).filter((part) => part.length >= 20),
    wantedWords,
    2,
    0.5,
  );
  return clip(clause || base);
}

export function splitEvidence(note: string) {
  const trimmed = note.trim();
  const urlLead = trimmed.match(/^(https?:\/\/\S+?)(?:\s*:\s+|\s{2,})([\s\S]+)$/i);
  if (urlLead) return { file: urlLead[1].replace(/[),.;]+$/g, ""), quote: urlLead[2].trim() };
  if (/^https?:\/\/\S+$/i.test(trimmed)) return { file: trimmed.replace(/[),.;]+$/g, ""), quote: "" };
  const match = trimmed.match(/^([^:\n]{1,180}):\s*([\s\S]+)$/);
  if (!match) return { file: "", quote: note };
  return { file: match[1], quote: match[2] };
}

function stripLeadingFile(label: string, evidence: string) {
  let rest = evidence.trim();
  for (const name of [label, baseName(label)]) {
    if (!name) continue;
    rest = rest.replace(new RegExp(`^\\[?${escapeReg(name)}\\]?\\s*[:\\-—]\\s*`, "i"), "");
  }
  return rest.trim();
}

export function citeEvidence(
  files: string[],
  dossier: string,
  answer: Answer,
  file: string,
  evidence: string,
) {
  if (answer === "NA") return "";
  const web = files.some((file) => /^https?:\/\//i.test(file));
  const located = web ? locateSource(files, dossier, evidence) : "";
  const cited =
    located ||
    matchFile(files, file) ||
    (web ? "" : matchFile(files, evidence) || sectionForText(files, dossier, evidence));
  const label = cited && /^https?:\/\//i.test(cited) ? cited : cited ? baseName(cited) : "";
  const rough = label ? stripLeadingFile(label, evidence) : evidence.trim();
  const section = cited ? sectionText(files, dossier, cited) : "";
  const sentence = section ? findVerbatim(section, rough) : clip(rough);
  if (!label) return sentence;
  if (!sentence) return label;
  return `${label}: ${sentence}`;
}
