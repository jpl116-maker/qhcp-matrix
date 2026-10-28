const KEYWORDS = [
  "assist",
  "memory",
  "health",
  "nurs",
  "skilled",
  "service",
  "amenit",
  "dining",
  "wellness",
  "lifestyle",
  "independent",
  "care",
  "faq",
  "about",
  "licen",
  "resident",
  "floor",
  "communit",
];

function blockedHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  const match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function publicUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (blockedHost(url.hostname) || !url.hostname.includes(".")) return null;
  url.hash = "";
  return url.toString();
}

export function webpageUrl(value: string) {
  const trimmed = value.trim().replace(/[),.;]+$/g, "");
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/"/gi, '"')
    .replace(/&#39;|'/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLink(raw: string, base: string, origin: string) {
  try {
    const url = new URL(raw, base);
    if (url.origin !== origin || (url.protocol !== "http:" && url.protocol !== "https:")) return "";
    if (blockedHost(url.hostname)) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|css|js|mp4|ico)$/i.test(url.pathname)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function linksFromHtml(html: string, base: string) {
  const origin = new URL(base).origin;
  const found: string[] = [];
  const pattern = /<a\s[^>]*href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const link = cleanLink(match[1], base, origin);
    if (link && link !== base && !found.includes(link)) found.push(link);
  }
  return found;
}

export function rankPage(url: string) {
  const path = new URL(url).pathname.toLowerCase();
  return KEYWORDS.reduce((score, word) => score + (path.includes(word) ? 2 : 0), 0) - path.split("/").length;
}
