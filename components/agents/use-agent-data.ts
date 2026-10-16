"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AgentDataState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
};

/**
 * Returned by the fetch handler when the session is missing (HTTP 401). It keeps
 * `loading` true while the redirect to the agent login page is in flight, so the
 * consumer never briefly renders an empty/error state during the navigation.
 */
const REDIRECTING = Symbol("redirecting");

/**
 * Module-level revision counter: bumping it re-runs the fetch inside every
 * mounted `useAgentData` instance, and `refresh()` is a per-consumer shorthand
 * for the same thing. After a quiz pass awards a badge, the quiz page calls
 * `revalidateAgentData()` so any badge/progress views refetch without a full
 * page reload.
 */
let revision = 0;
const subscribers = new Set<() => void>();

export function revalidateAgentData(): void {
  revision += 1;
  for (const notify of subscribers) notify();
}

/**
 * Fetches an agent API endpoint and sends the visitor to the agent login page
 * when the session is missing (HTTP 401). Used by the agent client pages.
 *
 * "Loading" is derived from whether the requested URL has resolved yet rather
 * than tracked with a synchronous `setState` at the top of the effect, which
 * would trigger a cascading render. On a `refresh()`/`revalidateAgentData()`
 * the previously loaded data is kept on screen until the new payload lands.
 */
export function useAgentData<T>(url: string): AgentDataState<T> {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [rev, setRev] = useState(revision);

  useEffect(() => {
    const notify = () => setRev(revision);
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login?role=agent");
          // Skip the error render: keep `loading` true until the route changes.
          return REDIRECTING;
        }

        const payload = (await response.json().catch(() => null)) as
          | (T & { error?: string })
          | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load");
        }

        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        if (payload === REDIRECTING) return;
        if (payload) {
          setData(payload);
          setError(null);
        }
        setLoadedUrl(url);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Failed to load");
        setLoadedUrl(url);
      });

    return () => {
      cancelled = true;
    };
  }, [url, router, rev]);

  const refresh = useCallback(() => {
    revalidateAgentData();
  }, []);

  return { data, error, loading: loadedUrl !== url, refresh };
}
