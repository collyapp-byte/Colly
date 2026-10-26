import type { Metadata } from "next";

/**
 * Post-checkout landing (`/billing/callback`). It only reads search params and
 * shows a receipt, so it is neither useful nor unique enough to index.
 */
export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default function CallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

