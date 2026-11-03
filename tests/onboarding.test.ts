import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("onboarding layout does not mount the old wizard", () => {
  const layout = readFileSync(
    join(process.cwd(), "app/(dashboard)/layout.tsx"),
    "utf-8"
  );
  assert.ok(!layout.includes("OnboardingWizard"), "Layout must not render OnboardingWizard");
});

test("test-chat API calls the real AI engine", () => {
  const route = readFileSync(
    join(process.cwd(), "app/api/onboarding/test-chat/route.ts"),
    "utf-8"
  );
  assert.ok(route.includes("handleIncomingMessage"), "Must call the real engine");
  assert.ok(!route.includes("hello") && !route.includes("price"), "Must not contain keyword stubs");
  assert.ok(route.includes("onboarding-test"), "Must tag the onboarding customer");
});

test("setup checklist does not link to Telegram as a required step", () => {
  const checklist = readFileSync(
    join(process.cwd(), "components/dashboard/setup-checklist.tsx"),
    "utf-8"
  );
  assert.ok(!checklist.includes("/settings/ai-line"), "Telegram must not be a required checklist step");
});