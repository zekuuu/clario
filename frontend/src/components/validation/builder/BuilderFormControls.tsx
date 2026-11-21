import { useId } from "react";
import { FieldLabel } from "../../forms/FieldLabel";
import { SelectField } from "../../forms/SelectField";

export function EditorSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-panel p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function TextInput({
  label,
  help,
  value,
  onChange,
  type = "text",
  error,
}: {
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      </div>
      <input
        id={id}
        type={type}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-2xl border px-3 py-2.5 text-sm outline-none transition focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${error ? "border-red-300 bg-red-50" : "border-slate-300 bg-panel"}`}
      />
      <p id={`${id}-help`} role={error ? "alert" : undefined} className={`mt-2 text-sm ${error ? "text-red-700" : "text-slate-500"}`}>{error ?? help}</p>
    </div>
  );
}

export function SelectInput({
  label,
  help,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  help: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <FieldLabel>{label}</FieldLabel>
      </div>
      <SelectField
        value={value}
        onChange={onChange}
        ariaLabel={label}
        helpText={help}
        options={[{ value: "", label: "Select an option", description: help }, ...options]}
        className={`${error ? "[&_button]:border-red-300 [&_button]:bg-red-50 [&_button]:text-slate-900" : ""}`}
      />
      <p className={`mt-2 text-sm ${error ? "text-red-700" : "text-slate-500"}`}>{error ?? help}</p>
    </div>
  );
}

export function CheckboxCard({
  checked,
  onChange,
  label,
  help,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <label className="flex self-start items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-4 rounded border-slate-300 accent-brand" />
      <span className="space-y-1">
        <span className="flex items-center gap-1 font-semibold text-slate-900">
          {label}
        </span>
        <span className="block text-sm text-slate-500">{help}</span>
      </span>
    </label>
  );
}
