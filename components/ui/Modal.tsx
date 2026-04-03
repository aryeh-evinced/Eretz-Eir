"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  triggerRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function Modal({
  open,
  isOpen,
  onClose,
  title,
  description,
  triggerRef: externalTriggerRef,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const internalTriggerRef = useRef<Element | null>(null);
  const shown = open ?? isOpen ?? false;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (shown) {
      internalTriggerRef.current = document.activeElement;
      dialog.showModal();
    } else {
      dialog.close();
      const returnTarget = externalTriggerRef?.current ?? internalTriggerRef.current;
      if (returnTarget instanceof HTMLElement) {
        returnTarget.focus();
      }
    }
  }, [shown, externalTriggerRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    function handleClose() {
      onClose();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  if (!shown) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-transparent backdrop:bg-black/60 p-0 m-auto rounded-game max-w-md w-[calc(100%-2rem)]"
      aria-label={title}
    >
      <div className="bg-surface border border-border rounded-game p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold text-text-primary">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-2 text-text-dim transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
          >
            ✕
          </button>
        </div>
        {description && (
          <p className="text-text-dim text-sm mb-4">{description}</p>
        )}
        {children}
      </div>
    </dialog>
  );
}
