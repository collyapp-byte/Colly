import { redirect } from "next/navigation";

/**
 * `/join` without a member id (a truncated invite link). There is nothing to
 * accept, so send the visitor to sign in rather than a bare 404.
 */
export default function JoinIndexPage() {
  redirect("/login?role=business");
}
