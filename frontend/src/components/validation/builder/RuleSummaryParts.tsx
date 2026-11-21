import { ArrowRight } from "lucide-react";
import type { ComparisonDataSource, ComparisonField, ComparisonRule } from "../../../types/validation.types";
import { fieldLabel, matchLabels, ruleTypeLabels, titleCaseStrictness } from "../../../features/validation/builderModel";

export function RuleCompactSourceLine({ left, right }: { left?: ComparisonDataSource; right?: ComparisonDataSource }) {
  return (
    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
      <span className="min-w-0 truncate" title={left?.name ?? "Source"}>{left?.name ?? "Source"}</span>
      {right ? (
        <>
          <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate" title={right.name}>{right.name}</span>
        </>
      ) : null}
    </p>
  );
}

export function RuleMetaChips({ rule }: { rule: ComparisonRule }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-medium text-slate-600">
      <span className="rounded-full bg-panel/80 px-2 py-0.5 ring-1 ring-slate-200">{ruleTypeLabels[rule.rule_type]}</span>
      <span className="rounded-full bg-panel/80 px-2 py-0.5 ring-1 ring-slate-200">{matchLabels[rule.match_strategy]}</span>
      <span className="rounded-full bg-panel/80 px-2 py-0.5 ring-1 ring-slate-200">{titleCaseStrictness(rule.strictness)}</span>
    </div>
  );
}

function SourceFieldBlock({ label, sourceName, fieldName }: { label: string; sourceName: string; fieldName: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-panel/80 px-2 py-1 text-xs ring-1 ring-slate-200">
      <span className="shrink-0 text-xs font-semibold uppercase text-slate-500">{label}</span>
      <span className="min-w-0 max-w-72 truncate font-medium text-slate-600">{sourceName}</span>
      <span className="shrink-0 text-slate-500">:</span>
      <span className="min-w-0 max-w-44 truncate font-semibold text-slate-950">{fieldName}</span>
    </span>
  );
}

export function RuleSourceMap({
  left,
  right,
  leftField,
  rightField,
}: {
  left?: ComparisonDataSource;
  right?: ComparisonDataSource;
  leftField?: ComparisonField;
  rightField?: ComparisonField;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <SourceFieldBlock label="Reference" sourceName={left?.name ?? "Source"} fieldName={fieldLabel(leftField)} />
      {right ? (
        <>
          <span className="inline-flex size-5 shrink-0 items-center justify-center text-slate-500">
            <ArrowRight className="size-3.5" />
          </span>
          <SourceFieldBlock label="Compared With" sourceName={right.name} fieldName={fieldLabel(rightField)} />
        </>
      ) : null}
    </div>
  );
}

export function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
