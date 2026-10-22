import { connection } from "next/server";
import PublicChat from "./public-chat";

export default async function PublicChatPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  await connection();

  const { businessId } = await params;

  return <PublicChat businessId={businessId} />;
}
