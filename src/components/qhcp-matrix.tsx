import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FolderUp, Globe, Pencil, Plus, Printer, RotateCcw } from "lucide-react";
import { CATEGORIES, FACTORS, IDENTITY_FIELDS, categoryName, citationText, questionText } from "@/lib/qhcp/factors";
import { fillMatrixFromDossier, mergeFills, type FolderFill } from "@/lib/qhcp/fill-matrix";
import { splitEvidence } from "@/lib/qhcp/cite-file";
import { dossierParts, readFolder } from "@/lib/qhcp/read-folder";
import {
  INDICATION_LABEL,
  indication,
  tally,
  type Answer,
  type Indication,
  type PropertyId,
  type PropertyRecord,
} from "@/lib/qhcp/score";
import { useMatrix } from "@/lib/qhcp/use-matrix";
import { combPropertyWebsite } from "@/lib/qhcp/comb-website";
import { publicUrl, webpageUrl } from "@/lib/qhcp/website";
import { PrintReport } from "@/components/print-report";
import { downloadMatrixWorkbook } from "@/lib/qhcp/export-excel";

const ANSWERS: Answer[] = ["Yes", "No", "NA"];

function answerClass(option: Answer, selected: boolean) {
  if (!selected) return "border-rule bg-surface text-muted hover:border-ink hover:text-ink";
  if (option === "Yes") return "border-forest bg-forest text-paper";
  if (option === "No") return "border-rust bg-rust text-paper";
  return "border-ink bg-ink text-paper";
}

function indicationClass(kind: Indication) {
  if (kind === "leans-qhcp") return "bg-forest-soft text-forest";
  if (kind === "leans-not") return "bg-rust-soft text-rust";
  return "bg-field text-ink";
}

function AnswerToggle({
  value,
  label,
  onChange,
}: {
  value: Answer | undefined;
  label: string;
  onChange: (next: Answer | null) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1" role="group" aria-label={label}>
      {ANSWERS.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            className={`min-h-11 rounded-sm border text-sm font-semibold transition-colors ${answerClass(option, selected)}`}
            onClick={() => onChange(selected ? null : option)}
          >
            {option === "NA" ? "N/A" : option}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  value,
  onChange,
  label,
  mono,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      aria-label={label}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-sm border border-rule bg-field px-2 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-forest ${mono ? "font-semibold" : ""}`}
    />
  );
}

function columnHidden(id: PropertyId, active: PropertyId) {
  return id === active ? "" : "hidden lg:block";
}

export function QhcpMatrix() {
  const matrix = useMatrix();
  const { state } = matrix;
  const visibleIds = state.order.filter((id) => !state.hidden.includes(id) && state.properties[id]);
  const hiddenIds = state.hidden.filter((id) => state.properties[id]);
  const gridStyle = { "--cols": String(visibleIds.length) } as React.CSSProperties;
  const canHide = visibleIds.length > 1;
  const canRemove = state.order.length > 1;
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [pendingClear, setPendingClear] = useState<PropertyId | null>(null);
  const [pendingRemove, setPendingRemove] = useState<PropertyId | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [exportKind, setExportKind] = useState<"pdf" | "excel">("pdf");
  const [exportError, setExportError] = useState<string | null>(null);
  const exportRoot = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<PropertyId[]>(["a", "b", "c"]);
  const [printJob, setPrintJob] = useState<{ ids: PropertyId[]; title: string } | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [folderProperty, setFolderProperty] = useState<PropertyId>("a");
  const [folderStatus, setFolderStatus] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderProgress, setFolderProgress] = useState<{ value: number; max: number; label: string } | null>(null);
  const [siteBusy, setSiteBusy] = useState<PropertyId | null>(null);
  const [siteNote, setSiteNote] = useState<{ id: PropertyId; text: string } | null>(null);
  const [editingQuestions, setEditingQuestions] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);

  const visibleKey = visibleIds.join("|");

  useEffect(() => {
    if (!matrix.ready) return;
    setPicked((current) => {
      const kept = current.filter((id) => visibleIds.includes(id));
      if (kept.length === current.length) return current;
      return kept.length > 0 ? kept : visibleIds;
    });
    setFolderProperty((current) => (visibleIds.includes(current) ? current : visibleIds[0]));
  }, [matrix.ready, visibleKey]);

  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
    folderInput.current?.setAttribute("directory", "");
  }, [folderOpen]);

  useEffect(() => {
    if (!printJob) return;
    let cancelled = false;
    const previousTitle = document.title;
    document.title = `QHCP — ${printJob.title}`;
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) window.print();
    });
    const finish = () => {
      if (cancelled) return;
      document.title = previousTitle;
      setPrintJob(null);
      setPrintOpen(false);
    };
    window.addEventListener("afterprint", finish);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", finish);
      document.title = previousTitle;
    };
  }, [printJob]);

  useEffect(() => {
    if (!exportMenu) return;
    const close = (event: MouseEvent) => {
      if (!exportRoot.current?.contains(event.target as Node)) setExportMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportMenu]);

  const visibleFactors = useMemo(() => {
    if (!unansweredOnly) return FACTORS;
    return FACTORS.filter((factor) => {
      const answer = state.properties[state.active].answers[factor.id];
      return answer !== "Yes" && answer !== "No";
    });
  }, [unansweredOnly, state.active, state.properties]);

  const scores = useMemo(() => {
    return visibleIds.map((id) => {
      const counts = tally(state.properties[id]);
      return { id, counts, kind: indication(counts) };
    });
  }, [state.order, state.hidden, state.properties]);

  async function onFolder(event: React.ChangeEvent<HTMLInputElement>) {
    const list = event.target.files ? [...event.target.files] : [];
    event.target.value = "";
    if (list.length === 0 || folderBusy) return;
    setFolderBusy(true);
    setFolderError(null);
    setFolderProgress({ value: 0, max: 1, label: "Reading the folder…" });
    setFolderStatus("Reading the folder…");
    try {
      const read = await readFolder(list, (info) => {
        const name = info.name.split("/").pop() || info.name;
        const label = `Reading ${name}`;
        setFolderStatus(label);
        setFolderProgress({ value: info.index, max: Math.max(info.total, 1) * 2, label });
      });
      if (!read.dossier) {
        setFolderStatus(null);
        setFolderError("No readable text in that folder. PDF, Word, Excel, and text files are used. Image-only scans are skipped.");
        return;
      }
      const parts = dossierParts(read.dossier, read.filesRead);
      if (parts.length === 0) {
        setFolderStatus(null);
        setFolderError("No readable text in that folder. PDF, Word, Excel, and text files are used. Image-only scans are skipped.");
        return;
      }
      const questions = FACTORS.map((factor) => ({
        id: factor.id,
        text: questionText(factor, state.questions),
      }));
      let merged: FolderFill | null = null;
      let failure = "";
      let finished = 0;
      for (let start = 0; start < parts.length; start += 4) {
        const group = parts.slice(start, start + 4);
        const names = group.map((part) => part.file.split("/").pop() || part.file);
        const label =
          names.length === 1
            ? `Grok is reading ${names[0]}`
            : `Grok is reading ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
        setFolderStatus(label);
        setFolderProgress({ value: parts.length + finished, max: parts.length * 2, label });
        const result = await fillMatrixFromDossier({
          data: {
            dossier: group.map((part) => part.text).join("\n\n"),
            files: group.map((part) => part.file),
            questions,
          },
        });
        const safe = normalizeFill(result);
        if (!safe.ok) failure = safe.error;
        else merged = mergeFills(merged, safe.fill);
        finished += group.length;
        setFolderProgress({ value: parts.length + finished, max: parts.length * 2, label });
      }
      if (!merged) {
        setFolderStatus(null);
        setFolderError(failure || "Grok did not return an answer. Try the folder again.");
        return;
      }
      matrix.applyFolderFill(folderProperty, merged);
      const yes = merged.answers.filter((row) => row.answer === "Yes").length;
      const no = merged.answers.filter((row) => row.answer === "No").length;
      const na = merged.answers.filter((row) => row.answer === "NA").length;
      const identityCount = Object.values(merged.identity).filter((value) => value.trim()).length;
      const extra = read.filesSkipped > 0 ? ` ${read.filesSkipped} files were skipped.` : "";
      const missed = failure ? " One batch could not be read." : "";
      const profile = identityCount > 0 ? ` Filled ${identityCount} identity field${identityCount === 1 ? "" : "s"}.` : "";
      setFolderStatus(`Filled ${yes} Yes, ${no} No, and ${na} N/A.${profile}${extra}${missed} Review the evidence notes.`);
    } catch (error) {
      setFolderStatus(null);
      setFolderError(error instanceof Error ? error.message : "The folder could not be read.");
    } finally {
      setFolderBusy(false);
      setFolderProgress(null);
    }
  }

  async function onComb(id: PropertyId) {
    const website = publicUrl(state.properties[id]?.website ?? "");
    if (!website) {
      setSiteNote({ id, text: "Enter a public website, such as https://example.com." });
      return;
    }
    if (siteBusy || folderBusy) return;
    const label = pageLabel(website);
    setSiteBusy(id);
    setSiteNote({ id, text: `Grok is reading ${label}…` });
    try {
      const result = await combPropertyWebsite({
        data: {
          website,
          questions: FACTORS.map((factor) => ({
            id: factor.id,
            text: questionText(factor, state.questions),
          })),
        },
      });
      if (!result || typeof result !== "object" || typeof (result as { ok?: unknown }).ok !== "boolean") {
        setSiteNote({ id, text: "Grok did not return an answer. Try the site again." });
        return;
      }
      if (!result.ok) {
        setSiteNote({ id, text: result.error });
        return;
      }
      matrix.applyWebsiteFill(id, result.answers, { name: result.name, identity: result.identity });
      const count = result.answers.length;
      const pages = result.pages.length;
      const identityCount = Object.values(result.identity ?? {}).filter((value) => value.trim()).length;
      const profile = identityCount > 0 ? ` Filled ${identityCount} identity field${identityCount === 1 ? "" : "s"}.` : "";
      setSiteNote({
        id,
        text: `Answered ${count} question${count === 1 ? "" : "s"} from ${pages} page${pages === 1 ? "" : "s"} on the website.${profile}`,
      });
    } catch (error) {
      setSiteNote({ id, text: error instanceof Error ? error.message : "The website could not be read." });
    } finally {
      setSiteBusy(null);
    }
  }

  return (
    <div className={printJob ? "is-printing min-h-screen bg-paper text-ink" : "min-h-screen bg-paper text-ink"}>
      <div className="screen-app">
      <header className="border-b border-rule bg-forest text-paper">
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Qualified Health Care Property Matrix
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-paper">
            Mark each factor Yes, No, or N/A.
          </p>
        </div>
      </header>

      <div className="app-toolbar no-print sticky top-0 z-40 border-b border-rule">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {visibleIds.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={state.active === id}
                className={`min-h-11 rounded-sm border px-3 text-sm font-semibold lg:hidden ${
                  state.active === id
                    ? "border-forest bg-forest text-paper"
                    : "border-rule bg-paper text-ink"
                }`}
                onClick={() => matrix.setActive(id)}
              >
                {state.properties[id].name || "Untitled"}
              </button>
            ))}
            <label className="ml-auto flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={unansweredOnly}
                onChange={(event) => setUnansweredOnly(event.target.checked)}
                className="size-4 accent-forest"
              />
              Unanswered only
            </label>
            <div className="relative" ref={exportRoot}>
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-forest bg-forest px-3 text-sm font-semibold text-paper"
                aria-expanded={exportMenu || printOpen}
                aria-haspopup="menu"
                onClick={() => {
                  if (printOpen) {
                    setPrintOpen(false);
                    setExportMenu(false);
                    return;
                  }
                  setExportMenu((open) => !open);
                }}
              >
                <Printer className="size-4" aria-hidden="true" />
                Export
                <ChevronDown className="size-4" aria-hidden="true" />
              </button>
              {exportMenu ? (
                <div role="menu" className="absolute right-0 z-30 mt-1 min-w-48 rounded-sm border border-rule bg-paper py-1 shadow">
                  <button
                    type="button"
                    role="menuitem"
                    className="block min-h-11 w-full px-3 text-left text-sm font-semibold text-ink hover:bg-field"
                    onClick={() => {
                      setExportKind("pdf");
                      setExportError(null);
                      setExportMenu(false);
                      setPrintOpen(true);
                    }}
                  >
                    Print PDF
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="block min-h-11 w-full px-3 text-left text-sm font-semibold text-ink hover:bg-field"
                    onClick={() => {
                      setExportKind("excel");
                      setExportError(null);
                      setExportMenu(false);
                      setPrintOpen(true);
                    }}
                  >
                    Export to Excel
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-rule bg-paper px-3 text-sm font-semibold text-ink"
              aria-expanded={folderOpen}
              onClick={() => setFolderOpen((open) => !open)}
            >
              <FolderUp className="size-4" aria-hidden="true" />
              Fill from folder
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-rule bg-paper px-3 text-sm font-semibold text-ink"
              onClick={() => {
                const id = matrix.addProperty();
                setPicked((current) => [...current, id]);
                setFolderProperty(id);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add property
            </button>
            <button
              type="button"
              aria-pressed={editingQuestions}
              className={`inline-flex min-h-11 items-center gap-2 rounded-sm border px-3 text-sm font-semibold ${
                editingQuestions
                  ? "border-forest bg-forest text-paper"
                  : "border-rule bg-paper text-ink"
              }`}
              onClick={() => setEditingQuestions((open) => !open)}
            >
              <Pencil className="size-4" aria-hidden="true" />
              {editingQuestions ? "Done editing questions" : "Edit matrix questions"}
            </button>
          </div>
          {folderOpen ? (
            <fieldset className="rounded-sm border border-rule bg-paper px-3 py-3">
              <legend className="px-1 text-sm font-semibold">Fill a property from a folder</legend>
              <p className="mt-2 rounded-sm bg-rust px-3 py-2 text-sm font-semibold text-paper">
                Warning: Do not upload confidential files
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={folderProperty === id}
                    className={`min-h-11 rounded-sm border px-3 text-sm font-semibold ${
                      folderProperty === id
                        ? "border-forest bg-forest text-paper"
                        : "border-rule bg-surface text-ink"
                    }`}
                    onClick={() => setFolderProperty(id)}
                  >
                    {state.properties[id].name || "Untitled"}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <button
                  type="button"
                  className="min-h-11 rounded-sm border border-forest bg-forest px-3 text-sm font-semibold text-paper disabled:opacity-40"
                  disabled={folderBusy}
                  onClick={() => {
                    const input = folderInput.current;
                    if (!input) return;
                    input.setAttribute("webkitdirectory", "");
                    input.setAttribute("directory", "");
                    input.click();
                  }}
                >
                  {folderBusy ? "Working…" : "Choose folder"}
                </button>
                <a
                  href="/samples/willowbrook-at-hanover.zip"
                  download="willowbrook-at-hanover.zip"
                  className="ml-3 inline-flex min-h-11 items-center text-sm font-semibold text-forest underline"
                >
                  Download the Willowbrook sample folder
                </a>
                <input
                  ref={folderInput}
                  type="file"
                  className="sr-only"
                  multiple
                  onChange={onFolder}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                Grok reads PDF, Word, Excel, and text files in the folder and answers each factor for the selected property. Evidence is a short quotation from the file. Click a quote that does not fit to expand it, and click again to close it. Silence in the files is N/A, not a No. Existing answers for that property are replaced.
              </p>
              {folderStatus ? <p className="mt-2 text-sm text-ink">{folderStatus}</p> : null}
              {folderProgress ? (
                <div
                  className="mt-2 h-2 overflow-hidden rounded-sm bg-rule"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={folderProgress.max}
                  aria-valuenow={folderProgress.value}
                  aria-label={folderProgress.label}
                >
                  <div
                    className="h-full bg-forest transition-[width] duration-300"
                    style={{
                      width: `${folderProgress.max === 0 ? 0 : Math.min(100, Math.round((folderProgress.value / folderProgress.max) * 100))}%`,
                    }}
                  />
                </div>
              ) : null}
              {folderError ? <p className="mt-2 text-sm text-rust">{folderError}</p> : null}
            </fieldset>
          ) : null}
          {printOpen ? (
            <fieldset className="rounded-sm border border-rule bg-paper px-3 py-3">
              <legend className="px-1 text-sm font-semibold">
                {exportKind === "excel" ? "Properties in the Excel file" : "Properties in the PDF"}
              </legend>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                {visibleIds.map((id) => (
                  <label key={id} className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-forest"
                      checked={picked.includes(id)}
                      onChange={() =>
                        setPicked((current) =>
                          current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
                        )
                      }
                    />
                    {state.properties[id].name || "Untitled"}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-sm border border-rule bg-surface px-3 text-sm font-semibold"
                  onClick={() => setPicked([...visibleIds])}
                >
                  All properties
                </button>
                <button
                  type="button"
                  disabled={picked.length === 0}
                  className="min-h-11 rounded-sm border border-forest bg-forest px-3 text-sm font-semibold text-paper disabled:opacity-40"
                  onClick={() => {
                    const ids = visibleIds.filter((id) => picked.includes(id));
                    const title = ids
                      .map((id) => state.properties[id].name.trim() || "Untitled")
                      .join(", ");
                    setExportError(null);
                    if (exportKind === "excel") {
                      void downloadMatrixWorkbook({
                        properties: state.properties,
                        ids,
                        questions: state.questions,
                        citations: state.citations,
                        categories: state.categories,
                      }).catch(() => setExportError("The Excel file could not be saved."));
                      return;
                    }
                    setPrintJob({ ids, title });
                  }}
                >
                  {exportKind === "excel" ? "Download Excel" : "Save as PDF"}
                </button>
              </div>
              <p className="mt-2 text-sm text-muted">
                {exportKind === "excel"
                  ? "Downloads a workbook with the factor matrix and a sheet of Yes/No answers for the selected properties."
                  : "Opens the print dialog. Choose Save as PDF. The file includes the factor matrix for each selected property, then a page of Yes/No answers side by side."}
              </p>
              {exportError ? <p className="mt-2 text-sm text-rust">{exportError}</p> : null}
            </fieldset>
          ) : null}
          {hiddenIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Hidden</p>
              {hiddenIds.map((id) => (
                <div key={id} className="flex items-center gap-1 rounded-sm border border-rule bg-paper px-2">
                  <span className="text-sm">{state.properties[id].name || "Untitled"}</span>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-sm font-semibold text-forest"
                    onClick={() => matrix.showProperty(id)}
                  >
                    Show
                  </button>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-sm font-semibold text-rust"
                    disabled={!canRemove}
                    onClick={() => {
                      matrix.removeProperty(id);
                      setPicked((current) => current.filter((item) => item !== id));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <p className="shrink-0 text-sm font-semibold">Jump to Category</p>
            <nav className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" aria-label="Categories">
            {CATEGORIES.map((category) => (
              <a
                key={category}
                href={`#${categoryId(category)}`}
                className="shrink-0 rounded-sm border border-rule bg-paper px-3 py-2 text-sm text-ink hover:border-forest"
              >
                {jumpLabel(category, state.categories)}
              </a>
            ))}
            </nav>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl overflow-x-auto px-4 pb-52 pt-4 lg:px-6 lg:pb-44">
        <section aria-label="Facility identity" className="overflow-x-auto rounded-sm bg-surface ring-1 ring-rule ring-inset">
          <div
            className="matrix-grid grid grid-cols-1 border-b border-rule bg-ink text-paper lg:gap-3"
            style={gridStyle}
          >
            <div className="px-4 py-3 text-sm font-semibold lg:col-span-3">Facility identity</div>
            {visibleIds.map((id) => (
              <div key={id} className={`px-2 py-2 lg:px-0 ${columnHidden(id, state.active)}`}>
                <Field
                  mono
                  label={`Name of ${state.properties[id].name}`}
                  value={state.properties[id].name}
                  onChange={(value) => matrix.setName(id, value)}
                />
                <div className="mt-1 flex flex-wrap gap-x-2">
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1 text-sm text-field hover:text-paper"
                    onClick={() => {
                      if (pendingClear === id) {
                        matrix.clearProperty(id);
                        setPendingClear(null);
                      } else {
                        setPendingClear(id);
                        setPendingRemove(null);
                      }
                    }}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {pendingClear === id ? "Confirm clear" : "Clear"}
                  </button>
                  <button
                    type="button"
                    className="min-h-11 text-sm text-field hover:text-paper disabled:opacity-40"
                    disabled={!canHide}
                    onClick={() => matrix.hideProperty(id)}
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    className="min-h-11 text-sm text-field hover:text-paper disabled:opacity-40"
                    disabled={!canRemove}
                    onClick={() => {
                      if (pendingRemove === id) {
                        matrix.removeProperty(id);
                        setPicked((current) => current.filter((item) => item !== id));
                        setPendingRemove(null);
                      } else {
                        setPendingRemove(id);
                        setPendingClear(null);
                      }
                    }}
                  >
                    {pendingRemove === id ? "Confirm remove" : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {IDENTITY_FIELDS.map((field) => (
            <div
              key={field.key}
              className="matrix-grid grid grid-cols-1 border-b border-rule last:border-b-0 lg:gap-3"
              style={gridStyle}
            >
              <div className="px-4 py-3 text-sm font-medium leading-snug lg:col-span-3">{field.label}</div>
              {visibleIds.map((id) => (
                <div key={id} className={`px-2 py-2 lg:px-0 ${columnHidden(id, state.active)}`}>
                  <Field
                    label={`${field.label} — ${state.properties[id].name}`}
                    value={state.properties[id].identity[field.key]}
                    onChange={(value) => matrix.setIdentity(id, field.key, value)}
                  />
                </div>
              ))}
            </div>
          ))}
          <div className="matrix-grid grid grid-cols-1 border-t border-rule lg:gap-3" style={gridStyle}>
            <div className="px-4 py-3 text-sm font-medium leading-snug lg:col-span-3">Website</div>
            {visibleIds.map((id) => {
              const property = state.properties[id];
              const answered = websiteAnswerCount(property);
              const note = siteNote?.id === id ? siteNote.text : "";
              return (
                <div key={id} className={`px-2 py-2 lg:px-0 ${columnHidden(id, state.active)}`}>
                  <Field
                    label={`Website for ${property.name}`}
                    value={property.website ?? ""}
                    placeholder="https://"
                    onChange={(value) => matrix.setWebsite(id, value)}
                  />
                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-sm border border-forest bg-forest px-3 text-sm font-semibold text-paper disabled:opacity-40"
                    disabled={siteBusy !== null || folderBusy}
                    onClick={() => onComb(id)}
                  >
                    <Globe className="size-4" aria-hidden="true" />
                    {siteBusy === id ? "Reading…" : "Comb website"}
                  </button>
                  {answered > 0 ? (
                    <p className="mt-1 text-sm text-ink">
                      {answered} question{answered === 1 ? "" : "s"} answered from the website
                    </p>
                  ) : null}
                  {note ? <p className="mt-1 text-sm text-muted">{note}</p> : null}
                </div>
              );
            })}
          </div>
        </section>

        <div
          className="matrix-grid mt-6 hidden gap-3 border-b border-rule pb-2 text-sm font-semibold text-muted lg:grid"
          style={gridStyle}
        >
          <span>#</span>
          <span>Factor</span>
          <span>Direction</span>
          {visibleIds.map((id) => (
            <span key={id} className="truncate">
              {state.properties[id].name}
            </span>
          ))}
        </div>

        {CATEGORIES.map((category) => {
          const rows = visibleFactors.filter((factor) => factor.category === category);
          if (rows.length === 0) return null;
          return (
            <section key={category} id={categoryId(category)} className="mt-6 scroll-mt-36">
              <div className="border-b border-forest pb-2">
                {editingQuestions ? (
                  <input
                    aria-label={`Category ${category}`}
                    value={state.categories[category] ?? category}
                    onChange={(event) => matrix.setCategory(category, event.target.value)}
                    onBlur={(event) => {
                      if (!event.target.value.trim()) matrix.setCategory(category, category);
                    }}
                    className="w-full rounded-sm border border-rule bg-field px-2 py-1 font-serif text-xl text-forest outline-none focus:border-forest"
                  />
                ) : (
                  <h2 className="font-serif text-xl text-forest">{categoryName(category, state.categories)}</h2>
                )}
              </div>
              <ul>
                {rows.map((factor) => (
                  <li
                    key={factor.id}
                    className="matrix-grid grid grid-cols-1 gap-3 border-b border-rule py-4 lg:gap-3"
                    style={gridStyle}
                  >
                    <div className="text-sm font-semibold text-muted">{factor.id}</div>
                    <div>
                      {editingQuestions ? (
                        <textarea
                          aria-label={`Question ${factor.id}`}
                          value={state.questions[factor.id] ?? factor.text}
                          rows={3}
                          onChange={(event) => matrix.setQuestion(factor.id, event.target.value)}
                          onBlur={(event) => {
                            if (!event.target.value.trim()) matrix.setQuestion(factor.id, factor.text);
                          }}
                          className="min-h-16 w-full resize-y rounded-sm border border-rule bg-field px-2 py-2 text-sm leading-relaxed text-ink outline-none focus:border-forest"
                        />
                      ) : (
                        <p className="text-sm leading-relaxed">{questionText(factor, state.questions)}</p>
                      )}
                      {editingQuestions ? (
                        <input
                          aria-label={`Citation ${factor.id}`}
                          value={state.citations[factor.id] ?? factor.hook}
                          onChange={(event) => matrix.setCitation(factor.id, event.target.value)}
                          onBlur={(event) => {
                            if (!event.target.value.trim()) matrix.setCitation(factor.id, factor.hook);
                          }}
                          className="mt-1 w-full rounded-sm border border-rule bg-field px-2 py-1 text-sm text-muted outline-none focus:border-forest"
                        />
                      ) : citationText(factor, state.citations) ? (
                        <p className="mt-1 text-sm text-muted">{citationText(factor, state.citations)}</p>
                      ) : null}
                    </div>
                    <div>
                      <span
                        className={`inline-flex rounded-sm px-2 py-1 text-sm font-semibold ${
                          factor.direction === "support"
                            ? "bg-forest-soft text-forest"
                            : "bg-rust-soft text-rust"
                        }`}
                      >
                        {factor.direction === "support" ? "Supports" : "Cuts against"}
                      </span>
                    </div>
                    {visibleIds.map((id) => (
                      <PropertyAnswer
                        key={id}
                        id={id}
                        active={state.active}
                        factorId={factor.id}
                        property={state.properties[id]}
                        onAnswer={(answer) => matrix.setAnswer(id, factor.id, answer)}
                        onNote={(note) => matrix.setNote(id, factor.id, note)}
                      />
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {visibleFactors.length === 0 ? (
          <p className="mt-8 text-sm text-muted">Every factor on the selected property has a Yes or No.</p>
        ) : null}
      </main>

      <section
        aria-label="Tally and preliminary indication"
        className="scorebar fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-surface"
      >
        <div className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-4 py-3 lg:px-6">
          {scores.map(({ id, counts, kind }) => (
            <div key={id} className={`min-w-56 flex-1 ${columnHidden(id, state.active)}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-semibold">{state.properties[id].name}</p>
                <p className="shrink-0 text-sm text-muted">
                  S {counts.supportYes} · C {counts.contraryYes}
                </p>
              </div>
              <p className={`mt-1 rounded-sm px-2 py-1 text-sm font-semibold leading-snug ${indicationClass(kind)}`}>
                {INDICATION_LABEL[kind]}
              </p>
              <p className="mt-1 text-sm text-muted">
                Support No {counts.supportNo} · Contrary No {counts.contraryNo} · Blank/N/A {counts.excluded}
              </p>
            </div>
          ))}
        </div>
        <p className="mx-auto hidden max-w-7xl px-6 pb-2 text-sm text-muted lg:block">
          S ≥ 8 and C ≤ 3 leans QHCP. C ≥ 6 and S ≤ 4 leans not a health care facility. Otherwise indeterminate.
        </p>
      </section>
      </div>
      <PrintReport
        properties={state.properties}
        ids={(printJob?.ids ?? picked).filter((id) => state.properties[id])}
        active={printJob !== null}
        questions={state.questions}
        citations={state.citations}
        categories={state.categories}
      />
    </div>
  );
}

function EvidenceNote({
  value,
  source,
  label,
  onChange,
}: {
  value: string;
  source: string;
  label: string;
  onChange: (note: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const { file, quote } = splitEvidence(value);
  const page = webpageUrl(source) || webpageUrl(file);

  useEffect(() => {
    const field = inputRef.current;
    if (!field || field.clientWidth === 0) return;
    setOverflows(field.scrollWidth > field.clientWidth + 1);
  }, [value, open]);

  if (open && value) {
    return (
      <div className="mt-2">
        <button
          type="button"
          aria-expanded="true"
          aria-label={label}
          onClick={() => setOpen(false)}
          className="w-full rounded-sm border border-forest bg-field px-2 py-2 text-left text-sm text-ink"
        >
          {file && !page ? <span className="block font-semibold">{file}</span> : null}
          <span className="mt-1 block whitespace-pre-wrap">{quote || value}</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        aria-label={label}
        aria-expanded={overflows ? false : undefined}
        placeholder="Evidence"
        readOnly={overflows}
        value={quote || (page ? "" : value)}
        onClick={() => {
          if (overflows) setOpen(true);
        }}
        onChange={(event) => onChange(file ? `${file}: ${event.target.value}` : event.target.value)}
        className={`mt-2 w-full rounded-sm border border-rule bg-field px-2 py-2 text-sm text-ink outline-none focus:border-forest ${overflows ? "cursor-pointer truncate" : ""}`}
      />
    </div>
  );
}

function PropertyAnswer({
  id,
  active,
  factorId,
  property,
  onAnswer,
  onNote,
}: {
  id: PropertyId;
  active: PropertyId;
  factorId: number;
  property: PropertyRecord;
  onAnswer: (answer: Answer | null) => void;
  onNote: (note: string) => void;
}) {
  const note = property.notes[factorId] ?? "";
  const { file } = splitEvidence(note);
  const page = webpageUrl(property.sources?.[factorId] ?? "") || webpageUrl(file);
  const answer = property.answers[factorId];
  return (
    <div className={columnHidden(id, active)}>
      <AnswerToggle
        value={answer}
        label={`${property.name}, factor ${factorId}`}
        onChange={onAnswer}
      />
      {page && (answer === "Yes" || answer === "No") ? (
        <a
          href={page}
          title={page}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 mt-1 block cursor-pointer truncate text-sm text-forest underline"
        >
          {pageLabel(page)}
        </a>
      ) : null}
      <EvidenceNote
        value={note}
        source={property.sources?.[factorId] ?? ""}
        label={`Evidence, ${property.name}, factor ${factorId}`}
        onChange={onNote}
      />
    </div>
  );
}

function pageLabel(url: string) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

function websiteAnswerCount(property: PropertyRecord) {
  return Object.entries(property.sources ?? {}).filter(([id, url]) => {
    const answer = property.answers[Number(id)];
    return Boolean(url) && (answer === "Yes" || answer === "No");
  }).length;
}

function normalizeFill(result: unknown): { ok: true; fill: FolderFill } | { ok: false; error: string } {
  if (!result || typeof result !== "object" || typeof (result as { ok?: unknown }).ok !== "boolean") {
    return { ok: false, error: "Grok did not return an answer. Try the folder again." };
  }
  const record = result as { ok: boolean; error?: unknown; fill?: FolderFill };
  if (!record.ok) {
    return {
      ok: false,
      error: typeof record.error === "string" && record.error ? record.error : "Grok did not return an answer. Try the folder again.",
    };
  }
  if (!record.fill || !Array.isArray(record.fill.answers)) {
    return { ok: false, error: "Grok did not return an answer. Try the folder again." };
  }
  return { ok: true, fill: record.fill };
}

function categoryId(category: string) {
  return `cat-${category.slice(0, 1).toLowerCase()}`;
}

function jumpLabel(category: string, categories: Partial<Record<string, string>>) {
  const custom = categories[category];
  if (typeof custom === "string" && custom.trim() && custom.trim() !== category) return custom.trim();
  return shortCategory(category);
}

function shortCategory(category: string) {
  const names: Record<string, string> = {
    A: "Licensing",
    B: "Contracts",
    C: "Clinical",
    D: "Amenities",
    E: "Mixed-use",
    F: "Third parties",
  };
  return names[category.slice(0, 1)] ?? category;
}
