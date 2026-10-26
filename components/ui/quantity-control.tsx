"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

/** Highest quantity a single line may hold. Mirrors the cart's clamp. */
const MAX_QUANTITY = 999;

type QuantityControlProps = {
  quantity: number;
  onChange: (quantity: number) => void;
  /**
   * Lowest value the − button honours. Pressing − at this value either removes
   * the item (when `onRemove` is given) or is disabled. Defaults to 1.
   */
  minQuantity?: number;
  /** Called when − is pressed at `minQuantity`. When omitted, − is disabled there. */
  onRemove?: () => void;
};

/**
 * Per-line quantity stepper. The number renders as text and turns into a
 * focused, select-all number input on click; Enter or blur commits. At the
 * minimum, − removes the item when `onRemove` is provided (the Quick Sale
 * picker) and is disabled otherwise (the cart, where the × is the explicit
 * remove) so a stray tap can never drop a line.
 */
export function QuantityControl({
  quantity,
  onChange,
  minQuantity = 1,
  onRemove,
}: QuantityControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEditing() {
    setDraft(String(quantity));
    setEditing(true);
  }

  function commit() {
    const parsed = Number(draft.trim());
    if (Number.isInteger(parsed) && parsed >= minQuantity) {
      onChange(Math.min(parsed, MAX_QUANTITY));
    }
    setEditing(false);
  }

  const atMin = quantity <= minQuantity;
  const atMax = quantity >= MAX_QUANTITY;

  function decrease() {
    if (atMin) {
      onRemove?.();
      return;
    }
    onChange(quantity - 1);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={decrease}
        disabled={atMin && !onRemove}
        aria-label={atMin && onRemove ? "Remove item" : "Decrease quantity"}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min={minQuantity}
          max={MAX_QUANTITY}
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              setEditing(false);
            }
          }}
          aria-label="Quantity"
          className="min-h-[44px] w-10 rounded-md border border-gray-300 text-center text-sm font-semibold text-gray-900 outline-none focus:border-colly focus:ring-2 focus:ring-colly/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Quantity ${quantity}, click to edit`}
          className="min-h-[44px] w-10 rounded-md text-center text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100"
        >
          {quantity}
        </button>
      )}

      <button
        type="button"
        onClick={() => onChange(quantity + 1)}
        disabled={atMax}
        aria-label="Increase quantity"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
