import { FACTORS, type IdentityKey } from "./factors";

export type Answer = "Yes" | "No" | "NA";

export type PropertyId = string;

export type PropertyRecord = {
  name: string;
  website: string;
  identity: Record<IdentityKey, string>;
  answers: Partial<Record<number, Answer>>;
  notes: Partial<Record<number, string>>;
  sources: Partial<Record<number, string>>;
};

export type MatrixState = {
  order: PropertyId[];
  hidden: PropertyId[];
  active: PropertyId;
  questions: Partial<Record<number, string>>;
  citations: Partial<Record<number, string>>;
  categories: Partial<Record<string, string>>;
  properties: Record<PropertyId, PropertyRecord>;
};

const EMPTY_IDENTITY: Record<IdentityKey, string> = {
  jurisdiction: "",
  license: "",
  unitMix: "",
  marketed: "",
  operator: "",
  structure: "",
};

export function emptyProperty(name: string): PropertyRecord {
  return { name, website: "", identity: { ...EMPTY_IDENTITY }, answers: {}, notes: {}, sources: {} };
}

export function defaultState(): MatrixState {
  return {
    order: ["a", "b", "c"],
    hidden: [],
    active: "a",
    questions: {},
    citations: {},
    categories: {},
    properties: {
      a: emptyProperty("Property A"),
      b: emptyProperty("Property B"),
      c: emptyProperty("Property C"),
    },
  };
}

export type Tally = {
  supportYes: number;
  contraryYes: number;
  supportNo: number;
  contraryNo: number;
  excluded: number;
};

export type Indication =
  | "incomplete"
  | "leans-qhcp"
  | "leans-not"
  | "indeterminate";

export function tally(property: PropertyRecord): Tally {
  let supportYes = 0;
  let contraryYes = 0;
  let supportNo = 0;
  let contraryNo = 0;
  let excluded = 0;
  for (const factor of FACTORS) {
    const answer = property.answers[factor.id];
    if (answer !== "Yes" && answer !== "No") {
      excluded += 1;
      continue;
    }
    if (factor.direction === "support") {
      if (answer === "Yes") supportYes += 1;
      else supportNo += 1;
    } else if (answer === "Yes") contraryYes += 1;
    else contraryNo += 1;
  }
  return { supportYes, contraryYes, supportNo, contraryNo, excluded };
}

export function indication(t: Tally): Indication {
  if (t.supportYes === 0 && t.contraryYes === 0) return "incomplete";
  if (t.supportYes >= 8 && t.contraryYes <= 3) return "leans-qhcp";
  if (t.contraryYes >= 6 && t.supportYes <= 4) return "leans-not";
  return "indeterminate";
}

export const INDICATION_LABEL: Record<Indication, string> = {
  incomplete: "Incomplete — enter Yes/No above",
  "leans-qhcp": "Leans QHCP (congregate care / health care facility)",
  "leans-not": "Leans NOT a health care facility",
  indeterminate: "Indeterminate — facts and circumstances required",
};
