"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, RefreshCw, Store } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";

/** The dashboard re-reads Jiji on its own at most once a day. */
const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

type JijiSyncCardProps = {
  /** Business.lastJijiSyncAt, or null when the shop has never been synced. */
  lastSyncedAt: Date | null;
  /** True when the catalogue holds at least one product with externalSource "JIJI". */
  hasJijiProducts: boolean;
  /** Re-reads the dashboard's copy of the status after a successful run. */
  onSynced?: () => void;
};

type SyncResponse = {
  success?: boolean;
  markedOutOfStock?: number;
  priceUpdates?: number;
  error?: string;
};

function syncSummary(data: SyncResponse | null): string {
  return `Synced! Marked ${data?.markedOutOfStock ?? 0} products out of stock and updated ${data?.priceUpdates ?? 0} prices.`;
}

/**
 * Jiji store card for the overview page.
 *
 * Two jobs: it is the owner's manual "Sync Now" (prices + sold listings) and the
 * lazy auto-sync - a store that has not synced in a day refreshes itself in the
 * background, silently, the first time the dashboard is opened.
 */
export function JijiSyncCard({
  lastSyncedAt,
  hasJijiProducts,
  onSynced,
}: JijiSyncCardProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const autoSyncTried = useRef(false);

  // Lazy auto-sync. Deliberately quiet: no spinner and no toast, because the
  // owner did not ask for this run. A failure simply leaves the stamp alone so
  // the next dashboard visit tries again; the button reports real errors.
  useEffect(() => {
    if (!hasJijiProducts || autoSyncTried.current) return;

    // Read the clock inside the effect: render must stay pure, and the freshness
    // check only matters once, on mount.
    const isStale =
      !lastSyncedAt ||
      Date.now() - lastSyncedAt.getTime() > AUTO_SYNC_INTERVAL_MS;
    if (!isStale) return;

    autoSyncTried.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/products/sync-jiji", { method: "POST" });
        if (!cancelled && res.ok) {
          onSynced?.();
        }
      } catch {
        // Offline, or Jiji is down: nothing to show the owner about a run they
        // never triggered.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasJijiProducts, lastSyncedAt, onSynced]);

  async function handleSyncNow() {
    if (syncing) return;

    setSyncing(true);
    try {
      const res = await fetch("/api/products/sync-jiji", { method: "POST" });
      const data = (await res.json().catch(() => null)) as SyncResponse | null;

      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? "Failed to sync with Jiji");
      }

      toast.success(syncSummary(data));
      onSynced?.();
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to sync with Jiji",
      );
    } finally {
      setSyncing(false);
    }
  }

  if (!hasJijiProducts) {
    return (
      <Card className="border-[color:var(--outline-subtle)]!">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-colly/10 text-colly">
              <Store className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Jiji Store Sync
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Connect your Jiji store to auto-sync
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Import your shop once and Colly keeps prices and stock in step.
              </p>
            </div>
          </div>
          <Link
            href="/products"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
          >
            Import from Jiji
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-[color:var(--outline-subtle)]!">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-colly/10 text-colly">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Jiji Store Sync
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Last synced:{" "}
              {lastSyncedAt ? formatRelativeTime(lastSyncedAt) : "Never"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Sold listings are marked out of stock and prices follow your shop.
              We check automatically once a day.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      </div>
    </Card>
  );
}
