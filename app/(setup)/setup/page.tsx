export const instant = false;
import { requireAuth } from "@/lib/auth";
import { Wizard } from "./wizard";

export default async function SetupPage() {
  const user = await requireAuth();
  return <Wizard ownerName={user.name || "there"} />;
}