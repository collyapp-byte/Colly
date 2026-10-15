import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlanLimits } from "@/lib/plans";
import { getCurrentAgent } from "@/lib/agent-auth";

export type AiEnabledResult =
  | { ok: true }
  | { ok: false; reason: "plan_expired" | "cap_hit" | "no_credits" };

/**
 * Requires only that the user is authenticated and has a business.
 * No plan check — site access, manual chat, dashboard features work regardless.
 */
export async function requireSiteAccess(businessId: string): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });

  if (!business) {
    const agent = await getCurrentAgent();
    if (agent) {
      redirect("/agents/dashboard");
    }

    throw new Error("Business not found");
  }
}

/**
 * Checks if AI auto-reply should be enabled for this business.
 * Returns ok=true if:
 * - Plan is active paid AND messagesUsedThisMonth < includedMessages, OR
 * - creditsBalance > 0
 * Otherwise returns ok=false with reason.
 */
export async function requireAiEnabled(businessId: string): Promise<AiEnabledResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      plan: true,
      planStatus: true,
      planInterval: true,
      planExpiresAt: true,
      onboardingEndsAt: true,
      creditsBalance: true,
      messagesUsedThisMonth: true,
      messagesResetAt: true,
      aiEnabled: true,
    },
  });

  if (!business) {
    return { ok: false, reason: "plan_expired" };
  }

  // If AI is manually disabled by owner, respect that
  if (!business.aiEnabled) {
    return { ok: false, reason: "plan_expired" };
  }

  // Check monthly reset
  const now = new Date();
  if (business.messagesResetAt && business.messagesResetAt < now) {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        messagesUsedThisMonth: 0,
        messagesResetAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    // After reset, re-check with fresh values
    business.messagesUsedThisMonth = 0;
    business.messagesResetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // Active paid plan
  const isActivePaidPlan =
    business.planStatus === "active" &&
    ["starter", "business", "pro"].includes(business.plan);

  // Active trial
  const isTrialActive =
    business.planStatus === "trialing" &&
    business.onboardingEndsAt &&
    business.onboardingEndsAt > now;

  if (isActivePaidPlan || isTrialActive) {
    const limits = getPlanLimits(business.plan, business.planInterval);
    const included =
      "includedMessages" in limits
        ? limits.includedMessages
        : limits.aiRepliesLimit ?? 0;

    if (business.messagesUsedThisMonth < included) {
      return { ok: true };
    }

    // Cap hit — check credits
    if (business.creditsBalance > 0) {
      return { ok: true };
    }

    return { ok: false, reason: "cap_hit" };
  }

  // Free/expired plan — check credits
  if (business.creditsBalance > 0) {
    return { ok: true };
  }

  return { ok: false, reason: isTrialActive ? "cap_hit" : "plan_expired" };
}