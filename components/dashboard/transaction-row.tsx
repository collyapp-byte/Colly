"use client";

import { formatNaira } from "@/lib/format";

/**
 * A single "Past Transactions" row. Deliberately a Client Component: date
 * formatting reads the wall clock, and doing it during the server prerender
 * makes Next.js abort the /ai route with "encountered the unstable value
 * `Date.now()`". Rendering on the client keeps the page prerenderable.
 */
export function TransactionRow({
  amount,
  date,
  status,
}: {
  amount: number;
  date: Date | string;
  status: string;
}) {
  const when = new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));

  return (
    <div className="surface-panel flex items-center justify-between p-3 text-sm">
      <div>
        <p className="font-medium text-main">{status}</p>
        <p className="text-xs text-muted">{when}</p>
      </div>
      <span className="font-semibold text-main">
        {formatNaira(Number(amount))}
      </span>
    </div>
  );
}
