"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  QR_CARD_SUBLINE,
  QR_CARD_TAGLINE,
  drawQrCard,
  qrCardFileName,
} from "@/lib/qr-card";

const WEB_CHAT_ORIGIN = "https://colly.com.ng";
const LOGO_SRC = "/logo.svg";

/**
 * The QR canvas is rendered at this many pixels and shrunk with CSS. Drawing at
 * screen size would save a blurry 224px code; at 1024px it stays sharp on the
 * downloaded card and on paper.
 */
const QR_PIXEL_SIZE = 1024;

/** The two fields this page needs; /api/business returns the whole profile. */
type QrBusiness = {
  id: string;
  name: string;
};

/** Loads the brand mark so it can be drawn onto the downloaded card. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement("img");
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${src}`));
    image.src = src;
  });
}

export default function QrCodePage() {
  const [business, setBusiness] = useState<QrBusiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  useEffect(() => {
    document.body.dataset.printQr = "true";

    const pageStyle = document.createElement("style");
    pageStyle.id = "qr-print-page";
    pageStyle.textContent = "@page { size: auto; margin: 0; }";
    document.head.appendChild(pageStyle);

    return () => {
      delete document.body.dataset.printQr;
      pageStyle.remove();
    };
  }, []);

  async function handleDownload() {
    const qrCanvas = canvasRef.current;
    if (!qrCanvas || !business) return;

    setSaving(true);
    try {
      const logo = await loadImage(LOGO_SRC).catch(() => null);
      const canvas = drawQrCard({
        businessName: business.name,
        qr: qrCanvas,
        logo,
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = qrCardFileName(business.id);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("QR card downloaded");
    } catch {
      toast.error("Could not save the image. Use Print instead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-print-flush className="mx-auto w-full max-w-3xl">
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
          <div data-print-flush className="mt-6 flex justify-center">
            <div
              data-print-card
              className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]"
            >
              <div className="flex items-center justify-center gap-2">
                <Image
                  src="/logo.svg"
                  alt=""
                  width={22}
                  height={22}
                  aria-hidden
                />
                <span className="font-display text-sm tracking-wide text-gray-900">
                  Colly
                </span>
              </div>

              <h2 className="mt-5 text-center text-2xl font-bold leading-tight break-words text-gray-900">
                {business.name}
              </h2>

              {/* The wrapper forces the canvas to be exactly 208x208px (h-52 w-52) */}
              <div className="mx-auto mt-6 h-52 w-52">
                <QRCodeCanvas
                  ref={canvasRef}
                  value={chatLink}
                  size={QR_PIXEL_SIZE}
                  level="M"
                  marginSize={2}
                  title={`Chat with ${business.name}`}
                  aria-label={`QR code that opens the Colly chat for ${business.name}`}
                  style={{ width: "100%", height: "100%", display: "block" }}
                />
              </div>

              <p className="mt-6 text-center text-base font-bold text-gray-900">
                {QR_CARD_TAGLINE}
              </p>
              <p className="mt-1 text-center text-sm text-gray-500">
                {QR_CARD_SUBLINE}
              </p>
            </div>
          </div>

          <div
            data-print-hide
            className="mt-6 flex flex-wrap justify-center gap-3"
          >
            <Button
              type="button"
              variant="primary"
              onClick={handleDownload}
              isLoading={saving}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Download QR Card (PNG)
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
      <div className="w-full max-w-sm animate-pulse rounded-2xl border border-gray-200 bg-white px-8 py-10">
        <div className="mx-auto h-5 w-20 rounded bg-gray-100" />
        <div className="mx-auto mt-5 h-7 w-44 rounded bg-gray-100" />
        <div className="mx-auto mt-6 h-52 w-52 rounded-lg bg-gray-100" />
        <div className="mx-auto mt-6 h-4 w-52 rounded bg-gray-100" />
        <div className="mx-auto mt-2 h-3 w-40 rounded bg-gray-100" />
      </div>
    </div>
  );
}