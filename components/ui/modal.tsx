"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Footer content rendered below the body (Cancel/Save buttons). */
  footer?: ReactNode;
};

export function Modal({ title, onClose, children, footer }: ModalProps) {
  // Keep the latest onClose without re-subscribing the keydown listener on every
  // parent render (onClose is usually an inline arrow function).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="h-full w-full max-w-lg mx-auto rounded-none bg-white/80 backdrop-blur-lg border border-white/50 shadow-2xl flex flex-col sm:fixed sm:inset-auto sm:mx-auto sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex-shrink-0 mb-4 flex items-center justify-between gap-4 p-4 sm:p-5 border-b border-gray-200">
          <h2 className="font-display text-lg text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-white/60 p-4 backdrop-blur-md sm:p-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
