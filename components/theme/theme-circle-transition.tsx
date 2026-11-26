"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

type ThemeContextValue = {
  isDark: boolean;
  toggleTheme: (triggerRect?: DOMRect | null) => void;
  setTheme: (dark: boolean) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const TRANSITION_DURATION_MS = 520;
const FALLBACK_SWITCH_MS = Math.round(TRANSITION_DURATION_MS * 0.6);
const FALLBACK_CLEANUP_MS = 540;

const STORAGE_KEY = "colly-theme";

function applyTheme(dark: boolean) {
  if (typeof document === "undefined") return;
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeCircleTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // Check localStorage first (persisted across sessions), then fall back to
    // the OS-level prefers-color-scheme media query.
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const mountedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    applyTheme(isDark);
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [isDark]);

  const setTheme = useCallback(
    (dark: boolean) => {
      setIsDark(dark);
      localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
      applyTheme(dark);
    },
    [],
  );

  // Runs the circular screen-expanding transition on theme toggle.
  const runTransition = useCallback(
    (targetDark: boolean, triggerRect: DOMRect | null) => {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        setTheme(targetDark);
        return;
      }

      if (typeof document.startViewTransition === "function" && triggerRect) {
        const cx = triggerRect.left + triggerRect.width / 2;
        const cy = triggerRect.top + triggerRect.height / 2;
        const maxRadius = Math.hypot(
          Math.max(cx, window.innerWidth - cx),
          Math.max(cy, window.innerHeight - cy),
        );

        const VT = document.startViewTransition(() => {
          setTheme(targetDark);
        });

        VT.ready.then(() => {
          const root = document.documentElement;
          root.style.setProperty(
            "--vt-clip",
            `circle(0px at ${cx}px ${cy}px)`,
          );
          root.style.setProperty(
            "--vt-clip-to",
            `circle(${maxRadius}px at ${cx}px ${cy}px)`,
          );
          root.style.setProperty("--vt-duration", `${TRANSITION_DURATION_MS}ms`);
          root.style.setProperty("--vt-easing", "cubic-bezier(0.22, 1, 0.36, 1)");
          root.classList.add("vt-transitioning");

          VT.finished.then(() => {
            root.classList.remove("vt-transitioning");
            root.style.removeProperty("--vt-clip");
            root.style.removeProperty("--vt-clip-to");
            root.style.removeProperty("--vt-duration");
            root.style.removeProperty("--vt-easing");
          });
        });
        return;
      }

      runFallbackTransition(targetDark, triggerRect);
    },
    [setTheme],
  );

  const toggleTheme = useCallback(
    (triggerRect?: DOMRect | null) => {
      setTheme(!isDark);
      if (triggerRect) {
        runTransition(!isDark, triggerRect);
      }
    },
    [isDark, setTheme, runTransition],
  );

  const value: ThemeContextValue = { isDark, toggleTheme, setTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  // Safe SSR fallback: if no provider is mounted (e.g., server-side or
  // the component tree hasn't mounted yet), use the default light theme
  // so the dashboard shell never crashes on `/dashboard` during initial
  // render or when the provider is temporarily unmounted.
  if (!ctx) {
    return { isDark: false, toggleTheme: () => {}, setTheme: (dark: boolean) => {} };
  }
  return ctx;
}

function runFallbackTransition(targetDark: boolean, triggerRect: DOMRect | null) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) {
    setThemeFallback(targetDark);
    return;
  }

  const cx =
    triggerRect ? triggerRect.left + triggerRect.width / 2 : window.innerWidth / 2;
  const cy =
    triggerRect ? triggerRect.top + triggerRect.height / 2 : window.innerHeight / 2;
  const maxRadius = Math.hypot(
    Math.max(cx, window.innerWidth - cx),
    Math.max(cy, window.innerHeight - cy),
  );

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.pointerEvents = "none";
  overlay.style.clipPath = `circle(0px at ${cx}px ${cy}px)`;
  overlay.style.transition = `clip-path ${TRANSITION_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
  document.documentElement.appendChild(overlay);

  overlay.getBoundingClientRect();

  let switched = false;
  let finished = false;

  const switchTheme = () => {
    if (switched) return;
    switched = true;
    setThemeFallback(targetDark);
  };

  const cleanup = () => {
    if (finished) return;
    finished = true;
    overlay.remove();
  };

  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(${maxRadius}px at ${cx}px ${cy}px)`;
  });

  setTimeout(switchTheme, FALLBACK_SWITCH_MS);
  setTimeout(cleanup, FALLBACK_CLEANUP_MS);

  const onTransitionEnd = () => {
    if (!finished) cleanup();
  };
  overlay.addEventListener("transitionend", onTransitionEnd, { once: true });
}

function setThemeFallback(dark: boolean) {
  if (typeof document === "undefined") return;
  if (dark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {}
}

declare global {
  interface DOMRect {
    getCenter?: () => { x: number; y: number };
  }
}