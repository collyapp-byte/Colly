import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";

interface FilterBarProps {
  children?: ReactNode;
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add filter
      </button>
      {children}
    </div>
  );
}

interface FilterChipProps {
  active?: boolean;
  children: ReactNode;
  onRemove?: () => void;
}

export function FilterChip({ active = true, children, onRemove }: FilterChipProps) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
        active
          ? "border-gray-300 bg-white text-gray-700"
          : "border-gray-200 bg-gray-50 text-gray-500"
      }`}
    >
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 rounded-full p-0.5 hover:bg-gray-100">
          <X className="h-3 w-3" aria-hidden />
        </button>
      )}
    </div>
  );
}

interface ClearAllProps {
  onClick?: () => void;
}

export function ClearAll({ onClick }: ClearAllProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto text-sm text-[var(--color-colly)] transition-colors hover:underline"
    >
      Clear all
    </button>
  );
}
