import type { UploadedFile } from "../../types/file.types";
import type { ComparisonDataSource, ComparisonField, ComparisonRule, DataSourcePreview, FieldType, FormulaSettings, MatchStrategy, PresetType, RuleStrictness, RuleType, Severity } from "../../types/validation.types";

export type BuilderStepId = "sources" | "rows" | "fields" | "rules" | "review";

type EditorMode = "create" | "edit";

export interface SourceEditorState {
  mode: EditorMode;
  initial: ComparisonDataSource;
  preview?: DataSourcePreview;
}

export interface FieldEditorState {
  mode: EditorMode;
  sourceId: string;
  initial: ComparisonField;
  preview?: DataSourcePreview;
}

export interface RuleEditorState {
  mode: EditorMode;
  initial: ComparisonRule;
}

export interface ConfirmDialogState {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
}

export const ruleTypeLabels: Record<RuleType, string> = {
  compare_values: "Compare two fields",
  formula_check: "Formula check",
  required_field_check: "Required field check",
  duplicate_check: "Duplicate check",
};

export const matchLabels: Record<MatchStrategy, string> = {
  by_row_order: "By row order",
  by_item_number_field: "By item number field",
  by_exact_text_field: "By exact text field",
  by_multiple_fields: "By multiple fields",
  manual_placeholder: "Manual placeholder",
};

export const strictnessLabels: Record<RuleStrictness, string> = {
  exact: "Exact",
  normalized_exact: "Exact text, ignore case",
  similar_text: "Similar text (ignore spacing and punctuation)",
  numeric_tolerance: "Numeric tolerance",
  currency_tolerance: "Currency tolerance",
};

export const fieldTypeLabels: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  currency: "Currency",
  date: "Date",
  boolean: "Boolean",
  raw: "Raw value",
};

export const severityLabels: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const formulaOperatorLabels: Record<FormulaSettings["operator"], string> = {
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
};

export function isValidPreset(value: string): value is PresetType {
  return value === "reference_vs_copied" || value === "reference_bidder_abstract" || value === "generic_two_file" || value === "custom_comparison_builder";
}

export { makeId } from "../../utils/ids";
import { makeId } from "../../utils/ids";

export function sourceName(file: UploadedFile, index: number) {
  return `Source ${index + 1} - ${file.name}`;
}

export function createDataSource(file: UploadedFile, index: number): ComparisonDataSource {
  const sheet = file.sheets[0];
  const headerRow = sheet?.detected_header_row ?? 1;
  return {
    id: makeId("source"),
    name: sourceName(file, index),
    file_id: file.id,
    file_name: file.name,
    sheet_name: sheet?.name ?? "",
    header_row: headerRow,
    first_data_row: headerRow + 1,
    row_setup_confirmed: false,
    selected_row_numbers: [],
    ignored_row_numbers: [],
    row_selection_mode: "auto_detected",
    fields: [],
  };
}

export function scaffoldSources(files: UploadedFile[]) {
  return files.map((file, index) => createDataSource(file, index));
}

export function createFieldDraft(source: ComparisonDataSource, preview: DataSourcePreview) {
  const column = preview.columns.find((item) => !source.fields.some((field) => field.column_letter === item.letter)) ?? preview.columns[0];
  if (!column) return null;
  return {
    id: makeId("field"),
    data_source_id: source.id,
    field_name: `Field ${source.fields.length + 1}`,
    field_type: "text" as FieldType,
    column_letter: column.letter,
    original_header_label: column.header_label,
    custom_display_name: null,
    required: true,
    normalization: { case_insensitive: true, trim_whitespace: true, collapse_whitespace: true },
  };
}

export function createRuleDraft(dataSources: ComparisonDataSource[], ruleCount: number): ComparisonRule | null {
  const leftSource = dataSources.find((source) => source.fields.length > 0) ?? dataSources[0];
  const rightSource = dataSources.find((source) => source.id !== leftSource?.id && source.fields.length > 0) ?? dataSources.find((source) => source.id !== leftSource?.id) ?? leftSource;
  const leftField = leftSource?.fields[0];
  const rightField = rightSource?.fields[0];
  if (!leftSource || !leftField) return null;
  return {
    id: makeId("rule"),
    rule_name: `Rule ${ruleCount + 1}`,
    rule_type: "compare_values",
    left_data_source_id: leftSource.id,
    left_field_id: leftField.id,
    right_data_source_id: rightSource?.id ?? null,
    right_field_id: rightField?.id ?? null,
    left_match_field_ids: [leftField.id],
    right_match_field_ids: rightField ? [rightField.id] : [],
    match_strategy: "by_row_order",
    strictness: "normalized_exact",
    numeric_tolerance: null,
    currency_tolerance: null,
    formula_settings: null,
    severity: "medium",
    enabled: true,
  };
}

export function fieldLabel(field?: ComparisonField | null) {
  return field?.custom_display_name || field?.field_name || "Not selected";
}

export function normalizedFieldName(field: ComparisonField) {
  return fieldLabel(field).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function suggestedRuleStrictness(field: ComparisonField): RuleStrictness {
  if (field.field_type === "currency") return "currency_tolerance";
  if (field.field_type === "number") return "exact";
  // Free-text descriptions differ in spacing/punctuation ("500 g," vs "500g") far more often than in meaning.
  const name = normalizedFieldName(field);
  if (name.includes("description") || name.includes("desc") || name.includes("name")) return "similar_text";
  return "normalized_exact";
}

export function suggestedRuleSeverity(field: ComparisonField) {
  const name = normalizedFieldName(field);
  return name.includes("description") || name.includes("desc") ? "high" : "medium";
}

export function ruleLabel(rule: ComparisonRule, sources: ComparisonDataSource[]) {
  const left = sources.find((source) => source.id === rule.left_data_source_id);
  const right = sources.find((source) => source.id === rule.right_data_source_id);
  const leftField = left?.fields.find((field) => field.id === rule.left_field_id);
  const rightField = right?.fields.find((field) => field.id === rule.right_field_id);
  if (rule.rule_type === "formula_check") return `${left?.name ?? "Source"} formula`;
  if (rule.rule_type === "required_field_check") return `${fieldLabel(leftField)} is required`;
  if (rule.rule_type === "duplicate_check") return `${fieldLabel(leftField)} is unique`;
  return `${fieldLabel(leftField)} vs ${fieldLabel(rightField)}`;
}

export function ruleFlowLabel(rule: ComparisonRule) {
  return rule.rule_type === "compare_values" ? matchLabels[rule.match_strategy] : ruleTypeLabels[rule.rule_type];
}

export function ruleIsRunnable(rule: ComparisonRule) {
  if (!rule.enabled) return true;
  if (rule.rule_type === "compare_values") return Boolean(rule.left_data_source_id && rule.left_field_id && rule.right_data_source_id && rule.right_field_id);
  if (rule.rule_type === "formula_check") return Boolean(rule.left_data_source_id && rule.formula_settings?.operand_field_ids.length === 2 && rule.formula_settings.result_field_id);
  return Boolean(rule.left_data_source_id && rule.left_field_id);
}

export function ruleSuggestionKey(rule: ComparisonRule) {
  return [
    rule.rule_type,
    rule.left_data_source_id ?? "",
    rule.left_field_id ?? "",
    rule.right_data_source_id ?? "",
    rule.right_field_id ?? "",
    rule.match_strategy,
    [...rule.left_match_field_ids].sort().join(","),
    [...rule.right_match_field_ids].sort().join(","),
  ].join("|");
}

export function sourceConfigSignature(source: ComparisonDataSource) {
  return [source.file_id, source.sheet_name, source.header_row, source.first_data_row].join("|");
}

export function validateSource(source: ComparisonDataSource, files: UploadedFile[]) {
  const errors: string[] = [];
  const file = files.find((item) => item.id === source.file_id);
  const hasSheet = file?.sheets.some((sheet) => sheet.name === source.sheet_name);
  if (!source.name.trim()) errors.push("Source name is required.");
  if (!source.file_id || !file) errors.push("File is required.");
  if (!source.sheet_name || !hasSheet) errors.push("Sheet is required.");
  if (!Number.isInteger(source.header_row) || source.header_row < 1) errors.push("Header row must be 1 or greater.");
  if (!Number.isInteger(source.first_data_row) || source.first_data_row <= source.header_row) errors.push("First data row must be greater than the header row.");
  return errors;
}

export function validateField(field: ComparisonField, preview?: DataSourcePreview) {
  const errors: string[] = [];
  if (!field.field_name.trim()) errors.push("Field name is required.");
  if (!field.field_type) errors.push("Field type is required.");
  if (!preview) errors.push("Preview rows for this source before choosing a column.");
  if (!field.column_letter) errors.push("Column is required.");
  return errors;
}

export function validateRule(rule: ComparisonRule) {
  const errors: string[] = [];
  if (!rule.rule_name.trim()) errors.push("Rule name is required.");
  if (!rule.rule_type) errors.push("Rule type is required.");
  if (rule.rule_type === "compare_values" && !(rule.left_data_source_id && rule.left_field_id && rule.right_data_source_id && rule.right_field_id)) {
    errors.push("Choose both the expected and actual source fields.");
  }
  if (rule.rule_type === "formula_check") {
    const formula = rule.formula_settings;
    if (!(rule.left_data_source_id && formula?.operand_field_ids?.[0] && formula?.operand_field_ids?.[1] && formula.result_field_id && formula.operator)) {
      errors.push("Formula rules need a source, two operand fields, an operator, and a result field.");
    }
  }
  if ((rule.rule_type === "required_field_check" || rule.rule_type === "duplicate_check") && !(rule.left_data_source_id && rule.left_field_id)) {
    errors.push("Choose the source and field to check.");
  }
  if (rule.rule_type === "compare_values" && rule.match_strategy !== "by_row_order" && !(rule.left_match_field_ids.length && rule.right_match_field_ids.length)) {
    errors.push("Choose the match key fields used to pair rows.");
  }
  if (rule.strictness === "numeric_tolerance" && !rule.numeric_tolerance) errors.push("Numeric tolerance is required for numeric tolerance checks.");
  if (rule.strictness === "currency_tolerance" && !rule.currency_tolerance) errors.push("Currency tolerance is required for currency tolerance checks.");
  return errors;
}

export function describeFieldDependencies(rules: ComparisonRule[], fieldId: string) {
  const dependentRules = rules.filter((rule) =>
    rule.left_field_id === fieldId ||
    rule.right_field_id === fieldId ||
    rule.left_match_field_ids.includes(fieldId) ||
    rule.right_match_field_ids.includes(fieldId) ||
    rule.formula_settings?.operand_field_ids.includes(fieldId) ||
    rule.formula_settings?.result_field_id === fieldId,
  );
  return dependentRules.length;
}

export function describeSourceDependencies(rules: ComparisonRule[], sourceId: string) {
  return rules.filter((rule) => rule.left_data_source_id === sourceId || rule.right_data_source_id === sourceId).length;
}

export function countLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

export function titleCaseStrictness(strictness: RuleStrictness) {
  return strictnessLabels[strictness];
}
