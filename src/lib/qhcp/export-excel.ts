import { FACTORS, IDENTITY_FIELDS, categoryName, citationText, questionText } from "@/lib/qhcp/factors";
import { type PropertyId, type PropertyRecord } from "@/lib/qhcp/score";

const FIXED = ["#", "Category", "Factor", "Citation", "If Yes"] as const;
const PROPERTY_COLS = ["Answer", "Evidence", "Webpage"] as const;

function answerLabel(value: string | undefined) {
  if (value === "Yes") return "Yes";
  if (value === "No") return "No";
  if (value === "NA") return "N/A";
  return "";
}

function sourceUrl(property: PropertyRecord, factorId: number) {
  const url = property.sources?.[factorId] ?? "";
  if (!/^https?:\/\//i.test(url)) return "";
  const answer = property.answers[factorId];
  if (answer !== "Yes" && answer !== "No") return "";
  return url;
}

function fileSlug(names: string[]) {
  const slug = names
    .map((name) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    )
    .filter(Boolean)
    .join("-")
    .slice(0, 60);
  return `${slug || "qhcp-matrix"}.xlsx`;
}

function propertyStart(index: number) {
  return FIXED.length + index * PROPERTY_COLS.length;
}

export async function downloadMatrixWorkbook(args: {
  properties: Record<PropertyId, PropertyRecord>;
  ids: PropertyId[];
  questions?: Partial<Record<number, string>>;
  citations?: Partial<Record<number, string>>;
  categories?: Partial<Record<string, string>>;
}) {
  const XLSX = await import("xlsx");
  const ids = args.ids.filter((id) => args.properties[id]);
  const properties = ids.map((id) => args.properties[id]);
  const factors = FACTORS.map((factor) => ({
    ...factor,
    text: questionText(factor, args.questions),
    hook: citationText(factor, args.citations),
    category: categoryName(factor.category, args.categories),
  }));
  const prepared = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const width = FIXED.length + ids.length * PROPERTY_COLS.length;
  const blank = () => Array.from({ length: width }, () => "");
  const rows: string[][] = [];

  const title = blank();
  title[0] = "Qualified Health Care Property Matrix";
  rows.push(title);
  const date = blank();
  date[0] = `Prepared ${prepared}. ${ids.length === 1 ? "One property." : `${ids.length} properties.`}`;
  rows.push(date);
  rows.push(blank());

  const names = blank();
  properties.forEach((property, index) => {
    names[propertyStart(index)] = property.name.trim() || "Untitled";
  });
  rows.push(names);

  const headers = blank();
  FIXED.forEach((label, index) => {
    headers[index] = label;
  });
  properties.forEach((_, index) => {
    PROPERTY_COLS.forEach((label, offset) => {
      headers[propertyStart(index) + offset] = label;
    });
  });
  rows.push(headers);

  for (const field of IDENTITY_FIELDS) {
    const row = blank();
    row[2] = field.label;
    properties.forEach((property, index) => {
      row[propertyStart(index)] = property.identity[field.key] || "";
    });
    rows.push(row);
  }
  const website = blank();
  website[2] = "Website";
  properties.forEach((property, index) => {
    website[propertyStart(index)] = property.website || "";
  });
  rows.push(website);
  rows.push(blank());

  const factorStart = rows.length;
  for (const factor of factors) {
    const row = blank();
    row[0] = String(factor.id);
    row[1] = factor.category;
    row[2] = factor.text;
    row[3] = factor.hook;
    row[4] = factor.direction === "support" ? "Supports" : "Cuts against";
    properties.forEach((property, index) => {
      const start = propertyStart(index);
      row[start] = answerLabel(property.answers[factor.id]);
      row[start + 1] = property.notes[factor.id] || "";
      row[start + 2] = sourceUrl(property, factor.id);
    });
    rows.push(row);
  }

  const matrix = XLSX.utils.aoa_to_sheet(rows);
  matrix["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(width - 1, 0) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(width - 1, 0) } },
    ...ids.map((_, index) => ({
      s: { r: 3, c: propertyStart(index) },
      e: { r: 3, c: propertyStart(index) + PROPERTY_COLS.length - 1 },
    })),
  ];
  matrix["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 72 },
    { wch: 36 },
    { wch: 16 },
    ...ids.flatMap(() => [{ wch: 18 }, { wch: 64 }, { wch: 42 }]),
  ];

  for (let factorIndex = 0; factorIndex < factors.length; factorIndex += 1) {
    properties.forEach((property, propertyIndex) => {
      const url = sourceUrl(property, factors[factorIndex].id);
      if (!url) return;
      const address = XLSX.utils.encode_cell({
        r: factorStart + factorIndex,
        c: propertyStart(propertyIndex) + 2,
      });
      const cell = matrix[address];
      if (cell) cell.l = { Target: url };
    });
  }

  const answers: string[][] = [["#", "Question", ...properties.map((property) => property.name.trim() || "Untitled")]];
  for (const field of IDENTITY_FIELDS) {
    answers.push(["", field.label, ...properties.map((property) => property.identity[field.key] || "")]);
  }
  for (const factor of factors) {
    answers.push([
      String(factor.id),
      factor.text,
      ...properties.map((property) => answerLabel(property.answers[factor.id])),
    ]);
  }
  const answerSheet = XLSX.utils.aoa_to_sheet(answers);
  answerSheet["!cols"] = [{ wch: 5 }, { wch: 80 }, ...properties.map(() => ({ wch: 28 }))];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, matrix, "Matrix");
  XLSX.utils.book_append_sheet(book, answerSheet, "Answers");
  const namesForFile = properties.map((property) => property.name.trim() || "Untitled");
  XLSX.writeFile(book, fileSlug(namesForFile));
}
