import { CheckCircle2, FileDown, FileSearch, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { isValidPreset } from "../features/validation/builderModel";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, emptyStateLinkClass } from "../components/common/EmptyState";
import { SelectField } from "../components/forms";
import { PageHeader } from "../components/layout/PageHeader";
import { useWorkflow } from "../features/files/WorkflowContext";
import { checkBackendHealth } from "../services/apiClient";
import { runValidation } from "../services/validationApi";
import { compareDiscrepancies, compareRuleSummaries, plural, ruleLabels, severityPillClass, severityText, smartNoteFor } from "../features/validation/discrepancyNotes";
import { LocationCell, ValueCell } from "../components/validation/results/ResultCells";


export function ValidationResultsPage() {
  const { sessionId, projectName, preset, dataSources, rules, result, setResult, sourcePreviews, markSetupSaved } = useWorkflow();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [rerunBusy, setRerunBusy] = useState(false);
  const [rerunError, setRerunError] = useState("");
  const [rerunVisualState, setRerunVisualState] = useState<"loading" | "reloaded" | null>(null);
  const rerunVisualTimerRef = useRef<number | null>(null);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return (result?.discrepancies ?? [])
      .map((item) => ({ item, note: smartNoteFor(item) }))
      .filter(({ item, note }) => {
        if (severity !== "all" && item.severity !== severity) return false;
        const haystack = `${item.rule_name} ${item.expected_value ?? ""} ${item.actual_value ?? ""} ${item.notes ?? ""} ${item.suggested_correction ?? ""} ${note.title} ${note.detail}`.toLowerCase();
        return haystack.includes(needle);
      })
      .sort((left, right) => compareDiscrepancies(left.item, right.item));
  }, [query, result, severity]);
  const sortedRuleSummaries = [...(result?.rule_summaries ?? [])].sort(compareRuleSummaries);
  const canRerun = dataSources.length > 0 && rules.length > 0;

  const rerunValidation = async () => {
    setRerunBusy(true);
    setRerunError("");
    setRerunVisualState("loading");
    if (rerunVisualTimerRef.current) {
      window.clearTimeout(rerunVisualTimerRef.current);
      rerunVisualTimerRef.current = null;
    }
    try {
      await checkBackendHealth();
      const nextResult = await runValidation({ project_name: projectName, preset: isValidPreset(preset) ? preset : "custom_comparison_builder", data_sources: dataSources, rules, session_id: sessionId ?? result?.id, source_previews: sourcePreviews });
      setResult(nextResult);
      markSetupSaved(dataSources, rules);
      setRerunVisualState("reloaded");
      rerunVisualTimerRef.current = window.setTimeout(() => {
        setRerunVisualState(null);
        rerunVisualTimerRef.current = null;
      }, 900);
    } catch (cause) {
      setRerunError(cause instanceof Error ? cause.message : "Validation failed.");
      setRerunVisualState(null);
    } finally {
      setRerunBusy(false);
    }
  };

  useEffect(() => {
    return () => {
      if (rerunVisualTimerRef.current) {
        window.clearTimeout(rerunVisualTimerRef.current);
      }
    };
  }, []);

  if (!result) {
    return (
      <div>
        <PageHeader eyebrow="Step 4 of 5" title="Review rule results" description="Run validation from the comparison builder to populate results." />
        <div className="pt-8">
          <EmptyState icon={FileSearch} title="No validation result" description="Set up sources, fields, and rules, then run validation." action={<Link to="/builder" className={emptyStateLinkClass}>Go to Comparison builder</Link>} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Step 4 of 5"
        title="Review rule-based discrepancies"
        description={`${plural(result.discrepancies.length, "discrepancy", "discrepancies")} across ${plural(result.total_selected_rows, "selected row")}. Every issue remains traceable to file, sheet, row, field, and rule.`}
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={rerunValidation}
              disabled={rerunBusy || !canRerun}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-panel px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
            >
              {rerunBusy ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {rerunBusy ? "Re-running..." : "Re-run validation"}
            </button>
            <Link
              to="/reports"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.99]"
            >
              <FileDown className="size-4" />
              Export report
            </Link>
          </div>
        )}
      />

      {rerunError ? <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{rerunError}</p> : null}

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 py-3 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        {[
          ["Discrepancies", result.discrepancies.length],
          ["High", result.breakdown.high ?? 0],
          ["Medium", result.breakdown.medium ?? 0],
          ["Low", result.breakdown.low ?? 0],
          ["Selected rows", result.total_selected_rows],
        ].map(([label, value]) => (
          <div key={String(label)} className="px-4 py-2 first:pl-0 lg:py-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-0.5 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-5 pt-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit self-start rounded-2xl border border-slate-200 bg-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Rule breakdown</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{result.rule_summaries.length}</span>
          </div>
          <div className="mt-3 max-h-[calc(100dvh-18rem)] space-y-2 overflow-y-auto pr-1">
            {sortedRuleSummaries.map((rule) => (
              <div key={rule.rule_id} className="rounded-xl border border-slate-200 bg-panel px-3 py-2.5 shadow-sm shadow-slate-200/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold leading-5">{rule.rule_name}</p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{rule.discrepancy_count}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs leading-5 text-slate-500">{ruleLabels[rule.rule_type]}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold leading-4 ${severityPillClass(rule.severity)}`}>{severityText[rule.severity] ?? rule.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex gap-3">
            <label className="relative flex-1">
              <span className="sr-only">Search discrepancies</span>
              <Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search rule names, expected values, or notes"
                className="validation-results-search min-h-11 w-full rounded-xl border border-slate-300 bg-panel py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-3 focus:ring-emerald-100"
              />
            </label>
            <SelectField
              className="w-48"
              ariaLabel="Filter by severity"
              value={severity}
              onChange={setSeverity}
              options={[
                { value: "all", label: "All severities" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
          </div>

          <div className="relative rounded-2xl border border-slate-200 bg-panel">
            {rerunVisualState ? (
              <div className="pointer-events-none absolute inset-0 z-[85] rounded-2xl" aria-live="polite" aria-label="Re-running validation">
                <div
                  className={`absolute left-1/2 top-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-lg shadow-slate-200/60 animate-[app-section-fade-in_180ms_cubic-bezier(0.16,1,0.3,1)_both] ${
                    rerunVisualState === "loading" ? "border-slate-200 bg-panel text-slate-700" : "border-emerald-100 bg-panel text-emerald-700"
                  }`}
                >
                  {rerunVisualState === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  {rerunVisualState === "loading" ? "Re-running validation..." : "Validation re-run"}
                </div>
              </div>
            ) : null}

            {result.discrepancies.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center">
                <CheckCircle2 aria-hidden="true" className="size-8 text-emerald-600" />
                <p className="text-sm font-semibold text-slate-900">No discrepancies found</p>
                <p className="text-sm text-slate-600">Every enabled rule passed for {plural(result.total_selected_rows, "selected row")}.</p>
              </div>
            ) : (
              <div className={`max-h-[calc(100dvh-14rem)] overflow-auto rounded-2xl transition duration-300 ${rerunVisualState === "loading" ? "opacity-65" : ""}`}>
                <table className="w-full min-w-[820px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[150px]" />
                    <col className="w-[84px]" />
                    <col />
                    <col />
                    <col className="w-[150px]" />
                    <col className="w-[190px]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-slate-100 text-xs text-slate-600">
                    <tr>
                      <th scope="col" className="p-3">Rule</th>
                      <th scope="col" className="p-3">Severity</th>
                      <th scope="col" className="p-3">Expected</th>
                      <th scope="col" className="p-3">Actual</th>
                      <th scope="col" className="p-3">Rows</th>
                      <th scope="col" className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ item, note }, index) => (
                      <tr key={`${item.rule_id}-${item.left_row_number ?? "x"}-${item.right_row_number ?? "x"}-${index}`} className="border-t border-slate-100 align-top first:border-t-0">
                        <td className="p-3">
                          <p className="font-semibold leading-5">{item.rule_name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.left_field_name ?? item.right_field_name ?? ruleLabels[item.rule_type]}</p>
                        </td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${severityPillClass(item.severity)}`}>{severityText[item.severity] ?? item.severity}</span>
                        </td>
                        <td className="p-3"><ValueCell value={item.expected_value} /></td>
                        <td className="p-3"><ValueCell value={item.actual_value} /></td>
                        <td className="space-y-1 p-3 text-xs text-slate-600">
                          <LocationCell label="Expected" fileName={item.left_file_name} rowNumber={item.left_row_number} sheetName={item.left_sheet_name} />
                          <LocationCell label="Actual" fileName={item.right_file_name} rowNumber={item.right_row_number} sheetName={item.right_sheet_name} />
                        </td>
                        <td className="break-words p-3 text-slate-600">
                          <p className="font-semibold text-slate-900">{note.title}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500" title={note.detail}>{note.detail}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No discrepancies match the current filters.</p>}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
