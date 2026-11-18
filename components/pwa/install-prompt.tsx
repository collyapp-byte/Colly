"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

/**
 * The Chromium install event. It is not part of `lib.dom.d.ts`, so the shape is
 * declared here: `prompt()` shows the browser's own "Install app" dialog and
 * `userChoice` resolves with what the visitor picked.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/**
 * True when the app is already running as an installed app: Chromium reports
 * the `standalone` display mode, iOS Safari exposes its own `standalone` flag.
 */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Safari never fires `beforeinstallprompt`; on iOS the visitor installs through
 * Share → "Add to Home Screen". iPadOS 13+ reports a desktop Mac user agent, so
 * a touch-capable "Mac" is treated as an iPad.
 */
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isIpadOs = /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  const isSafari =
    /safari/i.test(ua) && !/crios|fxios|edgios|chrome|android/i.test(ua);
  return (isIos || isIpadOs) && isSafari;
}

/**
 * The three states the button cares about. Read through `useSyncExternalStore`
 * rather than a `setState` inside an effect: the server snapshot is "browser"
 * (no button, so the server HTML and the hydration pass agree) and the real
 * value is applied on the first client pass, including when the visitor
 * installs the app while this page is open.
 */
type Environment = "standalone" | "ios" | "browser";

function readEnvironment(): Environment {
  if (typeof window === "undefined") return "browser";
  if (isStandalone()) return "standalone";
  if (isIosSafari()) return "ios";
  return "browser";
}

function getServerEnvironment(): Environment {
  return "browser";
}

function subscribeEnvironment(onChange: () => void): () => void {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onChange);
  return () => displayMode.removeEventListener("change", onChange);
}

/**
 * The dashboard header's "Install app" button.
 *
 * Chrome, Edge and Android only hand a page the `beforeinstallprompt` event
 * when the site has a manifest and a service worker, so this component also
 * registers `public/sw.js`. The event is captured (and its default mini-infobar
 * suppressed) until the visitor presses the button, because a `prompt()` call
 * is only allowed once per event.
 *
 * The button renders nothing until it has something useful to do: no prompt
 * available, already installed, or the browser cannot install (desktop Safari,
 * Firefox) means no button rather than a dead control. iOS gets the share-sheet
 * instructions instead, since Safari never exposes the event.
 */
export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const environment = useSyncExternalStore(
    subscribeEnvironment,
    readEnvironment,
    getServerEnvironment,
  );
  const iosHint = environment === "ios";

  // Registering the worker is what makes the app installable in Chromium. The
  // worker never caches anything (see public/sw.js), so this cannot serve a
  // stale page after a deploy; a failure only means the button never appears.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[pwa] service worker registration failed:", error);
    });
  }, []);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      // Without preventDefault the browser shows its own mini-infobar and never
      // gives the page a chance to ask at a sensible moment.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setPromptEvent(null);
      setInstalled(true);
      toast.success("Colly is installed", {
        description: "Open it from your home screen any time.",
      });
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (iosHint) {
      toast("Add Colly to your home screen", {
        description:
          "Tap the Share button in Safari, then choose Add to Home Screen.",
      });
      return;
    }

    if (!promptEvent) return;

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === "accepted") {
        setInstalled(true);
      } else {
        toast("Install cancelled", {
          description: "You can install Colly later from your browser menu.",
        });
      }
    } catch (error) {
      // A used or superseded event cannot prompt again; the next visit gets a
      // fresh one, so just hide the button rather than leaving a dead control.
      console.warn("[pwa] install prompt failed:", error);
    } finally {
      setPromptEvent(null);
    }
  }, [iosHint, promptEvent]);

  if (installed || environment === "standalone" || (!promptEvent && !iosHint)) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={install}
      title="Install Colly on this device"
      aria-label="Install Colly app"
      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted transition-all duration-250 hover:bg-surface-muted hover:text-main active:scale-[0.94]"
    >
      <Download className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}
