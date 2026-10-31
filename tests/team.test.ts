import test from "node:test";
import assert from "node:assert/strict";

import {
  OWNER_ONLY_PATHS,
  STAFF_DENIED_MESSAGE,
  STAFF_DENIED_PARAM,
  STAFF_DENIED_REDIRECT,
  STAFF_DENIED_VALUE,
  TEAM_MEMBER_NAME_MAX,
  TEAM_ROLES,
  isOwnerOnlyPath,
  isTeamRole,
} from "../lib/team";

test("a team account is either the OWNER or invited STAFF", () => {
  assert.deepEqual([...TEAM_ROLES], ["OWNER", "STAFF"]);

  assert.equal(isTeamRole("OWNER"), true);
  assert.equal(isTeamRole("STAFF"), true);

  // Anything else must not be read as an elevated role.
  assert.equal(isTeamRole("owner"), false);
  assert.equal(isTeamRole("ADMIN"), false);
  assert.equal(isTeamRole(""), false);
  assert.equal(isTeamRole(null), false);
  assert.equal(isTeamRole(undefined), false);
  assert.equal(isTeamRole(1), false);
});

test("the owner-only areas are the money and channel settings", () => {
  assert.deepEqual([...OWNER_ONLY_PATHS], [
    "/settings/billing",
    "/settings/ai-line",
    "/settings/team",
  ]);

  for (const path of OWNER_ONLY_PATHS) {
    assert.equal(isOwnerOnlyPath(path), true, `${path} is owner-only`);
  }
});

test("owner-only matching covers sub-pages but not look-alike prefixes", () => {
  assert.equal(isOwnerOnlyPath("/settings/billing/plans"), true);
  assert.equal(isOwnerOnlyPath("/settings/billing/credits"), true);
  assert.equal(isOwnerOnlyPath("/settings/team/invite"), true);

  // Prefix that merely starts with the same characters is a different area.
  assert.equal(isOwnerOnlyPath("/settings/billingx"), false);
  assert.equal(isOwnerOnlyPath("/settings/ai-lines"), false);
  assert.equal(isOwnerOnlyPath("/settings/teamwork"), false);

  // Areas an invited staff member keeps: the shared workspace and the plain
  // settings page (profile, hours, payment instructions).
  assert.equal(isOwnerOnlyPath("/dashboard"), false);
  assert.equal(isOwnerOnlyPath("/settings"), false);
  assert.equal(isOwnerOnlyPath("/settings/qr-code"), false);
  assert.equal(isOwnerOnlyPath("/conversations"), false);
  assert.equal(isOwnerOnlyPath("/products"), false);

  // The Paystack return page is top-level, so a staff member who somehow reaches
  // it is not bounced back and forth with the proxy.
  assert.equal(isOwnerOnlyPath("/billing/callback"), false);
});

test("a bounced staff member lands on the dashboard with a toast flag", () => {
  assert.equal(STAFF_DENIED_PARAM, "denied");
  assert.equal(STAFF_DENIED_VALUE, "staff_restricted");
  assert.equal(
    STAFF_DENIED_REDIRECT,
    `/dashboard?${STAFF_DENIED_PARAM}=${STAFF_DENIED_VALUE}`,
  );

  const url = new URL(STAFF_DENIED_REDIRECT, "https://colly.com.ng");
  assert.equal(url.pathname, "/dashboard");
  assert.equal(url.searchParams.get(STAFF_DENIED_PARAM), STAFF_DENIED_VALUE);
  // The target must stay reachable for staff, or the redirect would loop.
  assert.equal(isOwnerOnlyPath(url.pathname), false);

  assert.equal(STAFF_DENIED_MESSAGE, "Only the business owner can open that page.");
});

test("an invite name is capped at 80 characters", () => {
  assert.equal(TEAM_MEMBER_NAME_MAX, 80);
});
