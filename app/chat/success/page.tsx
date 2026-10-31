import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";

/**
 * The confirmation page Paystack redirects to after an in-chat payment link is
 * paid (POST /api/payments/create-link sets it as `callback_url`).
 *
 * The visitor is the business's customer, not a Colly user, so there is no
 * dashboard navigation here and no session is required: the page lives under
 * `/chat`, which `lib/public-routes.ts` already treats as session-free.
 */
export const metadata: Metadata = {
  title: "Payment received",
  robots: { index: false, follow: false },
};

export default function ChatPaymentSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <div className="w-full rounded-lg border border-gray-200 bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
        <h1 className="mt-4 font-display text-xl text-gray-900">
          Payment received
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Thank you. Your payment went through.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          You can close this page and go back to the chat &mdash; the business
          will confirm your order there.
        </p>
      </div>
    </main>
  );
}
