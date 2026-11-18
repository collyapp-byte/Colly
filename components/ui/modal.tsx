"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Footer content rendered below the body (Cancel/Save buttons). */
  footer?: ReactNode;
};

export function Modal({ title, onClose, children, footer }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  // Keep the latest onClose without re-subscribing the keydown listener on every
  // parent render (onClose is usually an inline arrow function).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock page scrolling while the dialog is open; the modal body scrolls instead.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="surface-card mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto shadow-card-hover"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex flex-shrink-0 items-center justify-between gap-4 border-b border-card-border p-4 sm:p-5">
          <h2 className="font-display text-lg text-main">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted transition-all duration-250 hover:bg-surface-muted hover:text-muted"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 border-t border-card-border bg-card-surface p-4 sm:p-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
