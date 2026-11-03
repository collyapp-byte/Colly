import { test } from "node:test";
import assert from "node:assert";
import { teamInviteLink } from "../lib/team-invite";

test("an invite link is an absolute /join/<id> URL", () => {
  const link = teamInviteLink("123");
  assert.ok(link.endsWith("/join/123"), "Link must end with /join/<id>");
  assert.ok(link.startsWith("http"), "Link must be absolute");
});

test("the Brevo email payload is built correctly", async () => {
  // Mock the global fetch to intercept the Brevo API call
  const originalFetch = global.fetch;
  let capturedPayload: any = null;

  global.fetch = async (url: string | URL | Request, options?: RequestInit) => {
    capturedPayload = JSON.parse(options?.body as string);
    return { ok: true, json: async () => ({}) } as Response;
  };

  // Mock the API key
  process.env.BREVO_API_KEY = "test-key";

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
  assert.strictEqual(capturedPayload.to[0].email, "obi@test.com");
  assert.ok(capturedPayload.htmlContent.includes("http://localhost/join/123"), "Email must contain the link");

  // Restore fetch
  global.fetch = originalFetch;
});