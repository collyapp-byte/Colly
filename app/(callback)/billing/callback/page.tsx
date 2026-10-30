"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";

type VerifyState = "loading" | "success" | "error";

/**
 * Handles the redirect back from Paystack after a checkout. Reads the
 * `reference` query parameter and asks /api/billing/verify to reconcile the
 * payment with the pending Transaction row.
 *
 * Wrapped in Suspense because `useSearchParams` forces a client-only render and
 * Next requires a boundary around it.
 */
export default function BillingCallbackPage() {
  return (
    <Suspense fallback={<VerifyLoader />}>
      <CallbackBody />
    </Suspense>
  );
}

function CallbackBody() {
  const params = useSearchParams();
  const reference = params.get("reference");

  if (!reference) {
    return (
      <StatusCard
        tone="error"
        title="Payment could not be confirmed"
        message="No payment reference was found in the link."
      />
    );
  }

  return <VerifyStatus reference={reference} />;
}

function VerifyStatus({ reference }: { reference: string }) {
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch("/api/billing/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });

        const body = await res.json().catch(() => null);

        if (cancelled) return;

        if (!res.ok) {
          throw new Error(body?.error ?? "Could not verify your payment.");
        }

        if (body?.ok) {
          setState("success");
          // Client-side navigation (not `window.location.href`): the billing
          // page is already in the router cache and `refresh()` re-reads the
          // plan/credit pills from the server after the new grant.
          setTimeout(() => {
            router.replace("/settings/billing");
            router.refresh();
          }, 1500);
        } else {
          setState("error");
          setMessage(
            "Your payment could not be confirmed yet. If money was deducted, it will appear on your billing history shortly.",
          );
        }
      } catch (err) {
        if (cancelled) return;
        setState("error");
        setMessage(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [reference, router]);

  if (state === "loading") return <VerifyLoader />;

  return (
    <StatusCard
      tone={state === "success" ? "success" : "error"}
      title={
        state === "success"
          ? "Payment successful!"
          : "Payment could not be confirmed"
      }
      message={
        state === "success"
          ? "Your plan or credits have been applied to your account."
          : (message ?? "Something went wrong.")
      }
    />
  );
}

const TONE_ICON = {
  success: CheckCircle2,
  error: CircleAlert,
} as const;

const TONE_STYLES = {
  success: "text-success",
  error: "text-danger",
} as const;

function StatusCard({
  tone,
  title,
  message,
}: {
  tone: "success" | "error";
  title: string;
  message: string;
}) {
  const Icon = TONE_ICON[tone];

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-gray-200 bg-surface p-6 text-center">
        <Icon className={`mx-auto h-12 w-12 ${TONE_STYLES[tone]}`} aria-hidden />
        <h1 className="mt-4 font-display text-xl text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
        <Link
          href="/settings/billing"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-colly px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
        >
          Back to billing
        </Link>
      </div>
    </div>
  );
}

function VerifyLoader() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-lg border border-gray-200 bg-surface p-6 text-center">
        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-colly" aria-hidden />
        <h1 className="mt-4 font-display text-xl text-gray-900">
          Confirming your payment…
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          This only takes a moment.
        </p>
      </div>
    </div>
  );
}
