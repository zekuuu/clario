import { AlertTriangle, LoaderCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { checkBackendHealth } from "../../services/apiClient";
import { Button } from "../ui/Button";
import { Logo } from "./AppShell";

// A cold start of the packaged backend (unpacking + antivirus scan) has been measured at ~40 s.
const START_TIMEOUT_MS = 90_000;
const POLL_INTERVAL_MS = 500;

/** Shows a start-up screen until the local service answers, so the window can appear immediately. */
export function BackendGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"starting" | "ready" | "failed">("starting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    void (async () => {
      while (!cancelled) {
        try {
          await checkBackendHealth();
          if (!cancelled) setState("ready");
          return;
        } catch {
          if (Date.now() - started > START_TIMEOUT_MS) {
            if (!cancelled) setState("failed");
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (state === "ready") return children;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center text-center" role="status" aria-live="polite">
        <Logo className="size-12 object-contain" />
        {state === "starting" ? (
          <>
            <h1 className="mt-6 flex items-center gap-2 text-base font-semibold text-slate-900">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-slate-500" />
              Starting Clario…
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">The first start after installing can take up to a minute.</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 flex items-center gap-2 text-base font-semibold text-slate-900">
              <AlertTriangle aria-hidden="true" className="size-4 text-red-600" />
              Clario's local service didn't start
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Try again. If it keeps failing, restart Clario and check <code>data\logs\backend.log</code> in the install folder.
            </p>
            <Button
              className="mt-5"
              onClick={() => {
                setState("starting");
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
