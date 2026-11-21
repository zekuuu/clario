import { ListChecks } from "lucide-react";
import { BuilderDrawer } from "../BuilderDrawer";
import { useDraftEditor } from "../../../hooks/useDraftEditor";
import type { ComparisonDataSource, ComparisonField, ComparisonRule, FormulaSettings, MatchStrategy, RuleStrictness, RuleType, Severity } from "../../../types/validation.types";
import { fieldLabel, formulaOperatorLabels, matchLabels, ruleTypeLabels, severityLabels, strictnessLabels, type ConfirmDialogState, type RuleEditorState, validateRule } from "../../../features/validation/builderModel";
import { CheckboxCard, EditorSection, SelectInput, TextInput } from "./BuilderFormControls";

export function RuleDrawer({
  editor,
  sources,
  fieldsBySource,
  open,
  onClose,
  onSave,
  requestConfirm,
}: {
  editor: RuleEditorState | null;
  sources: ComparisonDataSource[];
  fieldsBySource: Record<string, ComparisonField[]>;
  open: boolean;
  onClose: () => void;
  onSave: (rule: ComparisonRule) => void;
  requestConfirm: (state: ConfirmDialogState) => void;
}) {
  const { draft, setDraft, dirty, reset } = useDraftEditor(editor?.initial ?? null);

  if (!editor || !draft) return null;

  const leftFields = draft.left_data_source_id ? fieldsBySource[draft.left_data_source_id] ?? [] : [];
  const rightFields = draft.right_data_source_id ? fieldsBySource[draft.right_data_source_id] ?? [] : [];
  const formulaFields = leftFields;
  const errors = validateRule(draft);
  const footerMessage = errors[0] ?? (dirty ? "Save changes to update the validation logic used during runs and PDF export." : undefined);

  const handleCancel = () => {
    if (dirty) {
      requestConfirm({
        title: "Discard unsaved rule changes?",
        description: "Your current rule draft will be closed and the last saved rule will remain unchanged.",
        confirmLabel: "Discard changes",
        tone: "danger",
        onConfirm: () => {
          reset();
          onClose();
        },
      });
      return;
    }
    reset();
    onClose();
  };

  const handleDiscard = () => {
    requestConfirm({
      title: "Discard rule draft changes?",
      description: "This will throw away the current rule edits and restore the last saved version.",
      confirmLabel: "Discard changes",
      tone: "danger",
      onConfirm: () => {
        reset();
        onClose();
      },
    });
  };

  const updateFormula = (value: FormulaSettings) => {
    setDraft({ ...draft, formula_settings: value, left_field_id: value.result_field_id });
  };

  return (
    <BuilderDrawer
      title={editor.mode === "create" ? "Create rule" : "Edit rule"}
      description="Choose what to validate, where the trusted value comes from, and how strictly values should match."
      icon={ListChecks}
      open={open}
      dirty={dirty}
      onCancel={handleCancel}
      onDiscard={handleDiscard}
      onSave={() => onSave(draft)}
      saveLabel={editor.mode === "create" ? "Create rule" : "Save changes"}
      disableSave={errors.length > 0}
      warningMessage={footerMessage}
    >
      <div className="space-y-5">
        <EditorSection title="Rule identity" description="Name the check and decide how prominently it should surface in results.">
          <TextInput
            label="Rule name"
            help="A readable name for this check in the results and PDF report."
            value={draft.rule_name}
            onChange={(value) => setDraft({ ...draft, rule_name: value })}
            error={!draft.rule_name.trim() ? "Rule name is required." : undefined}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectInput
              label="Severity"
              help="Controls how important this issue appears in results."
              value={draft.severity}
              options={(Object.keys(severityLabels) as Severity[]).map((value) => ({ value, label: severityLabels[value] }))}
              onChange={(value) => setDraft({ ...draft, severity: value as Severity })}
            />
            <CheckboxCard
              checked={draft.enabled}
              onChange={(checked) => setDraft({ ...draft, enabled: checked })}
              label="Enabled"
              help="Disabled rules are saved but skipped during validation."
            />
          </div>
        </EditorSection>

        <EditorSection title="What to check" description="Choose the kind of validation the rule should perform.">
          <SelectInput
            label="Rule type"
            help="Choose the kind of validation to perform."
            value={draft.rule_type}
            options={(Object.keys(ruleTypeLabels) as RuleType[]).map((value) => ({ value, label: ruleTypeLabels[value] }))}
            onChange={(value) => setDraft({ ...draft, rule_type: value as RuleType })}
          />
        </EditorSection>

        <EditorSection title="Expected value" description="Choose the trusted source field or formula base.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectInput
              label="Source"
              help="The trusted value or formula source."
              value={draft.left_data_source_id ?? ""}
              options={sources.map((source) => ({ value: source.id, label: source.name }))}
              onChange={(value) => {
                const sourceFields = fieldsBySource[value] ?? [];
                const firstField = sourceFields[0];
                const secondField = sourceFields[1] ?? firstField;
                setDraft({
                  ...draft,
                  left_data_source_id: value,
                  left_field_id: firstField?.id ?? null,
                  left_match_field_ids: firstField?.id ? [firstField.id] : [],
                  formula_settings: draft.rule_type === "formula_check"
                    ? {
                        operator: draft.formula_settings?.operator ?? "multiply",
                        operand_field_ids: [firstField?.id ?? "", secondField?.id ?? ""],
                        result_field_id: firstField?.id ?? "",
                      }
                    : draft.formula_settings,
                });
              }}
            />
            <SelectInput
              label="Field"
              help="The trusted value or formula source."
              value={draft.left_field_id ?? ""}
              options={leftFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
              onChange={(value) => setDraft({ ...draft, left_field_id: value })}
            />
          </div>
        </EditorSection>

        {draft.rule_type === "compare_values" ? (
          <EditorSection title="Actual value" description="Choose the field that should match the expected value.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectInput
                label="Source"
                help="The value being checked against the expected value."
                value={draft.right_data_source_id ?? ""}
                options={sources.map((source) => ({ value: source.id, label: source.name }))}
                onChange={(value) => {
                  const sourceFields = fieldsBySource[value] ?? [];
                  const firstField = sourceFields[0];
                  setDraft({
                    ...draft,
                    right_data_source_id: value,
                    right_field_id: firstField?.id ?? null,
                    right_match_field_ids: firstField?.id ? [firstField.id] : [],
                  });
                }}
              />
              <SelectInput
                label="Field"
                help="The value being checked against the expected value."
                value={draft.right_field_id ?? ""}
                options={rightFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => setDraft({ ...draft, right_field_id: value })}
              />
            </div>
          </EditorSection>
        ) : null}

        {draft.rule_type === "formula_check" ? (
          <EditorSection title="Formula setup" description="Choose the two input fields, operator, and result field for the formula check.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectInput
                label="First value"
                help="The trusted value or formula source."
                value={draft.formula_settings?.operand_field_ids[0] ?? ""}
                options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => updateFormula({
                  operator: draft.formula_settings?.operator ?? "multiply",
                  operand_field_ids: [value, draft.formula_settings?.operand_field_ids[1] ?? value],
                  result_field_id: draft.formula_settings?.result_field_id ?? value,
                })}
              />
              <SelectInput
                label="Operator"
                help="Choose the formula operator used to derive the expected result."
                value={draft.formula_settings?.operator ?? "multiply"}
                options={(Object.keys(formulaOperatorLabels) as FormulaSettings["operator"][]).map((value) => ({ value, label: formulaOperatorLabels[value] }))}
                onChange={(value) => updateFormula({
                  operator: value as FormulaSettings["operator"],
                  operand_field_ids: draft.formula_settings?.operand_field_ids ?? ["", ""],
                  result_field_id: draft.formula_settings?.result_field_id ?? "",
                })}
              />
              <SelectInput
                label="Second value"
                help="The trusted value or formula source."
                value={draft.formula_settings?.operand_field_ids[1] ?? ""}
                options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => updateFormula({
                  operator: draft.formula_settings?.operator ?? "multiply",
                  operand_field_ids: [draft.formula_settings?.operand_field_ids[0] ?? value, value],
                  result_field_id: draft.formula_settings?.result_field_id ?? value,
                })}
              />
              <SelectInput
                label="Actual result field"
                help="The value being checked against the expected value."
                value={draft.formula_settings?.result_field_id ?? ""}
                options={formulaFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => updateFormula({
                  operator: draft.formula_settings?.operator ?? "multiply",
                  operand_field_ids: draft.formula_settings?.operand_field_ids ?? [value, value],
                  result_field_id: value,
                })}
              />
            </div>
          </EditorSection>
        ) : null}

        <EditorSection title="Matching and strictness" description="Control how rows are paired and how exact values must be before the rule reports an issue.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectInput
              label="Match rows by"
              help="Controls how rows from different sources are paired before comparison."
              value={draft.match_strategy}
              options={(Object.keys(matchLabels) as MatchStrategy[]).filter((value) => value !== "manual_placeholder").map((value) => ({ value, label: matchLabels[value] }))}
              onChange={(value) => setDraft({ ...draft, match_strategy: value as MatchStrategy })}
            />
            <SelectInput
              label="Comparison strictness"
              help="Controls how exact the values must be."
              value={draft.strictness}
              options={(Object.keys(strictnessLabels) as RuleStrictness[]).map((value) => ({ value, label: strictnessLabels[value] }))}
              onChange={(value) => setDraft({ ...draft, strictness: value as RuleStrictness })}
            />
          </div>
          {draft.rule_type === "compare_values" && draft.match_strategy !== "by_row_order" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectInput
                label="Expected match key"
                help="Field that identifies the same row in the expected source, such as SKU or item number."
                value={draft.left_match_field_ids[0] ?? ""}
                options={leftFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => setDraft({ ...draft, left_match_field_ids: value ? [value] : [] })}
              />
              <SelectInput
                label="Actual match key"
                help="Field that identifies the same row in the actual source."
                value={draft.right_match_field_ids[0] ?? ""}
                options={rightFields.map((field) => ({ value: field.id, label: fieldLabel(field) }))}
                onChange={(value) => setDraft({ ...draft, right_match_field_ids: value ? [value] : [] })}
              />
            </div>
          ) : null}
          {draft.strictness === "numeric_tolerance" || draft.strictness === "currency_tolerance" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {draft.strictness === "numeric_tolerance" ? (
                <TextInput label="Numeric tolerance" help="Allowed numeric difference before this rule reports a mismatch." value={draft.numeric_tolerance ?? ""} onChange={(value) => setDraft({ ...draft, numeric_tolerance: value || null })} />
              ) : null}
              {draft.strictness === "currency_tolerance" ? (
                <TextInput label="Currency tolerance" help="Allowed currency difference before this rule reports a mismatch." value={draft.currency_tolerance ?? ""} onChange={(value) => setDraft({ ...draft, currency_tolerance: value || null })} />
              ) : null}
            </div>
          ) : null}
        </EditorSection>
      </div>
    </BuilderDrawer>
  );
}
