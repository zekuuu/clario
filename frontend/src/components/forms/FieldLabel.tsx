import type { ReactNode } from "react";
import { HelpTip } from "./HelpTip";

interface FieldLabelProps {
  children: ReactNode;
  /** Tooltip text. Omit when the same help is already shown as visible text below the field. */
  help?: string;
  required?: boolean;
  className?: string;
  /** When set, renders a real <label> bound to the input with this id. */
  htmlFor?: string;
}

export function FieldLabel({ children, help, required = false, className = "text-xs text-slate-600", htmlFor }: FieldLabelProps) {
  const text = <>{children}{required ? " *" : ""}</>;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${className}`}>
      {htmlFor ? <label htmlFor={htmlFor}>{text}</label> : <span>{text}</span>}
      {help ? <HelpTip text={help} /> : null}
    </span>
  );
}
