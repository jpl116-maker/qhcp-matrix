const TYPES: { abbr: string; pattern: RegExp }[] = [
  { abbr: "IL", pattern: /\b(?:independent[- ]living|i\.?l\.?)\b/gi },
  { abbr: "AL", pattern: /\b(?:assisted[- ]living|a\.?l\.?)\b/gi },
  { abbr: "MC", pattern: /\b(?:memory[- ]care|m\.?c\.?|dementia(?:[- ]care)?)\b/gi },
  { abbr: "SNF", pattern: /\b(?:skilled[- ]nursing(?:[- ](?:facility|home))?|s\.?n\.?f\.?|nursing facility|nursing home)\b/gi },
];

function countNear(text: string, index: number, length: number) {
  const window = 32;
  const before = text.slice(Math.max(0, index - window), index);
  const after = text.slice(index + length, index + length + window);
  const number = "(\\d{1,3}(?:,\\d{3})+|\\d{1,5})\\s*(%?)";
  const beforeMatch = before.match(
    new RegExp(`${number}\\s*[- ]?\\s*(?:units?|beds?|apartments?|suites?|residences?)?\\s*\\)?\\s*$`, "i"),
  );
  const afterMatch = after.match(new RegExp(`^\\s*\\(?\\s*(?:of|:|–|-|=)?\\s*${number}`, "i"));
  const hits: { value: string; distance: number }[] = [];
  if (beforeMatch?.index !== undefined) {
    hits.push({
      value: `${beforeMatch[1].replace(/,/g, "")}${beforeMatch[2]}`,
      distance: before.length - (beforeMatch.index + beforeMatch[0].length),
    });
  }
  if (afterMatch) {
    hits.push({
      value: `${afterMatch[1].replace(/,/g, "")}${afterMatch[2]}`,
      distance: afterMatch[0].indexOf(afterMatch[1]),
    });
  }
  hits.sort((left, right) => left.distance - right.distance);
  return hits[0]?.value ?? "";
}

export function formatUnitMix(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  const found = new Map<string, string>();
  for (const type of TYPES) {
    for (const match of text.matchAll(type.pattern)) {
      const count = countNear(text, match.index ?? 0, match[0].length);
      if (!count) continue;
      const current = found.get(type.abbr);
      if (!current || (current.endsWith("%") && !count.endsWith("%"))) found.set(type.abbr, count);
    }
  }
  const parts = TYPES.filter((type) => found.has(type.abbr)).map((type) => `${found.get(type.abbr)} ${type.abbr}`);
  return parts.join(" / ");
}
