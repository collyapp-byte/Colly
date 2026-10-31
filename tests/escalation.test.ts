import test from "node:test";
import assert from "node:assert/strict";

import { promisesOwnerHandoff } from "../lib/escalation";

/**
 * The fallback that keeps a promised handoff from going nowhere: when the model
 * writes "my boss will reply you" without calling `escalate_to_owner`,
 * `handleIncomingMessage()` escalates on the strength of the reply text. These
 * assertions pin both halves of that trade-off - what must escalate, and the
 * sentences that must not (a false positive silences the AI mid-sale).
 */

test("a reply that promises the owner a handoff is detected", () => {
  const handoffs = [
    // The kill-switch line the system prompt mandates.
    "I'm sending this to my boss/oga right now, they will reply you shortly.",
    "I have forwarded your message to my oga.",
    "Let me check with my boss and get back to you.",
    // The zero-results line from the product-search rules.
    "I don't have that right now, let me check with my boss/oga.",
    "My boss will reply you shortly.",
    "Please hold on, my oga will attend to you shortly.",
    "I'll escalate this to the manager.",
    "I need to confirm this with my supervisor.",
  ];

  for (const reply of handoffs) {
    assert.equal(promisesOwnerHandoff(reply), true, `should escalate: ${reply}`);
  }
});

test("payment and receipt sentences do not count as a handoff", () => {
  // The AI is told to output these verbatim. Escalating them would flip the
  // conversation to ESCALATED and cut the assistant off in the middle of a sale.
  const notHandoffs = [
    "Once you've paid, send the receipt here so my boss/oga can confirm and dispatch.",
    "Thank you! I have received your receipt and generated an invoice. My boss/oga will verify it and confirm your delivery shortly.",
    "Your appointment is booked for 5 November at 14:00. My boss/oga will confirm it shortly.",
    "Send your address to our shop and I will arrange delivery.",
  ];

  for (const reply of notHandoffs) {
    assert.equal(promisesOwnerHandoff(reply), false, `should not escalate: ${reply}`);
  }
});

test("an ordinary product answer is not a handoff", () => {
  const answers = [
    "",
    "   ",
    "The Infinix Hot 40 is available for 185000 naira.",
    "Yes, we have it in stock. Would you like to see more options?",
    "Our shop opens at 8am and closes at 6pm, Monday to Saturday.",
  ];

  for (const reply of answers) {
    assert.equal(promisesOwnerHandoff(reply), false, `should not escalate: ${reply}`);
  }
});

test("detection is case-insensitive and survives line breaks", () => {
  assert.equal(promisesOwnerHandoff("MY BOSS WILL REPLY YOU SHORTLY."), true);
  assert.equal(
    promisesOwnerHandoff("I am sending this to my boss\nright now."),
    true,
  );
});
