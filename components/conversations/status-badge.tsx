const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

const FALLBACK_STYLE = "bg-gray-100 text-gray-600";

export function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase();

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        STATUS_STYLES[key] ?? FALLBACK_STYLE
      }`}
    >
      {key}
    </span>
  );
}
