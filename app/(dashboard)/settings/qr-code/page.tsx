
import Image from "next/image";
import { QR_CARD_TAGLINE, QR_CARD_SUBLINE } from "@/lib/qr-card";
import { useState } from "react";

export default function QrCodePage() {
  const [businessName, setBusinessName] = useState("Colly");
  const [qrRef, setQrRef] = useState<HTMLCanvasElement | null>(null);

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">QR Code</h1>

      <div data-print-card className="surface-card p-6 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        <div className="flex items-center justify-center mb-4">
          <svg width="100" height="100" className="text-black dark:text-white">
            <path d="M51.5 1.99h-1.5c-3.2 0-4.8 1.4-4.8 4.8v1.5h9.6v-1.5c0-3.2-1.6-4.8-4.8-4.8zM51.5 0c2.8 0 4.5 1.3 4.5 4.5v1.5h-9.6v-1.5c0-2.8 1.7-4.5 4.5-4.5z" />
          </svg>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold mb-2">Colly AI Assistant</h2>
          <p className="text-muted mb-6">Scan to chat with our AI Assistant</p>
        </div>

        <div className="relative overflow-hidden rounded-lg mb-6" id="qr-container">
          <canvas ref={setQrRef} className="max-w-md mx-auto" width="200" height="200" />
        </div>

        <div>
          <p className="text-sm text-muted">{QR_CARD_TAGLINE}</p>
          <p className="text-xxs text-muted/60">{QR_CARD_SUBLINE}</p>
        </div>
      </div>

      <div data-print-hide className="mt-6 text-right">
        <button onClick={() => { if (qrRef) { const link = document.createElement("a"); link.download = "colly-qr-card.png"; link.href = qrRef.toDataURL(); link.click(); } }} className="text-blue-600 underline">
          Download PNG
        </button>
        <button onClick={() => window.print()} className="text-blue-600 underline ml-4">
          Print
        </button>
      </div>
    </div>
  );
}
