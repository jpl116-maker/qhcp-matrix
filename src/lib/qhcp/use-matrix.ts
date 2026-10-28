import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, FACTORS, type IdentityKey } from "./factors";
import type { FolderFill } from "./fill-matrix";
import type { WebsiteAnswer } from "./comb-website";
import {
  defaultState,
  emptyProperty,
  type Answer,
  type MatrixState,
  type PropertyId,
  type PropertyRecord,
} from "./score";

const STORAGE_KEY = "qhcp-matrix-v1";

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

function reviveProperty(incoming: unknown, fallbackName: string): PropertyRecord | null {
  if (!incoming || typeof incoming !== "object") return null;
  const record = incoming as Partial<PropertyRecord>;
  const property = emptyProperty(
    typeof record.name === "string" && record.name.trim() ? record.name : fallbackName,
  );
  if (typeof record.website === "string") property.website = record.website.trim().slice(0, 400);
  if (record.identity && typeof record.identity === "object") {
    for (const key of Object.keys(property.identity) as IdentityKey[]) {
      const value = record.identity[key];
      if (typeof value === "string") property.identity[key] = value;
    }
  }
  if (record.answers && typeof record.answers === "object") {
    for (const [key, value] of Object.entries(record.answers)) {
      if (value === "Yes" || value === "No" || value === "NA") property.answers[Number(key)] = value;
    }
  }
  if (record.notes && typeof record.notes === "object") {
    for (const [key, value] of Object.entries(record.notes)) {
      if (typeof value === "string") property.notes[Number(key)] = value;
    }
  }
  if (record.sources && typeof record.sources === "object") {
    for (const [key, value] of Object.entries(record.sources)) {
      if (typeof value === "string" && /^https?:\/\//i.test(value)) property.sources[Number(key)] = value.slice(0, 400);
    }
  }
  return property;
}

function reviveQuestions(raw: unknown): Partial<Record<number, string>> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const questions: Partial<Record<number, string>> = {};
  for (const factor of FACTORS) {
    const value = source[String(factor.id)];
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (!text || text === factor.text) continue;
    questions[factor.id] = text.slice(0, 1200);
  }
  return questions;
}

function reviveCitations(raw: unknown): Partial<Record<number, string>> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const citations: Partial<Record<number, string>> = {};
  for (const factor of FACTORS) {
    const value = source[String(factor.id)];
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (!text || text === factor.hook) continue;
    citations[factor.id] = text.slice(0, 400);
  }
  return citations;
}

function reviveCategories(raw: unknown): Partial<Record<string, string>> {
  if (!raw || typeof raw !== "object") return {};
  const source = raw as Record<string, unknown>;
  const categories: Partial<Record<string, string>> = {};
  for (const category of CATEGORIES) {
    const value = source[category];
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (!text || text === category) continue;
    categories[category] = text.slice(0, 160);
  }
  return categories;
}

function revive(raw: unknown): MatrixState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const parsed = raw as {
    active?: unknown;
    order?: unknown;
    hidden?: unknown;
    questions?: unknown;
    citations?: unknown;
    categories?: unknown;
    properties?: unknown;
  };
  if (!parsed.properties || typeof parsed.properties !== "object") return base;
  const source = parsed.properties as Record<string, unknown>;
  const storedOrder = Array.isArray(parsed.order)
    ? parsed.order.filter((id): id is string => typeof id === "string" && Boolean(source[id]))
    : [];
  const legacy = ["a", "b", "c"].filter((id) => source[id] && !storedOrder.includes(id));
  const extra = Object.keys(source).filter((id) => !storedOrder.includes(id) && !legacy.includes(id));
  const ids = storedOrder.length > 0 ? [...storedOrder, ...extra] : [...legacy, ...extra];
  if (ids.length === 0) return base;
  const properties: Record<string, PropertyRecord> = {};
  ids.forEach((id, index) => {
    const revived = reviveProperty(source[id], `Property ${index + 1}`);
    if (revived) properties[id] = revived;
  });
  const order = ids.filter((id) => properties[id]);
  if (order.length === 0) return base;
  let hidden = Array.isArray(parsed.hidden)
    ? parsed.hidden.filter((id): id is string => typeof id === "string" && order.includes(id))
    : [];
  let visible = order.filter((id) => !hidden.includes(id));
  if (visible.length === 0) {
    hidden = hidden.filter((id) => id !== order[0]);
    visible = [order[0]];
  }
  const active = typeof parsed.active === "string" && visible.includes(parsed.active) ? parsed.active : visible[0];
  return {
    order,
    hidden,
    active,
    questions: reviveQuestions(parsed.questions),
    citations: reviveCitations(parsed.citations),
    categories: reviveCategories(parsed.categories),
    properties,
  };
}

export function useMatrix() {
  const [state, setState] = useState<MatrixState>(defaultState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(revive(JSON.parse(raw)));
    } catch {
      /* keep defaults */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const setQuestion = useCallback((id: number, text: string) => {
    setState((prev) => {
      const original = FACTORS.find((factor) => factor.id === id)?.text ?? "";
      const questions = { ...prev.questions };
      if (text === original) delete questions[id];
      else questions[id] = text.slice(0, 1200);
      return { ...prev, questions };
    });
  }, []);

  const setCitation = useCallback((id: number, text: string) => {
    setState((prev) => {
      const original = FACTORS.find((factor) => factor.id === id)?.hook ?? "";
      const citations = { ...prev.citations };
      if (text === original) delete citations[id];
      else citations[id] = text.slice(0, 400);
      return { ...prev, citations };
    });
  }, []);

  const setCategory = useCallback((category: string, text: string) => {
    setState((prev) => {
      const categories = { ...prev.categories };
      if (text === category) delete categories[category];
      else categories[category] = text.slice(0, 160);
      return { ...prev, categories };
    });
  }, []);

  const setActive = useCallback((id: PropertyId) => {
    setState((prev) => ({ ...prev, active: id }));
  }, []);

  const setName = useCallback((id: PropertyId, name: string) => {
    setState((prev) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [id]: { ...prev.properties[id], name },
      },
    }));
  }, []);

  const setWebsite = useCallback((id: PropertyId, website: string) => {
    setState((prev) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [id]: { ...prev.properties[id], website: website.slice(0, 400) },
      },
    }));
  }, []);

  const setIdentity = useCallback((id: PropertyId, key: IdentityKey, value: string) => {
    setState((prev) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [id]: {
          ...prev.properties[id],
          identity: { ...prev.properties[id].identity, [key]: value },
        },
      },
    }));
  }, []);

  const setAnswer = useCallback((id: PropertyId, factorId: number, answer: Answer | null) => {
    setState((prev) => {
      const answers = { ...prev.properties[id].answers };
      if (answer === null || answers[factorId] === answer) delete answers[factorId];
      else answers[factorId] = answer;
      const sources = { ...(prev.properties[id].sources ?? {}) };
      delete sources[factorId];
      return {
        ...prev,
        properties: {
          ...prev.properties,
          [id]: { ...prev.properties[id], answers, sources },
        },
      };
    });
  }, []);

  const setNote = useCallback((id: PropertyId, factorId: number, note: string) => {
    setState((prev) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [id]: {
          ...prev.properties[id],
          notes: { ...prev.properties[id].notes, [factorId]: note },
        },
      },
    }));
  }, []);

  const applyFolderFill = useCallback((id: PropertyId, fill: FolderFill) => {
    setState((prev) => {
      const current = prev.properties[id];
      const identity = { ...current.identity };
      for (const key of Object.keys(identity) as IdentityKey[]) {
        const value = fill.identity[key]?.trim();
        if (value) identity[key] = value;
      }
      const answers: Partial<Record<number, Answer>> = {};
      const notes: Partial<Record<number, string>> = {};
      for (const row of fill.answers) {
        answers[row.id] = row.answer;
        if (row.evidence) notes[row.id] = row.evidence;
      }
      const name =
        fill.name && (current.name.trim() === "" || /^Property [A-Z0-9]+$/.test(current.name))
          ? fill.name
          : current.name;
      return {
        ...prev,
        active: id,
        properties: {
          ...prev.properties,
          [id]: { ...current, name, identity, answers, notes, sources: {} },
        },
      };
    });
  }, []);

  const applyWebsiteFill = useCallback(
    (id: PropertyId, answersIn: WebsiteAnswer[], profile?: { name?: string; identity?: Partial<Record<IdentityKey, string>> }) => {
    setState((prev) => {
      const current = prev.properties[id];
      if (!current) return prev;
      const answers = { ...current.answers };
      const notes = { ...current.notes };
      const sources: Partial<Record<number, string>> = {};
      for (const row of answersIn) {
        if (row.answer !== "Yes" && row.answer !== "No") continue;
        if (!row.url.startsWith("http")) continue;
        answers[row.id] = row.answer;
        if (row.evidence) notes[row.id] = row.evidence;
        sources[row.id] = row.url;
      }
      const identity = { ...current.identity };
      for (const key of Object.keys(identity) as IdentityKey[]) {
        const value = profile?.identity?.[key]?.trim();
        if (value) identity[key] = value;
      }
      const name =
        profile?.name && (current.name.trim() === "" || /^Property [A-Z0-9]+$/.test(current.name))
          ? profile.name.slice(0, 120)
          : current.name;
      return {
        ...prev,
        active: id,
        properties: {
          ...prev.properties,
          [id]: { ...current, name, identity, answers, notes, sources },
        },
      };
    });
  }, []);

  const clearProperty = useCallback((id: PropertyId) => {
    setState((prev) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [id]: {
          ...prev.properties[id],
          identity: emptyIdentity(),
          answers: {},
          notes: {},
          sources: {},
        },
      },
    }));
  }, []);

  const addProperty = useCallback(() => {
    const id = crypto.randomUUID();
    setState((prev) => ({
      ...prev,
      active: id,
      order: [...prev.order, id],
      properties: {
        ...prev.properties,
        [id]: emptyProperty(`Property ${prev.order.length + 1}`),
      },
    }));
    return id;
  }, []);

  const hideProperty = useCallback((id: PropertyId) => {
    setState((prev) => {
      const visible = prev.order.filter((item) => !prev.hidden.includes(item));
      if (visible.length <= 1 || !visible.includes(id)) return prev;
      const hidden = [...prev.hidden, id];
      const nextVisible = visible.filter((item) => item !== id);
      return {
        ...prev,
        hidden,
        active: nextVisible.includes(prev.active) ? prev.active : nextVisible[0],
      };
    });
  }, []);

  const showProperty = useCallback((id: PropertyId) => {
    setState((prev) => ({
      ...prev,
      hidden: prev.hidden.filter((item) => item !== id),
      active: id,
    }));
  }, []);

  const removeProperty = useCallback((id: PropertyId) => {
    setState((prev) => {
      if (prev.order.length <= 1 || !prev.properties[id]) return prev;
      const order = prev.order.filter((item) => item !== id);
      let hidden = prev.hidden.filter((item) => item !== id);
      const properties = { ...prev.properties };
      delete properties[id];
      let visible = order.filter((item) => !hidden.includes(item));
      if (visible.length === 0) {
        hidden = hidden.filter((item) => item !== order[0]);
        visible = [order[0]];
      }
      return {
        ...prev,
        order,
        hidden,
        properties,
        active: visible.includes(prev.active) ? prev.active : visible[0],
      };
    });
  }, []);

  return {
    state,
    ready,
    setActive,
    setQuestion,
    setCitation,
    setCategory,
    setName,
    setWebsite,
    setIdentity,
    setAnswer,
    setNote,
    clearProperty,
    applyFolderFill,
    applyWebsiteFill,
    addProperty,
    hideProperty,
    showProperty,
    removeProperty,
  };
}
