import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal keyboard contract: focus moves into the dialog on open, Tab stays inside,
 * Escape closes it, and focus returns to the trigger on close.
 * The key listener sits on the dialog element itself, so with nested dialogs only the
 * innermost (focused) one reacts to Escape.
 */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!active || !dialog) return undefined;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () => [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null || element === document.activeElement);
    if (!dialog.contains(document.activeElement)) {
      const preferred = dialog.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? dialog;
      if (preferred === dialog && !dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      preferred.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [active, ref]);
}
