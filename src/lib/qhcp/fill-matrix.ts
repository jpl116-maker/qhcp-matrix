import { createServerFn } from "@tanstack/react-start";
import { citeEvidence } from "./cite-file";
import { formatUnitMix } from "./unit-mix";
import { FACTORS, IDENTITY_FIELDS, type IdentityKey } from "./factors";
import type { Answer } from "./score";

export type FolderAnswer = {
  id: number;
  answer: Answer;
  evidence: string;
};

export type FolderFill = {
  name: string;
  identity: Record<IdentityKey, string>;
  answers: FolderAnswer[];
};

const IDENTITY_KEYS = IDENTITY_FIELDS.map((field) => field.key);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "identity", "answers"],
  properties: {
    name: { type: "string", description: "Community or facility name. Empty string if the text does not state it." },
    identity: {
      type: "object",
      additionalProperties: false,
      required: IDENTITY_KEYS,
      properties: {
        jurisdiction: {
          type: "string",
          description: "State, and city if stated. Empty string if the text is silent.",
        },
        license: {
          type: "string",
          description:
            "License or state regulatory classification: none, assisted living, SNF, regulated independent living, or other. Use none if the text says unlicensed. Empty string if silent.",
        },
        unitMix: {
          type: "string",
          description:
            'Unit counts only, nothing else. Form: "89 IL / 50 AL / 30 MC". Include only IL, AL, MC, or SNF when a count is stated, in that order. Add SNF when stated, as in "89 IL / 50 AL / 30 MC / 20 SNF". Use a percent only when the text gives a percentage and not a count. Empty string if no count or percentage is stated.',
        },
        marketed: { type: "string", description: "Marketed name or product type. Empty string if silent." },
        operator: { type: "string", description: "Who operates or manages the community. Empty string if silent." },
        structure: {
          type: "string",
          description:
            "Intended REIT structure only if the text states a lease to a TRS, an eligible independent contractor, or TRS operation. Otherwise empty.",
        },
      },
    },
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "answer", "file", "evidence"],
        properties: {
          id: { type: "integer" },
          answer: { type: "string", enum: ["Yes", "No", "NA"] },
          file: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
  },
} as const;

function factorPrompt(questions: { id: number; text: string }[]) {
  const byId = new Map(questions.map((question) => [question.id, question.text.trim()]));
  return FACTORS.map((factor) => {
    const text = byId.get(factor.id) || factor.text;
    return `${factor.id}. ${text} (If this statement is true it ${factor.direction === "support" ? "supports" : "cuts against"} QHCP.)`;
  }).join("\n");
}

function emptyIdentity(): Record<IdentityKey, string> {
  return {
    jurisdiction: "",
    license: "",
    unitMix: "",
    marketed: "",
    operator: "",
    structure: "",
  };
}

function parseFill(raw: string, files: string[], dossier: string): FolderFill | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as {
    name?: unknown;
    identity?: unknown;
    answers?: unknown;
  };
  const identity = emptyIdentity();
  if (record.identity && typeof record.identity === "object") {
    for (const key of IDENTITY_KEYS) {
      const value = (record.identity as Record<string, unknown>)[key];
      if (typeof value === "string") {
        const trimmed = value.trim().slice(0, 240);
        identity[key] = key === "unitMix" ? formatUnitMix(trimmed) : trimmed;
      }
    }
  }
  if (!Array.isArray(record.answers)) return null;
  const seen = new Set<number>();
  const answers: FolderAnswer[] = [];
  for (const item of record.answers) {
    if (!item || typeof item !== "object") continue;
    const row = item as { id?: unknown; answer?: unknown; file?: unknown; evidence?: unknown };
    const id = typeof row.id === "number" ? row.id : Number(row.id);
    if (!Number.isInteger(id) || id < 1 || id > 38 || seen.has(id)) continue;
    if (row.answer !== "Yes" && row.answer !== "No" && row.answer !== "NA") continue;
    seen.add(id);
    const file = typeof row.file === "string" ? row.file.trim() : "";
    const evidence = typeof row.evidence === "string" ? row.evidence.trim() : "";
    answers.push({
      id,
      answer: row.answer,
      evidence: citeEvidence(files, dossier, row.answer, file, evidence),
    });
  }
  if (answers.length === 0) return null;
  return {
    name: typeof record.name === "string" ? record.name.trim().slice(0, 120) : "",
    identity,
    answers,
  };
}

export async function reviewDossier(
  dossier: string,
  files: string[],
  questions: { id: number; text: string }[],
): Promise<{ ok: true; fill: FolderFill } | { ok: false; error: string }> {
  try {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Grok is not available in this environment." };
    const schemaFormat = {
      type: "json_schema",
      json_schema: { name: "qhcp_matrix", strict: true, schema: SCHEMA },
    };
    let content = await complete(apiKey, dossier, files, questions, schemaFormat);
    let fill = content ? parseFill(content, files, dossier) : null;
    if (!fill) {
      content = await complete(apiKey, dossier, files, questions, { type: "json_object" });
      fill = content ? parseFill(content, files, dossier) : null;
    }
    if (!fill) return { ok: false, error: "Grok did not return answers that could be applied." };
    return { ok: true, fill };
  } catch (error) {
    console.error("fill failed", error);
    const message = error instanceof Error ? error.message : "Grok could not review that material.";
    return { ok: false, error: message };
  }
}

export function mergeFills(current: FolderFill | null, incoming: FolderFill): FolderFill {
  if (!current) return incoming;
  const byId = new Map(current.answers.map((row) => [row.id, row]));
  for (const row of incoming.answers) {
    const previous = byId.get(row.id);
    const incomingUseful = row.answer !== "NA" && row.evidence.length > 0;
    const previousEmpty = !previous || previous.answer === "NA" || previous.evidence.length === 0;
    if (!previous || (previous.answer === "NA" && row.answer !== "NA") || (previousEmpty && incomingUseful)) {
      byId.set(row.id, row);
    }
  }
  const identity = { ...current.identity };
  for (const key of IDENTITY_KEYS) {
    if (!identity[key] && incoming.identity[key]) identity[key] = incoming.identity[key];
  }
  return {
    name: current.name || incoming.name,
    identity,
    answers: [...byId.values()].sort((a, b) => a.id - b.id),
  };
}

async function complete(
  apiKey: string,
  dossier: string,
  files: string[],
  questions: { id: number; text: string }[],
  responseFormat: unknown,
) {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0,
      max_tokens: 5000,
      messages: [
        {
          role: "system",
          content:
            "You review senior-living diligence files for a qualified health care property matrix under IRC section 856(e)(6)(D). Answer only from the uploaded text. Do not treat silence as a fact. Yes means the statement is true. No means the files show it is false. NA means the files do not address it. Do not flip an answer because it would help or hurt QHCP status. Answer each numbered question exactly as it is written in the user message, including questions that have been edited. For every Yes or No, set file to the exact file label from the --- filename --- header of the section the quotation was copied from. When that label is a web address, use the address of that exact page, not the homepage or a section index, unless the quotation appears only there. Set evidence to one short direct quotation copied from that same page, not a paraphrase. Use the single shortest sentence, or the shortest clause of a long sentence, that supports the answer. Do not quote a paragraph, a list, or surrounding sentences. Keep the quotation under 40 words. Do not leave file blank on a Yes or No. For NA, set file and evidence to empty strings. Also fill name and every facility-identity field the text supports. Those fields are part of the review. Use a short factual phrase, not a sentence. Leave a field empty only when the text is silent. Do not guess. Return every factor id from 1 through 38 exactly once.",
        },
        {
          role: "user",
          content: `File labels:\n${files.map((file) => `- ${file}`).join("\n")}\n\nFacility identity, from the text, before the numbered questions. Use an empty string only when the text is silent:\n- name: community or facility name\n- jurisdiction: state, and city if stated\n- license: license or state regulatory classification (none, assisted living, SNF, regulated independent living, or other). Use "none" when the text says the community is unlicensed.\n- unitMix: unit counts only, with no other words, in this exact form: "89 IL / 50 AL / 30 MC". Include only the types the text gives a number for, in this order: IL, AL, MC, SNF. Add SNF when a count is stated, as in "89 IL / 50 AL / 30 MC / 20 SNF". Use a percent only when the text gives a percentage and not a count, as in "40% IL / 60% AL". Empty string when no count or percentage is stated.\n- marketed: marketed name or product type\n- operator: who operates or manages the community\n- structure: intended REIT structure only when the text states a lease to a TRS, an eligible independent contractor, or TRS operation\n\nQuestions:\n${factorPrompt(questions)}\n\nUploaded files:\n${dossier}`,
        },
      ],
      response_format: responseFormat,
    }),
  });
  if (!response || typeof response.ok !== "boolean" || !response.ok) {
    const status = response && typeof response.status === "number" ? response.status : "no response";
    console.error("xAI fill failed", status);
    return null;
  }
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return body.choices?.[0]?.message?.content ?? "";
}

export const fillMatrixFromDossier = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Missing dossier.");
    const dossier = (input as { dossier?: unknown }).dossier;
    const files = (input as { files?: unknown }).files;
    if (typeof dossier !== "string" || dossier.trim().length < 40) {
      throw new Error("That folder did not contain enough readable text.");
    }
    if (dossier.length > 80_000) throw new Error("That folder is too large to review in one pass.");
    const labels = Array.isArray(files)
      ? files.filter((file): file is string => typeof file === "string" && file.trim().length > 0).slice(0, 40)
      : [];
    const incoming = (input as { questions?: unknown }).questions;
    const supplied = new Map<number, string>();
    if (Array.isArray(incoming)) {
      for (const item of incoming) {
        if (!item || typeof item !== "object") continue;
        const id = (item as { id?: unknown }).id;
        const text = (item as { text?: unknown }).text;
        if (typeof id !== "number" || !Number.isInteger(id)) continue;
        if (typeof text !== "string") continue;
        const trimmed = text.trim().slice(0, 1200);
        if (trimmed) supplied.set(id, trimmed);
      }
    }
    const questions = FACTORS.map((factor) => ({
      id: factor.id,
      text: supplied.get(factor.id) || factor.text,
    }));
    return { dossier, files: labels, questions };
  })
  .handler(async ({ data }) => {
    return reviewDossier(data.dossier, data.files, data.questions);
  });
