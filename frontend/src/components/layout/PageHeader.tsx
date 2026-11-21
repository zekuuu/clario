import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 max-w-[65ch] text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {action ? <div className="flex shrink-0 sm:pb-0.5">{action}</div> : null}
    </header>
  );
}
