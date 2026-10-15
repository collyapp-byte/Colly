"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AgentDataState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Returned by the fetch handler when the session is missing (HTTP 401). It keeps
 * `loading` true while the redirect to the agent login page is in flight, so the
 * consumer never briefly renders an empty/error state during the navigation.
 */
const REDIRECTING = Symbol("redirecting");

/**
 * Fetches an agent API endpoint and sends the visitor to the agent login page
 * when the session is missing (HTTP 401). Used by the agent client pages.
 *
 * "Loading" is derived from whether the requested URL has resolved yet rather
 * than tracked with a synchronous `setState` at the top of the effect, which
 * would trigger a cascading render.
 */
export function useAgentData<T>(url: string): AgentDataState<T> {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/agents/login");
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
  }, [url, router]);

  return { data, error, loading: loadedUrl !== url };
}
