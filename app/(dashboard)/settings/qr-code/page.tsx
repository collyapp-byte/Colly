"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const WEB_CHAT_ORIGIN = "https://colly.com.ng";

/**
 * The canvas is rendered at this many pixels and shrunk with CSS. Drawing at
 * screen size would download a blurry 224px PNG; at 1024px the file stays sharp
 * when the shop prints it on a counter card.
 */
const QR_PIXEL_SIZE = 1024;

/** The two fields this page needs; /api/business returns the whole profile. */
type QrBusiness = {
  id: string;
  name: string;
};

export default function QrCodePage() {
  const [business, setBusiness] = useState<QrBusiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The id comes from the session's business rather than the URL, so the page
  // cannot be used to print a code that points at someone else's shop.
  useEffect(() => {
    let active = true;

    fetch("/api/business")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "You need to sign in to create your QR code."
              : `Request failed with status ${res.status}`,
          );
        }
        return (await res.json()) as { business?: QrBusiness };
      })
      .then((data) => {
        if (!active) return;
        if (!data.business) throw new Error("Business not found");
        setBusiness(data.business);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Could not load your business.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const chatLink = business ? `${WEB_CHAT_ORIGIN}/chat/${business.id}` : "";

  /** Saves the canvas as colly-qr-<businessId>.png. */
  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !business) return;

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `colly-qr-${business.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("QR code downloaded");
    } catch {
      // A tainted canvas is the only realistic failure; printing still works.
      toast.error("Could not save the image. Use Print instead.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div data-print-hide>
        <Link
          href="/settings/web-chat"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-colly"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Web Chat
        </Link>

        <h1 className="font-display text-2xl text-gray-900">In-Store QR Code</h1>
        <p className="mt-1 text-sm text-gray-500">
          Print this card and keep it on your counter, so customers can scan it
          and chat with your AI assistant right away.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {!business && !error ? <QrCardSkeleton /> : null}

      {business ? (
        <>
          {/* The printable card. `data-print-card` keeps its colours and drops
              the screen shadow once the page reaches a printer. */}
          <div className="mt-6 flex justify-center">
            <div
              data-print-card
              className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white px-6 py-8 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]"
            >
              <div className="flex items-center justify-center gap-2">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={30}
                  height={30}
                  aria-hidden
                />
                <span className="font-display text-xl tracking-wide text-gray-900">
                  Colly
                </span>
              </div>

              <div className="mt-6 flex justify-center">
                <div className="rounded-xl border border-gray-100 bg-white p-3">
                  <QRCodeCanvas
                    ref={canvasRef}
                    value={chatLink}
                    size={QR_PIXEL_SIZE}
                    level="M"
                    marginSize={2}
                    title={`Chat with ${business.name}`}
                    aria-label={`QR code that opens the Colly chat for ${business.name}`}
                    className="block h-56 w-56"
                  />
                </div>
              </div>

              <p className="mt-6 text-center text-base font-bold text-gray-900">
                Scan to chat with our AI Assistant
              </p>
              <p className="mt-1 text-center text-sm text-gray-500">
                Instant replies. Available 24/7.
              </p>

              <p className="mt-4 truncate text-center text-[11px] font-medium text-gray-400">
                {chatLink}
              </p>
            </div>
          </div>

          <div
            data-print-hide
            className="mt-6 flex flex-wrap justify-center gap-3"
          >
            <Button type="button" variant="primary" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Download QR Code (PNG)
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.print()}
            >
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              Print
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Placeholder card shown while /api/business loads. */
function QrCardSkeleton() {
  return (
    <div className="mt-6 flex justify-center">
      <div className="w-full max-w-sm animate-pulse rounded-2xl border border-gray-200 bg-white px-6 py-8">
        <div className="mx-auto h-7 w-24 rounded bg-gray-100" />
        <div className="mx-auto mt-6 h-56 w-56 rounded-xl bg-gray-100" />
        <div className="mx-auto mt-6 h-4 w-56 rounded bg-gray-100" />
        <div className="mx-auto mt-2 h-3 w-40 rounded bg-gray-100" />
      </div>
    </div>
  );
}
