import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requireAiEnabled } from "@/lib/auth-guards";
import { getPlanLimits } from "@/lib/plans";

// DEV-ONLY. Never expose this route in production (guarded below).
// This route mutates the signed-in Business row's plan state.
// Only use it for cap-enforcement testing. Do not point it at a
// real customer's business.

// Dev-only harness for verifying the AI cap gate. It only reads and mutates
// the caller's own Business row (never accepts a businessId), never calls the
// AI provider, and never sends a WhatsApp message.

const KNOWN_PLANS = ["free", "trial", "starter", "business", "pro"];
const KNOWN_STATUSES = ["trialing", "active", "past_due", "cancelled", "expired"];

function notFound() {
  return NextResponse.json(
    { ok: false, error: "Not found" },
    { status: 404 },
  );
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "Unauthorized" },
    { status: 401 },
  );
}

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

async function readState(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      plan: true,
      planInterval: true,
      planStatus: true,
      messagesUsedThisMonth: true,
      messagesResetAt: true,
      creditsBalance: true,
      aiEnabled: true,
    },
  });

  if (!business) return null;

  const aiCheck = await requireAiEnabled(businessId);

  const limits = getPlanLimits(business.plan, business.planInterval);
  const includedMessages =
    "includedMessages" in limits
      ? limits.includedMessages
      : (limits as { aiRepliesLimit?: number }).aiRepliesLimit ?? 0;

  return {
    plan: business.plan,
    planStatus: business.planStatus,
    messagesUsedThisMonth: business.messagesUsedThisMonth,
    includedMessages,
    creditsBalance: business.creditsBalance,
    messagesResetAt: business.messagesResetAt,
    aiEnabled: aiCheck.ok,
    reason: aiCheck.ok ? null : aiCheck.reason,
  };
}

// GET — reports current plan/cap/credits state and the requireAiEnabled()
// verdict for the caller's business.
export async function GET() {
  if (process.env.NODE_ENV === "production") return notFound();

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const state = await readState(user.businessId);
  if (!state) {
    return NextResponse.json(
      { ok: false, error: "Business not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...state });
}

// POST — mutates the caller's own business row for the current test, then
// returns the new state (including the requireAiEnabled() verdict).
//
// Accepted body fields (all optional):
//   messagesUsedThisMonth : number
//   creditsBalance        : number
//   plan                  : "free" | "trial" | "starter" | "business" | "pro"
//   planStatus            : "trialing" | "active" | "past_due" | "cancelled" | "expired"
//   messagesResetAt       : ISO string or null
//     `messagesResetAt` is an extension beyond the four core fields: rows
//     created before this test (including seeded ones) default to a reset
//     date in the past, so requireAiEnabled() would zero the counter on the
//     next read and the cap could never be demonstrated. Set it to a future
//     date to hold the counter in place.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return notFound();

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("Body must be valid JSON");
  }

  const data: Record<string, unknown> = {};

  if ("messagesUsedThisMonth" in body) {
    const value = body.messagesUsedThisMonth;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return badRequest("messagesUsedThisMonth must be a non-negative integer");
    }
    data.messagesUsedThisMonth = value;
  }

  if ("creditsBalance" in body) {
    const value = body.creditsBalance;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return badRequest("creditsBalance must be a non-negative integer");
    }
    data.creditsBalance = value;
  }

  if ("plan" in body) {
    const value = body.plan;
    if (typeof value !== "string" || !KNOWN_PLANS.includes(value)) {
      return badRequest(`plan must be one of: ${KNOWN_PLANS.join(", ")}`);
    }
    data.plan = value;
  }

  if ("planStatus" in body) {
    const value = body.planStatus;
    if (typeof value !== "string" || !KNOWN_STATUSES.includes(value)) {
      return badRequest(`planStatus must be one of: ${KNOWN_STATUSES.join(", ")}`);
    }
    data.planStatus = value;
  }

  if ("messagesResetAt" in body) {
    const value = body.messagesResetAt;
    if (value === null) {
      data.messagesResetAt = null;
    } else if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
      return badRequest("messagesResetAt must be an ISO date string or null");
    } else {
      data.messagesResetAt = new Date(value);
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.business.update({
      where: { id: user.businessId },
      data,
    });
  }

  const state = await readState(user.businessId);
  if (!state) {
    return NextResponse.json(
      { ok: false, error: "Business not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, updated: Object.keys(data), ...state });
}

// DELETE — resets the caller's business to the same billing state a fresh
// signup would have: the schema defaults for plan/planStatus, zeroed counters
// and credits, AI re-enabled, and a fresh reset window. See the defaults on
// `model Business` in prisma/schema.prisma.
export async function DELETE() {
  if (process.env.NODE_ENV === "production") return notFound();

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const now = new Date();
  await prisma.business.update({
    where: { id: user.businessId },
    data: {
      plan: "free", // @default("free")
      planStatus: "trialing", // @default("trialing")
      messagesUsedThisMonth: 0, // @default(0)
      creditsBalance: 0, // @default(0)
      aiEnabled: true, // @default(true)
      messagesResetAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const state = await readState(user.businessId);
  if (!state) {
    return NextResponse.json(
      { ok: false, error: "Business not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, ...state });
}
