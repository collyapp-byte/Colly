import test from "node:test";
import assert from "node:assert/strict";

import {
  FREE_PLAN_LIMITS,
  PLANS,
  REPLY_CREDIT_COSTS,
  creditReplyCalculator,
  getAiReplyCreditCost,
  getCreditPrice,
  getMonthlyCredits,
  getPlanLimits,
  getPlanPrice,
  isPlanTierName,
  splitCreditCost,
  totalAvailableCredits,
} from "../lib/plans";

const naira = (amount: number) => amount.toLocaleString("en-US");

test("every paid tier advertises exactly the credits it pays out", () => {
  for (const [tier, plan] of Object.entries(PLANS)) {
    assert.equal(
      plan.credits,
      plan.baseCredits + plan.bonusCredits,
      `${tier} total must be base + bonus`,
    );
    assert.ok(plan.credits > 0, `${tier} must grant credits`);
    assert.equal(
      plan.bonusDescription.includes(
        Math.floor(plan.bonusCredits / REPLY_CREDIT_COSTS.whatsapp).toLocaleString(
          "en-US",
        ),
      ),
      true,
      `${tier} bonus headline must match the WhatsApp reply count`,
    );
  }
});

test("published plan prices and grants are the documented ones", () => {
  assert.deepEqual(
    {
      green: PLANS.green.credits,
      blue: PLANS.blue.credits,
      black: PLANS.black.credits,
    },
    { green: 23_000, blue: 41_000, black: 90_000 },
  );

  assert.deepEqual(
    {
      green: PLANS.green.monthly,
      blue: PLANS.blue.monthly,
      black: PLANS.black.monthly,
    },
    { green: 15_000, blue: 25_000, black: 50_000 },
  );

  for (const plan of Object.values(PLANS)) {
    assert.equal(plan.yearly, plan.monthly * 10, "yearly is 10 months' price");
    assert.equal(plan.baseCredits, plan.monthly, "base credits match the price");
  }
});

test("the Free tier is 80 credits every 30 days and never expires", () => {
  assert.equal(FREE_PLAN_LIMITS.credits, 80);
  assert.equal(FREE_PLAN_LIMITS.monthly, 0);
  assert.equal(getMonthlyCredits("free"), 80);
  assert.match(FREE_PLAN_LIMITS.description, /80/);
});

test("AI replies cost 5 credits, WhatsApp 80, manual replies nothing", () => {
  assert.equal(REPLY_CREDIT_COSTS.standard, 5);
  assert.equal(REPLY_CREDIT_COSTS.whatsapp, 80);
  assert.equal(REPLY_CREDIT_COSTS.manual, 0);

  assert.equal(getAiReplyCreditCost("TELEGRAM"), 5);
  assert.equal(getAiReplyCreditCost("DISCORD"), 5);
  assert.equal(getAiReplyCreditCost("WEB_CHAT"), 5);
  assert.equal(getAiReplyCreditCost("WHATSAPP"), 80);
  // Case-insensitive and null-safe (legacy rows have no channel).
  assert.equal(getAiReplyCreditCost("whatsapp"), 80);
  assert.equal(getAiReplyCreditCost(null), 5);
  assert.equal(getAiReplyCreditCost(undefined), 5);

  assert.equal(getCreditPrice({ channel: "WHATSAPP" }, "ai"), 80);
  assert.equal(getCreditPrice({ channel: "WHATSAPP" }, "manual"), 0);
});

test("80 free credits is one WhatsApp reply or sixteen standard replies", () => {
  assert.equal(FREE_PLAN_LIMITS.credits / REPLY_CREDIT_COSTS.whatsapp, 1);
  assert.equal(FREE_PLAN_LIMITS.credits / REPLY_CREDIT_COSTS.standard, 16);
});

test("plan credits are spent before top-ups, never the other way round", () => {
  assert.deepEqual(splitCreditCost({ planCredits: 100, topUpCredits: 50 }, 5), {
    fromPlanCredits: 5,
    fromTopUpCredits: 0,
  });

  assert.deepEqual(splitCreditCost({ planCredits: 2, topUpCredits: 50 }, 5), {
    fromPlanCredits: 2,
    fromTopUpCredits: 3,
  });

  assert.deepEqual(splitCreditCost({ planCredits: 0, topUpCredits: 50 }, 80), {
    fromPlanCredits: 0,
    fromTopUpCredits: 80,
  });

  assert.equal(totalAvailableCredits({ planCredits: 23_000, topUpCredits: 3_000 }), 26_000);
});

test("prices, limits and fallbacks resolve without throwing", () => {
  assert.equal(getPlanPrice("green", "monthly"), 15_000);
  assert.equal(getPlanPrice("green", "yearly"), 150_000);
  assert.equal(getPlanPrice("unknown", "monthly"), 0);

  assert.equal(getPlanLimits("blue", "monthly").credits, 41_000);
  assert.equal(getPlanLimits("nonsense", "monthly").credits, 80);
  assert.equal(getPlanLimits("free", "yearly").credits, 80);

  assert.equal(getMonthlyCredits("black"), 90_000);
  assert.equal(getMonthlyCredits("unknown"), 0);

  assert.equal(isPlanTierName("green"), true);
  assert.equal(isPlanTierName("free"), false);
});

test("the reply calculator converts credits into replies", () => {
  assert.equal(
    creditReplyCalculator(23_000),
    `${naira(23_000)} Credits = ${naira(4_600)} Telegram replies OR ${naira(287)} WhatsApp replies`,
  );
});
