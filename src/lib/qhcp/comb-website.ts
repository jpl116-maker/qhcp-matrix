import { createServerFn } from "@tanstack/react-start";
import { locateSource, matchFile, splitEvidence } from "./cite-file";
import { FACTORS, type IdentityKey } from "./factors";
import { reviewDossier } from "./fill-matrix";
import type { Answer } from "./score";
import { htmlToText, linksFromHtml, publicUrl, rankPage } from "./website";

export type WebsiteAnswer = {
  id: number;
  answer: Exclude<Answer, "NA">;
  evidence: string;
  url: string;
};

const PAGE_LIMIT = 6;
const PAGE_CHARS = 3_500;
const DOSSIER_CHARS = 24_000;

async function fetchHtml(start: string) {
  let current = start;
  for (let hop = 0; hop < 4; hop += 1) {
    const safe = publicUrl(current);
    if (!safe) throw new Error("That address cannot be read.");
    const response = await fetch(safe, {
      redirect: "manual",
      headers: {
        Accept: "text/html, text/plain",
        "User-Agent": "QHCPMatrix/1.0",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The site redirected without a destination.");
      current = new URL(location, safe).toString();
      continue;
    }
    if (!response.ok) throw new Error(`The site returned ${response.status}.`);
    const type = response.headers.get("content-type") ?? "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      throw new Error("That address is not a web page.");
    }
    const html = (await response.text()).slice(0, 400_000);
    return { url: safe, html };
  }
  throw new Error("The site redirected too many times.");
}

async function readSite(start: string) {
  const home = await fetchHtml(start);
  const homeText = htmlToText(home.html).slice(0, PAGE_CHARS);
  if (homeText.length < 40) throw new Error("That page did not contain enough text to review.");
  const ranked = linksFromHtml(home.html, home.url)
    .sort((a, b) => rankPage(b) - rankPage(a) || a.length - b.length)
    .slice(0, PAGE_LIMIT - 1);
  const rest = await Promise.all(
    ranked.map(async (url) => {
      try {
        const page = await fetchHtml(url);
        const text = htmlToText(page.html).slice(0, PAGE_CHARS);
        return text.length >= 40 ? { url: page.url, text } : null;
      } catch {
        return null;
      }
    }),
  );
  const pages = [{ url: home.url, text: homeText }, ...rest.filter((page): page is { url: string; text: string } => Boolean(page))];
  let used = 0;
  const kept: { url: string; text: string }[] = [];
  for (const page of pages) {
    if (used >= DOSSIER_CHARS) break;
    const text = page.text.slice(0, DOSSIER_CHARS - used);
    kept.push({ url: page.url, text });
    used += text.length;
  }
  return kept;
}

export const combPropertyWebsite = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Missing website.");
    const website = publicUrl(String((input as { website?: unknown }).website ?? ""));
    if (!website) throw new Error("Enter a public http or https website.");
    const incoming = (input as { questions?: unknown }).questions;
    const supplied = new Map<number, string>();
    if (Array.isArray(incoming)) {
      for (const item of incoming) {
        if (!item || typeof item !== "object") continue;
        const id = (item as { id?: unknown }).id;
        const text = (item as { text?: unknown }).text;
        if (typeof id !== "number" || !Number.isInteger(id) || typeof text !== "string") continue;
        const trimmed = text.trim().slice(0, 1200);
        if (trimmed) supplied.set(id, trimmed);
      }
    }
    const questions = FACTORS.map((factor) => ({
      id: factor.id,
      text: supplied.get(factor.id) || factor.text,
    }));
    return { website, questions };
  })
  .handler(async ({ data }): Promise<
    | { ok: true; pages: string[]; answers: WebsiteAnswer[]; name: string; identity: Record<IdentityKey, string> }
    | { ok: false; error: string }
  > => {
    let pages: { url: string; text: string }[];
    try {
      pages = await readSite(data.website);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The website could not be read.";
      return { ok: false, error: message };
    }
    const files = pages.map((page) => page.url);
    const dossier = pages.map((page) => `--- ${page.url} ---\n${page.text}`).join("\n\n");
    const reviewed = await reviewDossier(dossier, files, data.questions);
    if (!reviewed.ok) return reviewed;
    const answers: WebsiteAnswer[] = [];
    for (const row of reviewed.fill.answers) {
      if (row.answer !== "Yes" && row.answer !== "No") continue;
      const { file, quote } = splitEvidence(row.evidence);
      const url =
        locateSource(files, dossier, quote || row.evidence) ||
        matchFile(files, file) ||
        matchFile(files, row.evidence);
      if (!url.startsWith("http")) continue;
      answers.push({ id: row.id, answer: row.answer, evidence: row.evidence, url });
    }
    return {
      ok: true,
      pages: files,
      answers,
      name: reviewed.fill.name,
      identity: reviewed.fill.identity,
    };
  });
