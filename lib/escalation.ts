/**
 * Deterministic escalation signals.
 *
 * The AI is told (`SYSTEM_PROMPT_RULES` → "KILL SWITCH") to call
 * `escalate_to_owner` and only then answer with one fixed handoff line. Models
 * do not always obey: a reply can promise a handoff without the tool call, and
 * the customer then waits for a human nobody told — no onsite escalation, no
 * Telegram alert. `handleIncomingMessage()` therefore treats a handoff promise
 * in the reply itself as an escalation, using the patterns below.
 *
 * The patterns are deliberately narrow. The receipt sentence the prompt mandates
 * ("My boss/oga will verify it and confirm your delivery shortly") is NOT a
 * handoff — escalating it would cut the AI off mid-sale on every payment proof.
 * A pattern may only match when the reply says the *message* is going to the
 * owner, or that the owner will come back to the customer.
 */

/** How the assistant refers to the business owner (it may never say "owner"). */
const OWNER =
  "(?:boss|oga|owner|manager|supervisor|human|someone from (?:my|our) team)";

/**
 * The verbs that turn a sentence into a handoff: passing the message on, asking
 * the owner, or promising the owner will answer.
 */
const HANDOFF_PATTERNS: readonly RegExp[] = [
  // "I'm sending this to my boss/oga right now." — the mandated kill-switch line.
  //
  // The object is part of the pattern on purpose. Without it, the payment
  // instruction the prompt tells the AI to output verbatim ("Once you've paid,
  // send the receipt here so my boss/oga can confirm and dispatch") matched: the
  // customer is the one sending, the AI has not handed anything over, and
  // escalating there would silence the assistant mid-sale.
  new RegExp(
    "\\b(?:send|sends|sent|sending|forward|forwards|forwarded|forwarding|" +
      "pass|passes|passed|passing|hand|hands|handed|handing)\\b\\s+" +
      "(?:this|that|it|your (?:message|chat|request|question|complaint|order)|" +
      "the (?:message|request|question|complaint))\\s+(?:on\\s+)?" +
      `(?:to|over to)\\s+(?:my |the |our )?${OWNER}\\b`,
    "i",
  ),
  // "Let me check with my boss", "I'll confirm with my oga".
  new RegExp(
    "\\b(?:let me|let's|i will|i'll|i am going to|i'm going to|i need to|" +
      "i have to|allow me to)\\b[^.!?\\n]{0,40}" +
      "\\b(?:check|confirm|ask|verify|find out|consult|escalate|connect you|" +
      `transfer you)\\b[^.!?\\n]{0,30}\\b${OWNER}\\b`,
    "i",
  ),
  // "My boss/oga will reply you shortly", "my boss will get back to you".
  new RegExp(
    `\\b(?:my |the )?${OWNER}\\b[^.!?\\n]{0,40}` +
      "\\b(?:will|would|is going to|is gonna)\\b[^.!?\\n]{0,40}" +
      "\\b(?:reply|replies|revert|get back|answer|attend)\\b",
    "i",
  ),
  // "I'll escalate this to my boss" — the tool's own verb, however it is spelled.
  /\bescalat(?:e|es|ed|ing)\b/i,
];

/**
 * True when the AI's reply promises a human handoff.
 *
 * Called by `handleIncomingMessage()` after a reply is generated: when the
 * `escalate_to_owner` tool did not run this turn but the reply says the owner is
 * being brought in, the escalation is written anyway so the dashboard flags the
 * conversation (the unread bell) and the owner's Telegram is alerted.
 */
export function promisesOwnerHandoff(reply: string): boolean {
  const text = reply.trim();
  if (!text) return false;
  return HANDOFF_PATTERNS.some((pattern) => pattern.test(text));
}
