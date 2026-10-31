import { connection } from "next/server";
import { industryFromSlug } from "@/lib/business";
import SignupClient from "./signup-content";

// This route reads request-time data, so it blocks instead of prerendering a
// static shell. Opt out of the static-shell/instant-navigation requirement.
export const instant = false;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string | string[] }>;
}) {
  await connection();

  // `/hotels` sends hotel owners here with `?industry=hotel`. The slug is
  // normalized and validated here — an unknown value is dropped, so the new
  // Business row keeps the schema default ("RETAIL") instead of storing a
  // vertical nobody reviewed. It then rides along as a hidden form field, and
  // the `signup` server action re-validates it before the write (a hidden field
  // is a client-controlled value, so the page's check is a convenience, not the
  // boundary).
  const param = (await searchParams).industry;
  const industry = industryFromSlug(Array.isArray(param) ? param[0] : param);

  return <SignupClient industry={industry} />;
}
