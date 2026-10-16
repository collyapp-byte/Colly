import { redirect } from "next/navigation";

/** Kept for old links and bookmarks: the unified flow owns agent signup. */
export default function AgentSignupRedirect() {
  redirect("/signup?role=agent");
}
