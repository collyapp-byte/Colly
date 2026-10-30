"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the ROOT layout itself.
 *
 * Next replaces the whole document with this component, which means
 * `app/layout.tsx` never runs: no `globals.css`, no Inter, no providers. Every
 * style below is therefore inline — Tailwind classes would compile but match no
 * loaded stylesheet and the page would render unstyled.
 *
 * It must render `<html>` and `<body>` itself, and it cannot be marked
 * `dynamic`/`static`. `retry()` re-renders the root segment.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[global] root layout error:", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en-NG">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f7f7f5",
          color: "#111827",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <main
          style={{
            maxWidth: "28rem",
            margin: "0 1rem",
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
          }}
        >
          <h1
            style={{
              margin: "0 0 0.75rem",
              fontSize: "1.5rem",
              lineHeight: 1.25,
              color: "#111827",
            }}
          >
            Colly could not start this page
          </h1>

          <p role="alert" style={{ margin: 0, fontSize: "0.9375rem", color: "#4b5563" }}>
            Something failed before the page could load. Try again — if it keeps
            happening, contact support and quote the reference below.
          </p>

          {error.digest && (
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "#6b7280" }}>
              Reference:{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
                {error.digest}
              </span>
            </p>
          )}

          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1.5rem",
              minHeight: "44px",
              minWidth: "44px",
              padding: "0.75rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#FF6600",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
