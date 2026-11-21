import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "error";

interface ToastNotification {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, tone: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles = {
  success: {
    icon: CheckCircle2,
    container: "border-emerald-200 text-emerald-700",
    progress: "bg-emerald-500",
  },
  error: {
    icon: AlertCircle,
    container: "border-red-200 text-red-700",
    progress: "bg-red-500",
  },
} satisfies Record<ToastTone, { icon: typeof CheckCircle2; container: string; progress: string }>;

function ToastItem({ notification, onRemove }: { notification: ToastNotification; onRemove: () => void }) {
  const [exiting, setExiting] = useState(false);
  const style = toneStyles[notification.tone];
  const Icon = style.icon;

  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  const dismiss = () => setExiting(true);

  useEffect(() => {
    if (!exiting) return undefined;
    const timeout = window.setTimeout(() => onRemoveRef.current(), 220);
    return () => window.clearTimeout(timeout);
  }, [exiting]);

  useEffect(() => {
    // Errors stay until dismissed so long messages can be read (WCAG 2.2.1).
    if (!Number.isFinite(notification.duration)) return undefined;
    const timeout = window.setTimeout(() => setExiting(true), notification.duration);
    return () => window.clearTimeout(timeout);
  }, [notification.duration]);

  return (
    <div
      className={`relative flex shrink-0 items-start gap-3 overflow-hidden rounded-xl border bg-panel px-4 py-3 text-sm font-medium shadow-lg shadow-slate-900/10 ${style.container} ${exiting ? "toast-exit" : ""}`}
      role={notification.tone === "error" ? "alert" : undefined}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 flex-1">{notification.message}</span>
      <button
        type="button"
        onClick={dismiss}
        className="-mr-1 grid size-6 shrink-0 place-items-center rounded text-current/60 transition hover:bg-slate-100 hover:text-current focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
        aria-label="Dismiss notification"
        title="Dismiss notification"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
      {Number.isFinite(notification.duration) ? <span aria-hidden="true" className={`toast-progress absolute inset-x-0 bottom-0 h-px ${style.progress}`} /> : null}
    </div>
  );
}

function ToastViewport({ notifications, onRemove }: { notifications: ToastNotification[]; onRemove: (id: number) => void }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const updateOverflow = () => setIsOverflowing(content.scrollHeight > viewport.clientHeight + 1);
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [notifications.length]);

  return (
    <div ref={viewportRef} className={`toast-viewport fixed bottom-5 right-5 z-[140] flex max-h-[33vh] w-[min(22rem,calc(100vw-2rem))] flex-col justify-end gap-2 overflow-hidden ${isOverflowing ? "toast-viewport--overflowing" : ""}`} role="region" aria-label="Notifications">
      {/* Persistent live region: content inserted later is announced reliably. */}
      <div ref={contentRef} className="flex flex-col gap-2" aria-live="polite" aria-relevant="additions">
        {notifications.map((notification) => (
          <ToastItem key={notification.id} notification={notification} onRemove={() => onRemove(notification.id)} />
        ))}
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [notifications, setNotifications] = useState<ToastNotification[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone) => {
    const id = nextId.current++;
    setNotifications((current) => [{ id, message, tone, duration: tone === "error" ? Number.POSITIVE_INFINITY : 4000 }, ...current]);
  }, []);
  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  const removeToast = (id: number) => setNotifications((current) => current.filter((notification) => notification.id !== id));

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastViewport notifications={notifications} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}