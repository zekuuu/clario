import type { ComparisonDataSource, ComparisonField, ComparisonRule, DataSourcePreview } from "../../types/validation.types";
import { fieldLabel, makeId, normalizedFieldName, suggestedRuleSeverity, suggestedRuleStrictness } from "./builderModel";

// Each group lists names that identify the same kind of row key, so "SKU" can pair with "Product Code".
const MATCH_KEY_GROUPS = [
  ["sku", "productcode", "itemcode", "partnumber", "partno", "itemnumber", "itemno", "code"],
  ["line", "lineno", "linenumber"],
];

function findSuggestedMatchKey(left: ComparisonDataSource, right: ComparisonDataSource, comparedFieldKey: string) {
  const inGroup = (field: ComparisonField, group: string[]) => group.some((term) => normalizedFieldName(field).includes(term));
  for (const group of MATCH_KEY_GROUPS) {
    for (const term of group) {
      const leftField = left.fields.find((field) => normalizedFieldName(field).includes(term) && normalizedFieldName(field) !== comparedFieldKey);
      if (!leftField) continue;
      const rightField =
        right.fields.find((field) => normalizedFieldName(field) === normalizedFieldName(leftField)) ??
        right.fields.find((field) => inGroup(field, group) && normalizedFieldName(field) !== comparedFieldKey);
      if (rightField) return { leftField, rightField };
    }
  }
  return null;
}

function makeCompareRule(left: ComparisonDataSource, right: ComparisonDataSource, leftField: ComparisonField, rightField: ComparisonField): ComparisonRule {
  const fieldName = fieldLabel(leftField);
  const fieldKey = normalizedFieldName(leftField);
  const matchKey = findSuggestedMatchKey(left, right, fieldKey);
  const leftKey = matchKey?.leftField ?? leftField;
  const rightKey = matchKey?.rightField ?? rightField;
  const strictness = suggestedRuleStrictness(leftField);
  return {
    id: makeId("rule"),
    rule_name: `${fieldName} comparison`,
    rule_type: "compare_values",
    left_data_source_id: left.id,
    left_field_id: leftField.id,
    right_data_source_id: right.id,
    right_field_id: rightField.id,
    left_match_field_ids: [leftKey.id],
    right_match_field_ids: [rightKey.id],
    match_strategy: leftKey.id === leftField.id ? "by_row_order" : "by_item_number_field",
    strictness,
    numeric_tolerance: null,
    currency_tolerance: strictness === "currency_tolerance" ? "0.01" : null,
    formula_settings: null,
    severity: suggestedRuleSeverity(leftField),
    enabled: true,
  };
}

function normalizedCellValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const numeric = raw.replace(/[$,%\s,]+/g, "");
  if (numeric && !Number.isNaN(Number(numeric))) return String(Number(numeric));
  return raw.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}. -]+/gu, "").trim();
}

function previewRowsForSource(source: ComparisonDataSource, preview?: DataSourcePreview) {
  if (!preview) return [];
  const selectedRows = new Set(source.selected_row_numbers);
  return preview.rows
    .filter((row) => {
      if (row.ignored || source.ignored_row_numbers.includes(row.row_number)) return false;
      if (selectedRows.size) return selectedRows.has(row.row_number);
      return row.selected || row.row_number >= source.first_data_row;
    })
    .sort((leftRow, rightRow) => leftRow.row_number - rightRow.row_number);
}

function previewCellValueForField(row: DataSourcePreview["rows"][number], preview: DataSourcePreview, field: ComparisonField) {
  const column = preview.columns.find((item) => item.letter.toUpperCase() === field.column_letter.toUpperCase());
  return row.cells[column?.header_label ?? field.column_letter] ?? row.cells[field.column_letter] ?? null;
}

function valuesForField(source: ComparisonDataSource, preview: DataSourcePreview | undefined, field: ComparisonField, keepEmpty = false) {
  if (!preview) return [];
  const values = previewRowsForSource(source, preview).map((row) => normalizedCellValue(previewCellValueForField(row, preview, field)));
  return keepEmpty ? values : values.filter(Boolean);
}

function countOverlappingValues(leftValues: string[], rightValues: string[]) {
  const rightCounts = new Map<string, number>();
  for (const value of rightValues) {
    rightCounts.set(value, (rightCounts.get(value) ?? 0) + 1);
  }

  let matches = 0;
  for (const value of leftValues) {
    const count = rightCounts.get(value) ?? 0;
    if (count <= 0) continue;
    matches += 1;
    rightCounts.set(value, count - 1);
  }
  return matches;
}

function scoreFieldValueMatch(
  left: ComparisonDataSource,
  right: ComparisonDataSource,
  leftPreview: DataSourcePreview | undefined,
  rightPreview: DataSourcePreview | undefined,
  leftField: ComparisonField,
  rightField: ComparisonField,
) {
  const alignedLeftValues = valuesForField(left, leftPreview, leftField, true);
  const alignedRightValues = valuesForField(right, rightPreview, rightField, true);
  const leftValues = alignedLeftValues.filter(Boolean);
  const rightValues = alignedRightValues.filter(Boolean);
  const comparableRows = Math.min(alignedLeftValues.length, alignedRightValues.length);
  if (!comparableRows) return 0;

  const alignedComparisons = alignedLeftValues
    .slice(0, comparableRows)
    .map((value, index) => [value, alignedRightValues[index]] as const)
    .filter(([leftValue, rightValue]) => leftValue && rightValue);
  const alignedMatches = alignedComparisons.filter(([leftValue, rightValue]) => leftValue === rightValue).length;
  const overlapMatches = countOverlappingValues(leftValues, rightValues);
  const alignedRatio = alignedComparisons.length ? alignedMatches / alignedComparisons.length : 0;
  const overlapRatio = overlapMatches / Math.max(1, Math.min(leftValues.length, rightValues.length));
  const uniqueMatches = new Set(leftValues.filter((value) => rightValues.includes(value))).size;
  const enoughAlignedMatches = alignedMatches >= 1 && alignedRatio >= 0.25;
  const enoughOverlappingMatches = overlapMatches >= 1 && overlapRatio >= 0.25 && uniqueMatches >= 1;

  if (!enoughAlignedMatches && !enoughOverlappingMatches) return 0;
  return Math.max(alignedRatio, overlapRatio * 0.85);
}

export function buildCompareRulesForMatchingFields(
  left: ComparisonDataSource,
  right: ComparisonDataSource,
  leftPreview?: DataSourcePreview,
  rightPreview?: DataSourcePreview,
) {
  const rightFieldsByName = new Map<string, ComparisonField>();
  for (const field of right.fields) {
    const key = normalizedFieldName(field);
    if (key && !rightFieldsByName.has(key)) {
      rightFieldsByName.set(key, field);
    }
  }

  const matchedLeftFieldIds = new Set<string>();
  const matchedRightFieldIds = new Set<string>();
  const rules: ComparisonRule[] = [];

  for (const leftField of left.fields) {
    const rightField = rightFieldsByName.get(normalizedFieldName(leftField));
    if (!rightField || matchedRightFieldIds.has(rightField.id)) continue;
    matchedLeftFieldIds.add(leftField.id);
    matchedRightFieldIds.add(rightField.id);
    rules.push(makeCompareRule(left, right, leftField, rightField));
  }

  const candidates = left.fields
    .filter((leftField) => !matchedLeftFieldIds.has(leftField.id))
    .flatMap((leftField) =>
      right.fields
        .filter((rightField) => !matchedRightFieldIds.has(rightField.id))
        .map((rightField) => ({
          leftField,
          rightField,
          score: scoreFieldValueMatch(left, right, leftPreview, rightPreview, leftField, rightField),
        }))
        .filter((candidate) => candidate.score > 0),
    )
    .sort((leftCandidate, rightCandidate) => rightCandidate.score - leftCandidate.score);

  for (const candidate of candidates) {
    if (matchedLeftFieldIds.has(candidate.leftField.id) || matchedRightFieldIds.has(candidate.rightField.id)) continue;
    matchedLeftFieldIds.add(candidate.leftField.id);
    matchedRightFieldIds.add(candidate.rightField.id);
    rules.push(makeCompareRule(left, right, candidate.leftField, candidate.rightField));
  }

  return rules;
}
