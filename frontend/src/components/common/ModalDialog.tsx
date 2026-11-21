import { useRef, type ReactNode } from "react";
import { useDialogFocus } from "../../hooks/useDialogFocus";

interface ModalDialogProps {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className: string;
  /** Stacking layer for the overlay, e.g. "z-[70]". */
  layerClassName?: string;
  dataAttribute?: string;
}

/** Centered modal with a click-to-dismiss backdrop and the shared keyboard contract (see useDialogFocus). */
export function ModalDialog({ labelledBy, onClose, children, className, layerClassName = "z-[70]", dataAttribute }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, onClose);
  return (
    <div {...(dataAttribute ? { [dataAttribute]: "" } : {})} className={`fixed inset-0 ${layerClassName} flex items-center justify-center px-4`}>
      <div aria-hidden="true" className="absolute inset-0 bg-scrim/35 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={`relative ${className}`}>
        {children}
      </div>
    </div>
  );
}
