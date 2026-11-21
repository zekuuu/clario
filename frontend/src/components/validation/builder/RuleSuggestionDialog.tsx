import { Wand2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "../../common/StatusBadge";
import { ModalDialog } from "../../common/ModalDialog";
import type { ComparisonDataSource, ComparisonRule } from "../../../types/validation.types";
import { ruleSuggestionKey, severityLabels } from "../../../features/validation/builderModel";
import { primaryButtonClass, secondaryButtonClass } from "./builderStyles";
import { RuleMetaChips, RuleSourceMap } from "./RuleSummaryParts";

export function RuleSuggestionDialog({
  suggestions,
  existingRules,
  sources,
  onAdd,
  onClose,
}: {
  suggestions: ComparisonRule[] | null;
  existingRules: ComparisonRule[];
  sources: ComparisonDataSource[];
  onAdd: (rules: ComparisonRule[]) => void;
  onClose: () => void;
}) {
  const existingKeys = useMemo(() => new Set(existingRules.map(ruleSuggestionKey)), [existingRules]);
  const availableSuggestions = useMemo(() => suggestions?.filter((rule) => !existingKeys.has(ruleSuggestionKey(rule))) ?? [], [existingKeys, suggestions]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedRuleIds(availableSuggestions.map((rule) => rule.id));
  }, [availableSuggestions]);

  if (!suggestions) return null;

  const selectedRules = suggestions.filter((rule) => selectedRuleIds.includes(rule.id));
  const dialog = (
    <ModalDialog
      labelledBy="suggested-rules-title"
      onClose={onClose}
      className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-panel shadow-2xl animate-[builder-dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
    >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Wand2 className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="suggested-rules-title" className="text-lg font-semibold text-slate-950">Choose rules to add</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Suggested rules use matching field names first, then preview row values when field names differ.
              </p>
            </div>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[56vh] overflow-auto p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">{availableSuggestions.length} new of {suggestions.length} suggested rule{suggestions.length === 1 ? "" : "s"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelectedRuleIds(availableSuggestions.map((rule) => rule.id))} className={secondaryButtonClass}>Select all new</button>
              <button type="button" onClick={() => setSelectedRuleIds([])} className={secondaryButtonClass}>Clear</button>
            </div>
          </div>

          <div className="space-y-3">
            {suggestions.map((rule) => {
              const isDuplicate = existingKeys.has(ruleSuggestionKey(rule));
              const checked = selectedRuleIds.includes(rule.id);
              const left = sources.find((source) => source.id === rule.left_data_source_id);
              const right = sources.find((source) => source.id === rule.right_data_source_id);
              const leftField = left?.fields.find((field) => field.id === rule.left_field_id);
              const rightField = right?.fields.find((field) => field.id === rule.right_field_id);
              return (
                <label
                  key={rule.id}
                  className={`flex gap-3 rounded-2xl border p-3 text-sm transition ${isDuplicate ? "border-slate-200 bg-slate-50 opacity-70" : checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-panel hover:bg-slate-50"}`}
                  title={isDuplicate ? "This suggested rule is already in the rule list" : `Add ${rule.rule_name}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isDuplicate}
                    onChange={(event) => {
                      const nextChecked = event.target.checked;
                      setSelectedRuleIds((current) => nextChecked ? [...new Set([...current, rule.id])] : current.filter((id) => id !== rule.id));
                    }}
                    className="mt-1 size-4 rounded border-slate-300 accent-brand"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-950">{rule.rule_name}</span>
                      <StatusBadge tone={rule.severity === "high" ? "warning" : "neutral"}>{severityLabels[rule.severity]}</StatusBadge>
                      {isDuplicate ? <StatusBadge tone="neutral">Already added</StatusBadge> : null}
                    </span>
                    <RuleSourceMap left={left} right={right} leftField={leftField} rightField={rightField} />
                    <RuleMetaChips rule={rule} />
                  </div>
                </label>
              );
            })}
          </div>

          {!availableSuggestions.length ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              All suggested rules are already in the rule list.
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-5">
          <div className="text-sm text-slate-500">
            {selectedRules.length} rule{selectedRules.length === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
            <button type="button" disabled={!selectedRules.length} onClick={() => onAdd(selectedRules)} className={primaryButtonClass}>
              Add selected rules
            </button>
          </div>
        </div>
    </ModalDialog>
  );

  return createPortal(dialog, document.body);
}
