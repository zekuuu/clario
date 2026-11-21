import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

export interface BuilderStep {
  id: string;
  label: string;
  icon: LucideIcon;
  complete?: boolean;
  warning?: boolean;
}

interface BuilderStepperProps {
  steps: BuilderStep[];
  activeStep: string;
  onStepChange: (step: string) => void;
}

function stepStatus(step: BuilderStep) {
  if (step.warning) return "Needs attention";
  if (step.complete) return "Complete";
  return "";
}

export function BuilderStepper({ steps, activeStep, onStepChange }: BuilderStepperProps) {
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep));
  const previousStep = activeIndex > 0 ? steps[activeIndex - 1] : null;
  const nextStep = activeIndex < steps.length - 1 ? steps[activeIndex + 1] : null;
  const activeStepLabel = steps[activeIndex]?.label ?? "Current step";

  return (
    <>
      <nav aria-label="Builder sections" className="overflow-hidden rounded-3xl border border-slate-200 bg-panel shadow-sm">
        <div className="overflow-x-auto p-2">
          <div className="grid min-w-[760px] gap-2 md:min-w-0 md:grid-cols-5">
            {steps.map((step) => {
              const Icon = step.icon;
              const active = step.id === activeStep;
              const status = stepStatus(step);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onStepChange(step.id)}
                  aria-current={active ? "step" : undefined}
                  className={`flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                    active ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Icon aria-hidden="true" className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block min-w-0 truncate text-sm font-semibold">{step.label}</span>
                    {status ? <span className={`block text-xs ${step.warning ? "text-amber-700" : "text-emerald-700"}`}>{status}</span> : null}
                  </span>
                  {step.warning ? <AlertTriangle aria-hidden="true" className="ml-auto size-4 shrink-0 text-amber-600" /> : null}
                  {!step.warning && step.complete ? <CheckCircle2 aria-hidden="true" className="ml-auto size-4 shrink-0 text-emerald-600" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <footer className="fixed bottom-4 left-[var(--app-sidebar-offset,0px)] right-0 z-40 px-3 transition-[left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-4 lg:px-6">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 rounded-3xl border border-slate-200 bg-panel/95 p-1.5 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          {previousStep ? (
            <button
              type="button"
              onClick={() => onStepChange(previousStep.id)}
              title={`Back to ${previousStep.label}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-panel px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </button>
          ) : (
            <span className="hidden w-20 sm:block" />
          )}

          <div className="order-first min-w-0 px-3 py-1 text-center sm:order-none" aria-live="polite">
            <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Current: {activeStepLabel}</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-700">{nextStep ? `Next: ${nextStep.label}` : "Run validation when the setup is ready"}</p>
          </div>

          {nextStep ? (
            <button
              type="button"
              onClick={() => onStepChange(nextStep.id)}
              title={`Continue to ${nextStep.label}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Next
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
          ) : (
            <span className="hidden w-20 sm:block" />
          )}
        </div>
      </footer>
    </>
  );
}
