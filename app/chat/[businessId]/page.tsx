import { Suspense } from "react";
import PublicChat from "./public-chat";

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
