import { test } from "node:test";
import assert from "node:assert";
import { teamInviteLink } from "../lib/team-invite";

test("an invite link is an absolute /join/<id> URL", () => {
  const link = teamInviteLink("123");
  assert.ok(link.endsWith("/join/123"), "Link must end with /join/<id>");
  assert.ok(link.startsWith("http"), "Link must be absolute");
});

test("the Resend email payload is built correctly", async () => {
  const originalFetch = global.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let capturedPayload: any = null;

  global.fetch = async (_url: string | URL | Request, options?: RequestInit) => {
    capturedPayload = JSON.parse(options?.body as string);
    return { ok: true, json: async () => ({}) } as Response;
  };

  process.env.RESEND_API_KEY = "test-key";

  const { sendTeamInviteEmail } = await import("../lib/team-invite");

  await sendTeamInviteEmail({
    businessName: "Test Business",
    inviterName: "Ada",
    inviteeName: "Obi",
    email: "obi@test.com",
    link: "http://localhost/join/123",
  });

  assert.ok(capturedPayload, "Fetch should have been called");
  assert.strictEqual(capturedPayload.subject, "Join Test Business on Colly");
  assert.ok(Array.isArray(capturedPayload.to), "Resend 'to' should be an array");
  assert.ok(
    JSON.stringify(capturedPayload.to).includes("obi@test.com"),
    "Email recipient should include obi@test.com",
  );
  assert.ok(capturedPayload.html.includes("http://localhost/join/123"), "Email must contain the link");

  global.fetch = originalFetch;
});
