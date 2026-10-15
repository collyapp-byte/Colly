// Small date helpers shared by the conversations UI.

function toDate(input: Date | string | number): Date {
  return input instanceof Date ? input : new Date(input);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * True when the timestamp is still ahead of now. Used by the human takeover
 * window, where a `pausedUntil` in the future means the AI is standing down.
 */
export function isInFuture(input: Date | string | number): boolean {
  return toDate(input).getTime() > Date.now();
}

/**
 * Short, human friendly relative time, e.g. "just now", "2m ago", "1h ago",
 * "Yesterday", "3d ago", "12 Oct".
 */
export function formatRelativeTime(input: Date | string | number): string {
  const date = toDate(input);
  const diffMs = Date.now() - date.getTime();

  if (diffMs < 60_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / 86_400_000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

/** Clock time on its own, e.g. "14:32". Used by the takeover banner. */
export function formatClockTime(input: Date | string | number): string {
  return toDate(input).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Timestamp shown under each chat bubble, e.g. "14:32", "Yesterday 09:10",
 * "12 Oct, 14:32".
 */
export function formatMessageTime(input: Date | string | number): string {
  const date = toDate(input);
  const time = formatClockTime(date);

  const dayDiff = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86_400_000,
  );

  if (dayDiff <= 0) return time;
  if (dayDiff === 1) return `Yesterday ${time}`;

  return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

/**
 * Formats an amount as Nigerian Naira, e.g. 145000 -> "₦145,000". Kobo (the two
 * decimal places) are only shown when the amount actually has them.
 */
export function formatNaira(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const hasKobo = Math.round(value * 100) % 100 !== 0;

  return `₦${value.toLocaleString("en-NG", {
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: hasKobo ? 2 : 0,
  })}`;
}
