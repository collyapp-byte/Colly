import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { DEFAULT_EMAIL_FROM, escapeHtml, fromAddress } from "../lib/email";
import { isPublicRoute } from "../lib/public-routes";
import { SITE_URL } from "../lib/site";
import {
  TEAM_INVITE_PASSWORD_HINT,
  TEAM_INVITE_PATH,
  buildTeamInviteEmail,
  sendTeamInviteEmail,
  teamInviteLink,
  teamInviteSubject,
} from "../lib/team-invite";

const INVITE = {
  businessName: "ABC Electronics",
  inviterName: "Ada Obi",
  inviteeName: "Chidi Nwosu",
  email: "chidi@example.com",
  link: teamInviteLink("member-1", "https://app.colly.test"),
};

/** The source of a file in this repo, for the wiring assertions below. */
function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("an invite link is an absolute /join/<id> URL", () => {
  assert.equal(TEAM_INVITE_PATH, "/join");

  assert.equal(
    teamInviteLink("member-1", "https://app.colly.test"),
    "https://app.colly.test/join/member-1",
  );

  // A trailing slash on the base never produces a double slash.
  assert.equal(
    teamInviteLink("member-1", "https://app.colly.test///"),
    "https://app.colly.test/join/member-1",
  );

  // An id is not trusted: it is escaped, so it cannot add segments of its own.
  assert.equal(
    teamInviteLink(" a/b?x=1 ", "https://app.colly.test"),
    "https://app.colly.test/join/a%2Fb%3Fx%3D1",
  );

  // No id, no link — the caller must not send a link to the index page.
  assert.throws(() => teamInviteLink("   "));

  // The default base is the deploy origin, never a relative path.
  assert.equal(teamInviteLink("member-1"), `${SITE_URL}/join/member-1`);
});

test("the subject names the workspace, not just the product", () => {
  assert.equal(
    teamInviteSubject("ABC Electronics"),
    "You're invited to join ABC Electronics on Colly",
  );
  assert.equal(
    teamInviteSubject("   "),
    "You're invited to join a workspace on Colly",
  );
});

test("the invite email carries the link, the workspace and the address", () => {
  const email = buildTeamInviteEmail(INVITE);

  assert.equal(email.subject, "You're invited to join ABC Electronics on Colly");

  for (const body of [email.html, email.text]) {
    assert.ok(body.includes(INVITE.link), "the accept link is in every part");
    assert.ok(body.includes("ABC Electronics"), "the workspace is named");
    assert.ok(body.includes(INVITE.email), "the invited address is named");
    assert.ok(body.includes("Ada Obi"), "the inviter is named");
  }

  // The plain-text part is not HTML, and both parts state the password rule
  // that `/join` enforces.
  assert.equal(email.text.includes("<a "), false);
  assert.equal(email.text.includes("<html"), false);
  assert.ok(email.text.includes(TEAM_INVITE_PASSWORD_HINT));
  assert.ok(email.html.includes("Join the team"));

  // It must never read like a self-serve WhatsApp promise (the channel is a
  // waitlist) or like access was already granted.
  assert.equal(email.html.toLowerCase().includes("whatsapp"), false);
  assert.ok(email.text.includes("nothing happens until you accept it"));
});

test("owner-supplied text cannot break the markup", () => {
  const email = buildTeamInviteEmail({
    ...INVITE,
    businessName: 'Ada & <Sons> "Lagos"',
    inviteeName: "<script>x</script>",
  });

  assert.ok(email.html.includes("Ada &amp; &lt;Sons&gt; &quot;Lagos&quot;"));
  assert.equal(email.html.includes("<Sons>"), false);
  assert.equal(email.html.includes("<script>"), false);

  assert.equal(escapeHtml("<b>hi</b>"), "&lt;b&gt;hi&lt;/b&gt;");
});

test("a missing inviter or invitee still reads like an invitation", () => {
  const email = buildTeamInviteEmail({
    businessName: "ABC Electronics",
    email: "chidi@example.com",
    link: "https://app.colly.test/join/member-1",
  });

  assert.ok(email.html.includes("The business owner"));
  assert.ok(email.html.includes("Hello,"));
  assert.equal(email.text.startsWith("Hello,\n"), true);
});

test("the /join landing page renders without a session", () => {
  // Without this the proxy answers the invite link with a 307 to /login, and
  // the invitee has no account to log in with yet.
  assert.equal(isPublicRoute(TEAM_INVITE_PATH), true);
  assert.equal(isPublicRoute("/join/member-1"), true);

  const page = source("app/(auth)/join/[id]/page.tsx");
  assert.ok(page.includes("export default function"), "the page exists");
  assert.ok(
    page.includes("<Suspense"),
    "the DB read streams: awaiting params at the top fails a cacheComponents build",
  );
  assert.ok(page.includes("prisma.teamMember.findUnique"), "it reads the invite");
  assert.ok(page.includes("<JoinTeamForm"), "it renders the accept form");
  assert.ok(page.includes("robots"), "an invite link is not indexed");

  // A bare /join (a truncated link) goes to sign in instead of a 404.
  assert.ok(source("app/(auth)/join/page.tsx").includes("redirect("));
});

test("without a provider key the invite is kept but no mail is sent", async () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalWarn = console.warn;
  delete process.env.RESEND_API_KEY;
  console.warn = () => {};

  try {
    // No network call, no throw: the route still returns 201 with the link.
    assert.deepEqual(await sendTeamInviteEmail(INVITE), {
      sent: false,
      error: "not_configured",
    });
  } finally {
    console.warn = originalWarn;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  }
});

test("the sender falls back to the shared Colly address", () => {
  const originalFrom = process.env.RESEND_FROM_EMAIL;

  try {
    delete process.env.RESEND_FROM_EMAIL;
    assert.equal(fromAddress(), DEFAULT_EMAIL_FROM);

    process.env.RESEND_FROM_EMAIL = "Colly <hello@colly.test>";
    assert.equal(fromAddress(), "Colly <hello@colly.test>");
  } finally {
    if (originalFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = originalFrom;
  }
});

test("POST /api/team saves the invite first, then emails it", () => {
  const route = source("app/api/team/route.ts");

  const created = route.indexOf("prisma.teamMember.create");
  const emailed = route.indexOf("await sendTeamInviteEmail");

  assert.ok(created > -1, "the invite row is created");
  assert.ok(emailed > -1, "the invite email is sent");
  assert.ok(
    created < emailed,
    "the row is the source of truth: it is written before the mail is tried",
  );

  // The response tells the owner whether the mail left and hands back the link
  // so it can be forwarded by hand when the provider is down.
  assert.ok(route.includes("invite: { emailed: delivery.sent, link }"));
  assert.ok(route.includes("requireOwnerApi()"), "still owner-only");
});

test("the settings UI says the invite is emailed", () => {
  const manager = source("components/dashboard/team-manager.tsx");

  assert.equal(
    manager.includes("We do not email anyone yet"),
    false,
    "the old 'we do not email anyone' note must be gone",
  );
  assert.ok(manager.includes("We email them an invite link"));
  assert.ok(manager.includes("Invite emailed to"));
  assert.ok(manager.includes("Copy invite link"), "manual fallback stays");
});

