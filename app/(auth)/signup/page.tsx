import { connection } from "next/server";
import SignupClient from "./signup-content";

// This route reads request-time data, so it blocks instead of prerendering a
// static shell. Opt out of the static-shell/instant-navigation requirement.
export const instant = false;

export default async function SignupPage() {
  await connection();

  return <SignupClient />;
}
