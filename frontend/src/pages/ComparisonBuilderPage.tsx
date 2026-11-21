import { AlertTriangle, CheckCircle2, ChevronDown, Columns3, Database, Edit3, FileSpreadsheet, ListChecks, LoaderCircle, Plus, Play, RefreshCw, Rows3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, emptyStateLinkClass } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { PageHeader } from "../components/layout/PageHeader";
import { BuilderStepper, type BuilderStep } from "../components/validation/BuilderStepper";
import { RowSelectionTable } from "../components/validation/RowSelectionTable";
import { useWorkflow } from "../features/files/WorkflowContext";
import { checkBackendHealth } from "../services/apiClient";
import { previewDataSource } from "../services/fileApi";
import { runValidation } from "../services/validationApi";
import type { ComparisonDataSource, ComparisonField, ComparisonRule, DataSourcePreview } from "../types/validation.types";
import { countLabel, createDataSource, createFieldDraft, createRuleDraft, describeFieldDependencies, describeSourceDependencies, fieldLabel, fieldTypeLabels, isValidPreset, ruleFlowLabel, ruleIsRunnable, ruleLabel, ruleSuggestionKey, scaffoldSources, severityLabels, sourceConfigSignature, type BuilderStepId, type ConfirmDialogState, type FieldEditorState, type RuleEditorState, type SourceEditorState } from "../features/validation/builderModel";
import { buildCompareRulesForMatchingFields } from "../features/validation/ruleSuggestions";
import { iconButtonClass, primaryButtonClass, rowPreviewButtonClass, secondaryButtonClass } from "../components/validation/builder/builderStyles";
import { Metric, RuleCompactSourceLine, RuleMetaChips, RuleSourceMap, Summary } from "../components/validation/builder/RuleSummaryParts";
import { ConfirmationDialog } from "../components/common/ConfirmationDialog";
import { RuleSuggestionDialog } from "../components/validation/builder/RuleSuggestionDialog";
import { SourceDrawer } from "../components/validation/builder/SourceDrawer";
import { FieldDrawer } from "../components/validation/builder/FieldDrawer";
import { RuleDrawer } from "../components/validation/builder/RuleDrawer";

interface ComparisonBuilderPageProps {
  onBackToRowSetup?: () => void;
}

export function ComparisonBuilderPage({ onBackToRowSetup }: ComparisonBuilderPageProps) {
  const navigate = useNavigate();
  const {
    sessionId,
    setSessionId,
    files,
    preset,
    projectName,
    dataSources,
    setDataSources,
    updateDataSource,
    removeDataSource,
    sourcePreviews,
    setSourcePreview,
    removeSourcePreview,
    rules,
    setRules,
    updateRule,
    removeRule,
    result,
    setResult,
    markSetupSaved,
  } = useWorkflow();
  const [activeStep, setActiveStep] = useState<BuilderStepId>("sources");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sourceEditor, setSourceEditor] = useState<SourceEditorState | null>(null);
  const [fieldEditor, setFieldEditor] = useState<FieldEditorState | null>(null);
  const [ruleEditor, setRuleEditor] = useState<RuleEditorState | null>(null);
  const [ruleSuggestions, setRuleSuggestions] = useState<ComparisonRule[] | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [collapsedRowPreviews, setCollapsedRowPreviews] = useState<Record<string, boolean>>({});
  const [expandedRuleReasons, setExpandedRuleReasons] = useState<Set<string>>(() => new Set());

  const toggleRuleReason = (ruleId: string) => {
    setExpandedRuleReasons((current) => {
      const next = new Set(current);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  useEffect(() => {
    if (!files.length || dataSources.length) return;
    setDataSources((current) => (current.length ? current : scaffoldSources(files)));
  }, [files, dataSources.length, setDataSources]);

  const fieldsBySource = useMemo(() => Object.fromEntries(dataSources.map((source) => [source.id, source.fields])), [dataSources]);

  // Advisory warnings are shown; blocking ones also disable Run (same checks the backend enforces).
  const { warnings, blockingCount } = useMemo(() => {
    const items: string[] = [];
    let blocking = 0;
    const block = (message: string) => {
      items.push(message);
      blocking += 1;
    };
    for (const source of dataSources) {
      if (!source.row_setup_confirmed) block(`${source.name} needs its header and first data row confirmed in Row setup.`);
      if (!sourcePreviews[source.id]) items.push(`${source.name} has no row preview yet.`);
      if (!source.selected_row_numbers.length) block(`${source.name} has zero selected rows.`);
      if (!source.fields.length) block(`${source.name} has no fields.`);
    }
    if (!rules.some((rule) => rule.enabled)) block("No enabled rules.");
    for (const rule of rules) {
      if (!ruleIsRunnable(rule)) block(`${rule.rule_name} is incomplete.`);
    }
    return { warnings: items, blockingCount: blocking };
  }, [dataSources, rules, sourcePreviews]);

  const enabledRules = rules.filter((rule) => rule.enabled);
  const canRun = isValidPreset(preset) && dataSources.length > 0 && enabledRules.length > 0 && blockingCount === 0;

  const steps: BuilderStep[] = [
    { id: "sources", label: "Sources", icon: Database, complete: dataSources.length > 0 },
    { id: "rows", label: "Rows", icon: Rows3, complete: dataSources.every((source) => source.selected_row_numbers.length > 0), warning: dataSources.some((source) => !source.selected_row_numbers.length) },
    { id: "fields", label: "Fields", icon: Columns3, complete: dataSources.every((source) => source.fields.length > 0), warning: dataSources.some((source) => !source.fields.length) },
    { id: "rules", label: "Rules", icon: ListChecks, complete: enabledRules.length > 0 && rules.every(ruleIsRunnable), warning: enabledRules.length === 0 || !rules.every(ruleIsRunnable) },
    { id: "review", label: "Review & Run", icon: Play, complete: canRun, warning: !canRun },
  ];

  if (!files.length) {
    return (
      <div>
        <PageHeader eyebrow="Step 3 of 5" title="Comparison builder" description="Upload files before creating sources, rows, fields, and rules." />
        <div className="pt-8">
          <EmptyState icon={Database} title="No files uploaded" description="Upload at least one spreadsheet to start building sources, fields, and rules." action={<Link to="/upload" className={emptyStateLinkClass}>Go to Upload files</Link>} />
        </div>
      </div>
    );
  }

  const refreshPreview = async (source: ComparisonDataSource) => {
    setBusy(source.id);
    setError("");
    try {
      const preview = await previewDataSource(source);
      updateDataSource(source.id, preview.data_source);
      setSourcePreview(source.id, preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview this source.");
    } finally {
      setBusy(null);
    }
  };

  const setRowsForSource = (source: ComparisonDataSource, preview: DataSourcePreview, selectedRows: number[], ignoredRows = source.ignored_row_numbers) => {
    const selected = [...new Set(selectedRows)].sort((a, b) => a - b);
    const ignored = [...new Set(ignoredRows)].sort((a, b) => a - b);
    updateDataSource(source.id, { ...source, selected_row_numbers: selected, ignored_row_numbers: ignored, row_selection_mode: "manual_include" });
    setSourcePreview(source.id, {
      ...preview,
      rows: preview.rows.map((row) => ({ ...row, selected: selected.includes(row.row_number), ignored: ignored.includes(row.row_number) })),
    });
  };

  const openCreateSource = () => {
    const file = files[0];
    if (!file) return;
    setSourceEditor({ mode: "create", initial: createDataSource(file, dataSources.length) });
  };

  const openEditSource = (source: ComparisonDataSource) => {
    setSourceEditor({ mode: "edit", initial: source, preview: sourcePreviews[source.id] });
  };

  const openCreateField = (source: ComparisonDataSource) => {
    const preview = sourcePreviews[source.id];
    if (!preview) return;
    const initial = createFieldDraft(source, preview);
    if (!initial) return;
    setFieldEditor({ mode: "create", sourceId: source.id, initial, preview });
  };

  const openEditField = (source: ComparisonDataSource, field: ComparisonField) => {
    setFieldEditor({ mode: "edit", sourceId: source.id, initial: field, preview: sourcePreviews[source.id] });
  };

  const openCreateRule = () => {
    const initial = createRuleDraft(dataSources, rules.length);
    if (!initial) return;
    setRuleEditor({ mode: "create", initial });
  };

  const openEditRule = (rule: ComparisonRule) => {
    setRuleEditor({ mode: "edit", initial: rule });
  };

  const saveSource = (nextSource: ComparisonDataSource, preview?: DataSourcePreview | null) => {
    if (!sourceEditor) return;
    const configChanged = sourceConfigSignature(sourceEditor.initial) !== sourceConfigSignature(nextSource);
    if (sourceEditor.mode === "create") {
      setDataSources([...dataSources, nextSource]);
    } else {
      updateDataSource(nextSource.id, nextSource);
    }

    if (preview) {
      setSourcePreview(nextSource.id, preview);
    } else if (configChanged) {
      removeSourcePreview(nextSource.id);
    }

    setSourceEditor(null);
  };

  const saveField = (nextField: ComparisonField) => {
    if (!fieldEditor) return;
    const source = dataSources.find((item) => item.id === fieldEditor.sourceId);
    if (!source) return;
    if (fieldEditor.mode === "create") {
      updateDataSource(source.id, { ...source, fields: [...source.fields, nextField] });
    } else {
      updateDataSource(source.id, { ...source, fields: source.fields.map((field) => (field.id === nextField.id ? nextField : field)) });
    }
    setFieldEditor(null);
  };

  const saveRule = (nextRule: ComparisonRule) => {
    if (!ruleEditor) return;
    if (ruleEditor.mode === "create") {
      setRules([...rules, nextRule]);
    } else {
      updateRule(nextRule.id, nextRule);
    }
    setRuleEditor(null);
  };

  const requestConfirm = (state: ConfirmDialogState) => {
    setConfirmDialog(state);
  };

  const buildSuggestedRules = () => {
    if (dataSources.length < 2) return;
    const left = dataSources[0];
    const right = dataSources[dataSources.length - 1];
    if (!left || !right) return;
    const next = buildCompareRulesForMatchingFields(left, right, sourcePreviews[left.id], sourcePreviews[right.id]);
    if (!next.length) {
      setError("No matching field names or preview values were found across the first and last sources. Map matching fields before building suggested rules.");
      return;
    }
    setError("");
    setRuleSuggestions(next);
  };

  const addSuggestedRules = (selectedRules: ComparisonRule[]) => {
    const existingKeys = new Set(rules.map(ruleSuggestionKey));
    const additions = selectedRules.filter((rule) => !existingKeys.has(ruleSuggestionKey(rule)));
    if (!additions.length) {
      setRuleSuggestions(null);
      setError("Selected suggested rules are already in the rule list.");
      return;
    }
    setRules([...rules, ...additions]);
    setRuleSuggestions(null);
    setError("");
  };

  const run = async () => {
    setBusy("validation");
    setError("");
    try {
      await checkBackendHealth();
      const result = await runValidation({ project_name: projectName, preset: isValidPreset(preset) ? preset : "custom_comparison_builder", data_sources: dataSources, rules, session_id: sessionId, source_previews: sourcePreviews });
      setResult(result);
      markSetupSaved(dataSources, rules);
      setSessionId(result.id);
      navigate("/results");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Validation failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Step 3 of 5"
        title="Comparison builder"
        description="Build flexible sources, rows, fields, and rules in a guided desktop workflow."
        action={
          <button
            onClick={openCreateSource}
            title="Add a new comparison source without committing it until you click Create source"
            className={secondaryButtonClass}
          >
            <Plus className="size-4" /> Add source
          </button>
        }
      />

      <div className="space-y-6 pt-6 pb-24 lg:pb-28">
        <BuilderStepper steps={steps} activeStep={activeStep} onStepChange={(step) => setActiveStep(step as BuilderStepId)} />
        {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {activeStep === "sources" ? (
          <section className="space-y-4">
            {onBackToRowSetup ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-panel p-4 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Row setup review</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Use the visual row setup screen to confirm header and first data rows across every source.
                  </p>
                </div>
                <button type="button" onClick={onBackToRowSetup} className={secondaryButtonClass} title="Return to the visual row setup review">
                  <Rows3 className="size-4" /> Review row setup
                </button>
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              {dataSources.map((source) => {
                const preview = sourcePreviews[source.id];
                const dependentRules = describeSourceDependencies(rules, source.id);
                return (
                  <article key={source.id} className="rounded-3xl border border-slate-200 bg-panel p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                          <h2 className="truncate text-base font-semibold text-slate-950">{source.name}</h2>
                          {preview ? <StatusBadge tone="success">Preview ready</StatusBadge> : <StatusBadge tone="warning">Needs preview</StatusBadge>}
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">{source.file_name ?? "No file"} / {source.sheet_name || "No sheet"}</p>
                      </div>
                      <div className="flex gap-2">
                        <button title="Edit source settings in a draft drawer before saving" aria-label={`Edit source ${source.name}`} onClick={() => openEditSource(source)} className={iconButtonClass}>
                          <Edit3 className="size-4" />
                        </button>
                        <button
                          title="Delete this source from the comparison builder"
                          aria-label={`Delete source ${source.name}`}
                          onClick={() => {
                            const warning = dependentRules
                              ? `Delete this source? ${countLabel(dependentRules, "rule")} reference it and may become incomplete.`
                              : "Delete this source from the builder?";
                            requestConfirm({
                              title: "Delete source?",
                              description: warning,
                              confirmLabel: "Delete source",
                              tone: "danger",
                              onConfirm: () => {
                                removeDataSource(source.id);
                                removeSourcePreview(source.id);
                              },
                            });
                          }}
                          className={`${iconButtonClass} text-red-700 hover:border-[var(--color-red-border)] hover:bg-red-50`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <Metric label="Header row" value={String(source.header_row)} />
                      <Metric label="First data row" value={String(source.first_data_row)} />
                      <Metric label="Selected rows" value={String(source.selected_row_numbers.length)} />
                      <Metric label="Fields" value={String(source.fields.length)} />
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {activeStep === "rows" ? (
          <section className="space-y-5">
            {dataSources.map((source) => {
              const preview = sourcePreviews[source.id];
              if (!preview) {
                return (
                  <article key={source.id} className="rounded-3xl border border-slate-200 bg-panel p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="font-semibold">{source.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">Preview rows before selecting data rows.</p>
                      </div>
                      <button title="Preview rows for this source to enable row selection" onClick={() => refreshPreview(source)} className={secondaryButtonClass}>
                        Preview rows
                      </button>
                    </div>
                  </article>
                );
              }
              const headers = preview.columns.map((column) => column.header_label);
              const dataRows = preview.rows.filter((row) => row.row_number >= source.first_data_row);
              return (
                <article key={source.id} className="space-y-3">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <h2 className="font-semibold">{source.name}</h2>
                      <p className="mt-1 text-sm leading-5 text-slate-500">Click rows to include or exclude them from validation.</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        title={busy === source.id ? "Preview reload is already running" : "Reload this source preview after changing row selections, source settings, or workbook data"}
                        onClick={() => refreshPreview(source)}
                        disabled={Boolean(busy)}
                        aria-busy={busy === source.id}
                        className={rowPreviewButtonClass}
                      >
                        {busy === source.id ? <LoaderCircle className="size-4 animate-spin" /> : <Rows3 className="size-4" />}
                        {busy === source.id ? "Reloading preview..." : "Reload preview"}
                      </button>
                      <button
                        type="button"
                        title={collapsedRowPreviews[source.id] ? "Expand this preview table" : "Collapse this preview table to reduce page clutter"}
                        aria-expanded={!collapsedRowPreviews[source.id]}
                        onClick={() => setCollapsedRowPreviews((current) => ({ ...current, [source.id]: !current[source.id] }))}
                        className={rowPreviewButtonClass}
                      >
                        <ChevronDown className={`size-4 transition-transform ease-[cubic-bezier(0.16,1,0.3,1)] duration-[240ms] ${collapsedRowPreviews[source.id] ? "-rotate-90" : ""}`} />
                        {collapsedRowPreviews[source.id] ? "Expand" : "Collapse"}
                      </button>
                    </div>
                  </div>
                  {collapsedRowPreviews[source.id] ? null : (
                    <RowSelectionTable
                      headers={headers}
                      rows={dataRows}
                      onToggleRow={(rowNumber) => {
                        const selected = source.selected_row_numbers.includes(rowNumber) ? source.selected_row_numbers.filter((item) => item !== rowNumber) : [...source.selected_row_numbers, rowNumber];
                        setRowsForSource(source, preview, selected);
                      }}
                      onSelectRows={(rowNumbers) => setRowsForSource(source, preview, rowNumbers)}
                      onIgnoreRows={(rowNumbers) => {
                        const ignored = [...new Set([...source.ignored_row_numbers, ...rowNumbers])];
                        setRowsForSource(source, preview, source.selected_row_numbers.filter((row) => !ignored.includes(row)), ignored);
                      }}
                      onMarkDataRows={(rowNumbers) => {
                        const ignored = source.ignored_row_numbers.filter((row) => !rowNumbers.includes(row));
                        setRowsForSource(source, preview, [...new Set([...source.selected_row_numbers, ...rowNumbers])], ignored);
                      }}
                    />
                  )}
                </article>
              );
            })}
          </section>
        ) : null}

        {activeStep === "fields" ? (
          <section className="space-y-6">
            {dataSources.map((source) => {
              const preview = sourcePreviews[source.id];
              return (
                <article key={source.id} className="rounded-3xl border border-slate-200 bg-panel p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{source.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{countLabel(source.fields.length, "mapped field")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-suggest-fields-source-id={source.id}
                        disabled={!preview}
                        title="Suggest field mappings from detected source headers"
                        onClick={() => window.dispatchEvent(new CustomEvent("clario:suggest-fields", { detail: { sourceId: source.id } }))}
                        className={secondaryButtonClass}
                      >
                        Add suggested fields
                      </button>
                      <button
                        disabled={!preview}
                        title="Add a field mapping in draft mode and only commit it when you click Create field"
                        onClick={() => openCreateField(source)}
                        className={primaryButtonClass}
                      >
                        <Plus className="size-4" /> Add field
                      </button>
                    </div>
                  </div>
                  {!preview ? <p className="mt-4 text-sm text-slate-500">Preview this source before adding fields.</p> : null}
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {source.fields.map((field) => {
                      const dependentRules = describeFieldDependencies(rules, field.id);
                      return (
                        <div key={field.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{fieldLabel(field)}</p>
                              <p className="mt-1 text-xs text-slate-500">{fieldTypeLabels[field.field_type]} / column {field.column_letter}</p>
                            </div>
                            <div className="flex gap-2">
                              <button title="Edit field settings in a draft drawer before saving" aria-label={`Edit field ${fieldLabel(field)}`} onClick={() => openEditField(source, field)} className={`${iconButtonClass} size-8`}>
                                <Edit3 className="size-4" />
                              </button>
                              <button
                                title="Remove this field mapping from the source"
                                aria-label={`Remove field ${fieldLabel(field)}`}
                                onClick={() => {
                                  const warning = dependentRules
                                    ? `Remove this field? ${countLabel(dependentRules, "rule")} using this field may become incomplete.`
                                    : "Remove this field mapping from the source?";
                                  requestConfirm({
                                    title: "Remove field?",
                                    description: warning,
                                    confirmLabel: "Remove field",
                                    tone: "danger",
                                    onConfirm: () => updateDataSource(source.id, { ...source, fields: source.fields.filter((item) => item.id !== field.id) }),
                                  });
                                }}
                                className={`${iconButtonClass} size-8 text-red-700 hover:border-[var(--color-red-border)] hover:bg-red-50`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-3 truncate text-xs text-slate-500">{field.original_header_label || "Blank header"}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {field.required ? <StatusBadge tone="warning">Required</StatusBadge> : <StatusBadge>Optional</StatusBadge>}
                            {field.normalization.case_insensitive ? <StatusBadge>Ignore case</StatusBadge> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null}

        {activeStep === "rules" ? (
          <section className="rounded-3xl border border-slate-200 bg-panel p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Rules</h2>
                <p className="mt-1 text-sm text-slate-500">{countLabel(enabledRules.length, "enabled rule")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button title="Build a starter set of comparison rules from the mapped source fields" onClick={buildSuggestedRules} className={secondaryButtonClass}>
                  Build suggested rules
                </button>
                <button title="Add a rule in draft mode and only commit it when you click Create rule" onClick={openCreateRule} className={primaryButtonClass} disabled={!dataSources.some((source) => source.fields.length)}>
                  <Plus className="size-4" /> Add rule
                </button>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {rules.map((rule) => {
                const left = dataSources.find((source) => source.id === rule.left_data_source_id);
                const right = dataSources.find((source) => source.id === rule.right_data_source_id);
                const leftField = left?.fields.find((field) => field.id === rule.left_field_id);
                const rightField = right?.fields.find((field) => field.id === rule.right_field_id);
                const reasonOpen = expandedRuleReasons.has(rule.id);
                return (
                  <article key={rule.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                          <h3 className="truncate text-sm font-semibold">{rule.rule_name || ruleLabel(rule, dataSources)}</h3>
                          <StatusBadge tone={rule.enabled ? "success" : "neutral"}>{rule.enabled ? "Enabled" : "Disabled"}</StatusBadge>
                          {rule.severity === "high" ? <StatusBadge tone="warning">{severityLabels[rule.severity]}</StatusBadge> : null}
                        </div>
                        <RuleCompactSourceLine left={left} right={right} />
                        <p className="mt-1 text-xs font-medium text-slate-500">{ruleFlowLabel(rule)}</p>
                        <button
                          type="button"
                          onClick={() => toggleRuleReason(rule.id)}
                          aria-expanded={reasonOpen}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          <ChevronDown className={`size-3.5 transition-transform ${reasonOpen ? "rotate-180" : ""}`} />
                          {reasonOpen ? "Hide reason" : "View reason"}
                        </button>
                        {reasonOpen ? (
                          <div className="mt-2 rounded-xl border border-slate-200 bg-panel p-2.5">
                            <RuleMetaChips rule={rule} />
                            <RuleSourceMap left={left} right={right} leftField={leftField} rightField={rightField} />
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button title="Edit rule settings in a draft drawer before saving" aria-label={`Edit rule ${rule.rule_name}`} onClick={() => openEditRule(rule)} className={iconButtonClass}>
                          <Edit3 className="size-4" />
                        </button>
                        <button
                          title="Remove this validation rule"
                          aria-label={`Remove rule ${rule.rule_name}`}
                          onClick={() => {
                            requestConfirm({
                              title: "Remove rule?",
                              description: "Remove this rule? This check will no longer run during validation.",
                              confirmLabel: "Remove rule",
                              tone: "danger",
                              onConfirm: () => removeRule(rule.id),
                            });
                          }}
                          className={`${iconButtonClass} text-red-700 hover:border-[var(--color-red-border)] hover:bg-red-50`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {!rules.length ? <EmptyState icon={ListChecks} title="No rules yet" description="Add a rule or build suggested rules after fields are mapped." /> : null}
            </div>
          </section>
        ) : null}

        {activeStep === "review" ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-3xl border border-slate-200 bg-panel p-5 shadow-sm">
              <h2 className="font-semibold">Review setup</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Summary label="Files uploaded" value={files.length} />
                <Summary label="Data sources" value={dataSources.length} />
                <Summary label="Selected rows" value={dataSources.reduce((total, source) => total + source.selected_row_numbers.length, 0)} />
                <Summary label="Enabled rules" value={enabledRules.length} />
              </div>
              <div className="mt-6 space-y-3">
                {dataSources.map((source) => (
                  <div key={source.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <FileSpreadsheet className="size-5 text-emerald-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{source.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{source.selected_row_numbers.length} rows / {source.fields.length} fields / {source.sheet_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="rounded-3xl border border-slate-200 bg-panel p-5 shadow-sm">
              <div className="flex items-center gap-2">
                {warnings.length ? <AlertTriangle aria-hidden="true" className="size-4 text-amber-600" /> : <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-600" />}
                <h2 className="font-semibold">{warnings.length ? `${countLabel(warnings.length, "item")} to review` : "Ready to run"}</h2>
              </div>
              <div className="mt-4 space-y-2">
                {warnings.length ? warnings.map((warning) => <p key={warning} className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{warning}</p>) : <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">Setup is ready to validate.</p>}
              </div>
              <button title={`${result ? "Re-run" : "Run"} validation with the current sources, rows, fields, and rules`} disabled={!canRun || busy === "validation"} onClick={run} className="mt-5 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-slate-300">
                {busy === "validation" ? <LoaderCircle className="size-4 animate-spin" /> : result ? <RefreshCw className="size-4" /> : <Play className="size-4" />}
                {busy === "validation" ? (result ? "Re-running validation..." : "Running validation...") : result ? "Re-run validation" : "Run validation"}
              </button>
            </aside>
          </section>
        ) : null}
      </div>

      <SourceDrawer
        files={files}
        editor={sourceEditor}
        open={Boolean(sourceEditor)}
        onClose={() => setSourceEditor(null)}
        onSave={saveSource}
        requestConfirm={requestConfirm}
      />
      <FieldDrawer
        editor={fieldEditor}
        source={fieldEditor ? dataSources.find((item) => item.id === fieldEditor.sourceId) ?? null : null}
        open={Boolean(fieldEditor)}
        onClose={() => setFieldEditor(null)}
        onSave={saveField}
        requestConfirm={requestConfirm}
      />
      <RuleDrawer
        editor={ruleEditor}
        sources={dataSources}
        fieldsBySource={fieldsBySource}
        open={Boolean(ruleEditor)}
        onClose={() => setRuleEditor(null)}
        onSave={saveRule}
        requestConfirm={requestConfirm}
      />
      <RuleSuggestionDialog
        suggestions={ruleSuggestions}
        existingRules={rules}
        sources={dataSources}
        onAdd={addSuggestedRules}
        onClose={() => setRuleSuggestions(null)}
      />
      <ConfirmationDialog state={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </div>
  );
}
