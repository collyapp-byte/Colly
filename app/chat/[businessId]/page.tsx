import type { Metadata } from "next";
import { Suspense } from "react";
import PublicChat from "./public-chat";

/**
 * One business's customer chat widget. It is per-tenant, session-less and
 * mostly empty until the widget connects, so crawlers are asked to stay out.
 */
export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

export default function PublicChatPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading chat...
        </div>
      }
    >
      <ChatContent params={params} />
    </Suspense>
  );
}

async function ChatContent({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return <PublicChat businessId={businessId} />;
}
