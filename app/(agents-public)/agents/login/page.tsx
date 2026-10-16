import { redirect } from "next/navigation";

/** Kept for old links and bookmarks: the unified flow owns agent sign-in. */
export default function AgentLoginRedirect() {
  redirect("/login?role=agent");
}
