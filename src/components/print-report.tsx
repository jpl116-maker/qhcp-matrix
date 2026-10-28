import { FACTORS, IDENTITY_FIELDS, categoryName, citationText, questionText } from "@/lib/qhcp/factors";
import { type PropertyId, type PropertyRecord } from "@/lib/qhcp/score";

function answerLabel(value: string | undefined) {
  if (value === "Yes") return "Yes";
  if (value === "No") return "No";
  if (value === "NA") return "N/A";
  return "—";
}

export function PrintReport({
  properties,
  ids,
  active,
  questions,
  citations,
  categories,
}: {
  properties: Record<PropertyId, PropertyRecord>;
  ids: PropertyId[];
  active: boolean;
  questions?: Partial<Record<number, string>>;
  citations?: Partial<Record<number, string>>;
  categories?: Partial<Record<string, string>>;
}) {
  const factors = FACTORS.map((factor) => ({
    ...factor,
    text: questionText(factor, questions),
    hook: citationText(factor, citations),
    category: categoryName(factor.category, categories),
  }));
  const rows = ids.filter((id) => properties[id]);
  const prepared = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const propertyCount = Math.max(rows.length, 1);
  const numberWidth = 5;
  const questionWidth = propertyCount <= 1 ? 62 : propertyCount === 2 ? 48 : propertyCount <= 4 ? 36 : 28;
  const propertyWidth = (100 - numberWidth - questionWidth) / propertyCount;

  return (
    <div className={active ? "print-report is-print-target" : "print-report"} aria-hidden={!active}>
      <header className="border-b border-ink pb-3">
        <p className="text-sm font-semibold">IRC §856(e)(6)(D)</p>
        <h1 className="font-serif text-2xl font-semibold">Qualified health care property</h1>
        <p className="mt-1 text-sm">
          Determination matrix. Prepared {prepared}.{" "}
          {rows.length === 1 ? "One property." : `${rows.length} properties.`}
        </p>
      </header>

      {rows.map((id, index) => {
        const property = properties[id];
        const name = property.name || "Untitled";
        return (
          <section key={id} className={index === 0 ? "mt-6" : "mt-6 break-before-page"}>
            <h2 className="font-serif text-xl">{name}</h2>
            <table className="print-identity mt-2 w-full border-collapse text-sm">
              <colgroup>
                <col style={{ width: "36%" }} />
                <col style={{ width: "64%" }} />
              </colgroup>
              <tbody>
                {IDENTITY_FIELDS.map((field) => (
                  <tr key={field.key}>
                    <th className="w-1/3 border border-ink px-2 py-1 text-left font-semibold">{field.label}</th>
                    <td className="border border-ink px-2 py-1">{property.identity[field.key] || "—"}</td>
                  </tr>
                ))}
                <tr>
                  <th className="w-1/3 border border-ink px-2 py-1 text-left font-semibold">Website</th>
                  <td className="border border-ink px-2 py-1">{property.website || "—"}</td>
                </tr>
              </tbody>
            </table>

            <h3 className="mt-4 text-sm font-semibold">Factor matrix</h3>
            <table className="print-factors mt-2 w-full border-collapse text-sm">
              <colgroup>
                <col style={{ width: "5%" }} />
                <col style={{ width: "42%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="border border-ink px-2 py-1 text-left">#</th>
                  <th className="border border-ink px-2 py-1 text-left">Factor</th>
                  <th className="border border-ink px-2 py-1 text-left">If Yes</th>
                  <th className="border border-ink px-2 py-1 text-left">Answer</th>
                  <th className="border border-ink px-2 py-1 text-left">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {factors.map((factor) => (
                  <tr key={factor.id}>
                    <td className="border border-ink px-2 py-1 align-top">{factor.id}</td>
                    <td className="border border-ink px-2 py-1 align-top">
                      {factor.text}
                      <div className="text-muted">{factor.hook}</div>
                    </td>
                    <td className="border border-ink px-2 py-1 align-top">
                      {factor.direction === "support" ? "Supports" : "Cuts against"}
                    </td>
                    <td className="border border-ink px-2 py-1 align-top">{answerLabel(property.answers[factor.id])}</td>
                    <td className="border border-ink px-2 py-1 align-top">
                      {property.notes[factor.id] || "—"}
                      {(() => {
                        const source = property.sources?.[factor.id];
                        if (!source || !/^https?:\/\//i.test(source)) return null;
                        if (property.answers[factor.id] !== "Yes" && property.answers[factor.id] !== "No") return null;
                        return (
                          <div>
                            <a href={source}>{source}</a>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <section className={rows.length >= 3 ? "print-answers-wide mt-6 break-before-page" : "mt-6 break-before-page"}>
        <h2 className="font-serif text-lg">Answers</h2>
        <table className="print-answers mt-2 w-full border-collapse text-sm">
          <colgroup>
            <col style={{ width: `${numberWidth}%` }} />
            <col style={{ width: `${questionWidth}%` }} />
            {rows.map((id) => (
              <col key={id} style={{ width: `${propertyWidth}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="border border-ink px-2 py-1 text-left">#</th>
              <th className="border border-ink px-2 py-1 text-left">Question</th>
              {rows.map((id) => (
                <th key={id} className="border border-ink px-2 py-1 text-left">
                  {properties[id].name || "Untitled"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {IDENTITY_FIELDS.map((field) => (
              <tr key={field.key}>
                <td className="border border-ink px-2 py-1 align-top" />
                <td className="border border-ink px-2 py-1 align-top">{field.label}</td>
                {rows.map((id) => (
                  <td key={id} className="border border-ink px-2 py-1 align-top">
                    {properties[id].identity[field.key] || "—"}
                  </td>
                ))}
              </tr>
            ))}
            {factors.map((factor) => (
              <tr key={factor.id}>
                <td className="border border-ink px-2 py-1 align-top">{factor.id}</td>
                <td className="border border-ink px-2 py-1 align-top">{factor.text}</td>
                {rows.map((id) => (
                  <td key={id} className="border border-ink px-2 py-1 align-top">
                    {answerLabel(properties[id].answers[factor.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
