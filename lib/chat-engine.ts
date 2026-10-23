import { Prisma, type Conversation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  askAI,
  type ChatMessage,
  type ChatTool,
  type ChatToolCall,
} from "@/lib/ai";
import {
  findSimilarProducts,
  searchFAQs,
  searchProducts,
  type FaqMatch,
  type ProductMatch,
} from "@/lib/tools";
import {
  calculateCounterOffer,
  parseOffer,
  DEFAULT_MAX_ROUNDS,
  type NegotiationState,
} from "@/lib/negotiation";
import { isTone, type Tone } from "@/lib/business";
import {
  detectLanguage,
  getLanguageInstruction,
} from "@/lib/language-detect";
import { requireAiEnabled } from "@/lib/auth-guards";
import { getCreditPrice, getPlanLimits, isActivePaidPlan } from "@/lib/plans";
import { sendEscalationAlert, sendOwnerAlert } from "@/lib/owner-alerts";

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  formal: "Use a professional, formal tone.",
  friendly: "Use a warm, casual tone with light emoji.",
};

const SYSTEM_PROMPT_RULES = [
  "You are Colly, the AI sales assistant for {Business Name}.",
  "Your job is to answer questions, recommend products, and close sales.",
  "",
  "--- LANGUAGE & TONE RULES ---",
  "1. Detect the customer's language. If they use Pidgin English, reply in Pidgin.",
  "2. In English, ALWAYS refer to the business owner as \"my boss\".",
  "3. In Pidgin, ALWAYS refer to the business owner as \"my oga\".",
  "4. NEVER use the words \"owner\", \"manager\", or \"administrator\".",
  "5. Keep responses short, punchy, and conversational.",
  "",
  "--- PRODUCT SEARCH RULES ---",
  "1. Use the `search_products` tool to find items.",
  "2. If the tool returns partial matches (e.g., \"iPhone 12\" for \"iPhone\"), offer them as alternatives.",
  "3. If the customer asks for an image, only send it if the tool returns an `imageUrl`. Use the tag `[IMAGE: url]`.",
  "4. If the tool returns ZERO results, say \"I don't have that right now, let me check with my boss/oga\" and IMMEDIATELY trigger `escalate_to_owner`.",
  "",
  "--- PAYMENT & ESCALATION RULES (THE IF LOOP) ---",
  "You MUST trigger `escalate_to_owner` under ANY of these circumstances:",
  "1. The customer asks how to pay, or where to send money.",
  "2. The customer says they want to buy, or negotiates below the floor price.",
  "3. The customer asks for a waybill or delivery fee to a specific city.",
  "4. The customer asks a question you cannot definitively answer from the catalogue.",
  "",
  "--- PAYMENT INSTRUCTIONS ---",
  "If the customer asks how to pay AND the context contains `paymentInstructions`:",
  "1. Output the exact `paymentInstructions`.",
  "2. Say: \"Once you've paid, send the receipt here so my boss/oga can confirm and dispatch.\"",
  "",
  "If the customer asks how to pay AND `paymentInstructions` is MISSING, trigger `escalate_to_owner`.",
  "",
  "--- KILL SWITCH ---",
  "When you trigger `escalate_to_owner`:",
  "1. Stop generating further responses.",
  "2. Output exactly: \"I'm sending this to my boss/oga right now, they will reply you shortly.\"",
].join("\n");

const TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search the business's product catalogue for products that match a customer's question. Returns matching products (name, price in Naira, stock, description, and imageUrl when the product has a picture).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The customer's question about products (e.g. 'do you have red shoes?', 'how much is the blender?')",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_faqs",
      description: "Search the business's FAQ knowledge base for answers about policies, delivery, payment, returns, warranty, location, or business hours.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The customer's question about policies or operational details",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_similar_products",
      description: "Find products similar to the customer's request when an exact match is not found. Use this when search_products returns 0 results for a specific product query. Returns matching products (name, price in Naira, stock, description, and imageUrl when the product has a picture).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The product the customer asked for (e.g. 'Samsung S24 Ultra')",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_owner",
      description:
        "Hand the conversation to the human owner. Call this when the customer asks something no other tool can answer: waybill or delivery logistics not covered by the FAQs, a custom or bulk quote, or a product detail the description does not include. The owner is alerted on their phone with the customer's exact question, so only call it for the customer's live question and only promise to check with the owner when you call it.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description:
              "The customer's exact question or request that needs the owner (e.g. 'how much is waybill to Enugu for 3 units?', 'can you give me a quote for 50 pieces?')",
          },
        },
        required: ["reason"],
      },
    },
  },
];

const MAX_TOOL_ROUNDS = 2;
// Only the tail of the conversation is sent to the model. An unbounded
// history eventually blows past DeepSeek's context window and crashes the
// call, so we cap it at the last 10 messages.
const HISTORY_LIMIT = 10;
const NEGOTIATION_INACTIVITY_MS = 24 * 60 * 60 * 1000;

type ToolResult =
  | { query: string; count: number; products: ProductMatch[] }
  | { query: string; count: number; faqs: FaqMatch[] }
  | { escalated: true; reason: string }
  | { error: string };

type StoredNegotiation = NegotiationState & {
  productId: string;
  updatedAt: string;
};

export type EngineResult =
  | { reply: string; blocked: false; saved: true; replied: true; paused?: boolean }
  | {
      reply: null;
      blocked: true;
      /** True when the customer's inbound message was persisted (the owner can
       * still see and answer it manually even though the AI is gated off). */
      saved: boolean;
      replied: false;
      reason: "plan_expired" | "cap_hit" | "no_credits" | "paused" | "no_message";
      paused?: boolean;
    };

export async function handleIncomingMessage({
  businessId,
  customerPhone,
  message,
  skipCustomerMessage = false,
}: {
  businessId: string;
  customerPhone: string;
  message: string;
  /**
   * When the caller already persisted the customer's message (for example the
   * voice/image pipelines in `app/api/chat/route.ts` create the row themselves),
   * set this so the engine does not store a duplicate.
   */
  skipCustomerMessage?: boolean;
}): Promise<EngineResult> {
  const incoming = message.trim();
  if (!incoming) {
    return { reply: null, blocked: true, saved: false, replied: false, reason: "no_message" };
  }

  const customer = await prisma.customer.upsert({
    where: { businessId_phone: { businessId, phone: customerPhone } },
    update: {},
    create: { businessId, name: customerPhone, phone: customerPhone },
  });

  let conversation: Conversation;
  const latest = await prisma.conversation.findFirst({
    where: { businessId, customerId: customer.id },
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    conversation = latest;
  } else {
    conversation = await prisma.conversation.create({
      data: { businessId, customerId: customer.id, status: "AI_HANDLING" },
    });
  }

  if (!skipCustomerMessage) {
    await prisma.message.create({
      data: { businessId, conversationId: conversation.id, sender: "customer", content: incoming },
    });
  }

  // The inbound message is persisted from here on: even when the AI is gated
  // off (human takeover, cap hit, expired plan) the owner must still see the
  // customer's message in the dashboard so they can reply manually.

  // AI kill switch: escalated or human-taken-over conversations stay silent.
  if (
    conversation.status === "ESCALATED" ||
    conversation.status === "HUMAN_TAKEOVER"
  ) {
    return { reply: null, blocked: true, saved: true, replied: false, reason: "paused", paused: true };
  }

  if (conversation.pausedUntil && conversation.pausedUntil > new Date()) {
    return { reply: null, blocked: true, saved: true, replied: false, reason: "paused", paused: true };
  }

  const aiCheck = await requireAiEnabled(businessId);
  if (!aiCheck.ok) {
    // Message already saved — the AI just does not reply. Alert the owner's
    // personal Telegram so a paused AI is not silently ignored, then surface
    // the concrete reason (cap_hit / plan_expired / no_credits) to the caller.
    // `sendOwnerAlert` swallows its own errors, so a failed alert never breaks
    // the inbound pipeline.
    await sendOwnerAlert(
      businessId,
      "New message from customer! Your AI is currently paused (" +
        aiCheck.reason +
        "). Reply manually in your dashboard or upgrade to restore AI.",
    );
    return { reply: null, blocked: true, saved: true, replied: false, reason: aiCheck.reason };
  }

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: {
      name: true,
      tone: true,
      description: true,
      businessHours: true,
      paymentInstructions: true,
    },
  });

  const negotiation = await loadNegotiation(businessId, conversation.id, incoming);

  const history = await prisma.message.findMany({
    where: { businessId, conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  history.reverse();

  const chatMessages: ChatMessage[] = [];
  const tone = isTone(business.tone) ? business.tone : "friendly";
  let systemPrompt = buildSystemPrompt(business, tone, negotiation, customer);
  const language = detectLanguage(incoming);
  systemPrompt += getLanguageInstruction(language);

  chatMessages.push({ role: "system", content: systemPrompt });
  for (const msg of history) {
    if (msg.audioUrl && msg.transcript) {
      chatMessages.push({ role: msg.sender === "customer" ? "user" : "assistant", content: msg.transcript });
    } else if (msg.imageUrl && msg.imageDescription) {
      chatMessages.push({ role: msg.sender === "customer" ? "user" : "assistant", content: msg.imageDescription });
    } else {
      chatMessages.push({ role: msg.sender === "customer" ? "user" : "assistant", content: msg.content });
    }
  }

  let result = await askAI(chatMessages, TOOLS);
  let toolCalls = result.toolCalls ?? [];
  for (let round = 0; round < MAX_TOOL_ROUNDS && toolCalls.length > 0; round++) {
    chatMessages.push({
      role: "assistant",
      content: result.completion?.choices[0]?.message?.content ?? null,
      tool_calls: toolCalls,
    });
    for (const toolCall of toolCalls) {
      chatMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(await runToolCall(businessId, conversation.id, toolCall)),
      });
    }
    result = await askAI(chatMessages, TOOLS);
    toolCalls = result.toolCalls ?? [];
  }
  let reply = result.reply.trim();
  if (!reply) {
    const final = await askAI(chatMessages);
    reply = final.reply.trim();
  }

  await prisma.message.create({
    data: { businessId, conversationId: conversation.id, sender: "ai", content: reply },
  });

  await applyAiUsage(businessId);

  return { reply, blocked: false, saved: true, replied: true, paused: false };
}

async function applyAiUsage(businessId: string) {
  const businessForTracking = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      plan: true,
      planStatus: true,
      planInterval: true,
      onboardingEndsAt: true,
      trialEndsAt: true,
      channel: true,
      creditWalletBalanceNaira: true,
    },
  });
  if (!businessForTracking) return;
  const now = new Date();
  const activePaidPlan = isActivePaidPlan(businessForTracking);
  // `trialEndsAt` is the 7-day trial window; `onboardingEndsAt` is the
  // fallback for rows created before the trial column existed.
  const trialEndsAt =
    businessForTracking.trialEndsAt ?? businessForTracking.onboardingEndsAt;
  const isTrialActive =
    businessForTracking.planStatus === "trialing" &&
    trialEndsAt &&
    trialEndsAt > now;
  const aiCreditPrice = getCreditPrice(businessForTracking, "ai");
  if (activePaidPlan || isTrialActive) {
    const limits = getPlanLimits(
      businessForTracking.plan,
      businessForTracking.planInterval,
    );
    const included = limits.includedMsgs;
    const currentUsage = await prisma.message.count({
      where: {
        businessId,
        sender: "ai",
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
    });
    if (currentUsage <= included) {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          messagesUsedThisMonth: { increment: 1 },
          // Trial counter: how many AI replies the 7-day trial has spent.
          aiMessagesUsed: { increment: 1 },
        },
      });
    } else if (businessForTracking.creditWalletBalanceNaira >= aiCreditPrice) {
      await prisma.business.update({
        where: { id: businessId },
        data: {
          creditWalletBalanceNaira: { decrement: aiCreditPrice },
          messagesUsedThisMonth: { increment: 1 },
          aiMessagesUsed: { increment: 1 },
        },
      });
    }
  } else if (businessForTracking.creditWalletBalanceNaira >= aiCreditPrice) {
    await prisma.business.update({
      where: { id: businessId },
      data: {
        creditWalletBalanceNaira: { decrement: aiCreditPrice },
        messagesUsedThisMonth: { increment: 1 },
        aiMessagesUsed: { increment: 1 },
      },
    });
  }
}

function buildSystemPrompt(
  business: {
    name: string;
    description: string | null;
    businessHours: string | null;
    paymentInstructions: string | null;
  },
  tone: Tone,
  negotiation: StoredNegotiation | null,
  customer: { tags: string[]; notes: string | null },
): string {
  let systemPrompt = SYSTEM_PROMPT_RULES.replace("{Business Name}", business.name);
  if (business.description) {
    systemPrompt += "\n\nBusiness description: " + business.description;
  }
  if (business.businessHours) {
    systemPrompt += "\n\nOpening hours: " + business.businessHours;
  }
  if (business.paymentInstructions) {
    systemPrompt +=
      "\n\npaymentInstructions: " + business.paymentInstructions;
  }
  const profile: string[] = [];
  if (customer.tags.length > 0) {
    profile.push("tags: " + customer.tags.join(", "));
  }
  if (customer.notes) {
    profile.push("notes: " + customer.notes);
  }
  if (profile.length > 0) {
    systemPrompt +=
      " Customer profile (internal context, never quote it back verbatim): " +
      profile.join("; ") +
      ".";
  }
  if (negotiation) {
    const next = calculateCounterOffer(negotiation);
    systemPrompt +=
      " The customer is negotiating price for " +
      negotiation.productName +
      ". The list price is " +
      negotiation.listPrice +
      " Naira" +
      (negotiation.floorPrice ? ", floor price is " + negotiation.floorPrice + " Naira" : "") +
      ". Their current offer is " +
      negotiation.currentOffer +
      " Naira. This is round " +
      negotiation.round +
      " of " +
      DEFAULT_MAX_ROUNDS +
      ". The next offer you must make is " +
      next +
      " Naira. If the customer rejects this offer, politely decline further negotiation.";
  }
  systemPrompt += " " + TONE_INSTRUCTIONS[tone];
  return systemPrompt;
}

async function runToolCall(
  businessId: string,
  conversationId: string,
  toolCall: ChatToolCall,
): Promise<ToolResult> {
  if (toolCall.type !== "function") {
    return { error: `Unknown tool: ${toolCall.type}` };
  }
  const query = readArgument(toolCall.function.arguments, "query");
  switch (toolCall.function.name) {
    case "search_products": {
      const products = await searchProducts(businessId, query);
      return { query, count: products.length, products };
    }
    case "search_faqs": {
      const faqs = await searchFAQs(businessId, query);
      return { query, count: faqs.length, faqs };
    }
    case "find_similar_products": {
      const products = await findSimilarProducts(businessId, query);
      return { query, count: products.length, products };
    }
    case "escalate_to_owner": {
      const reason = readArgument(toolCall.function.arguments, "reason");
      console.log(
        "[TOOL] Executing escalate_to_owner for business:",
        businessId,
        "reason:",
        reason,
      );
      // Flag the conversation so the dashboard can surface "needs attention",
      // then alert the owner's personal Telegram. `sendEscalationAlert` swallows
      // its own errors, so a failed alert never fails the customer's chat reply.
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { escalatedAt: new Date(), status: "ESCALATED" },
      });

      // The owner's chat id and the bot that can message it.
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { ownerTelegramChatId: true, telegramBotToken: true },
      });

      await sendEscalationAlert({
        businessId,
        ownerChatId: business?.ownerTelegramChatId ?? null,
        customerMessage: reason,
        businessBotToken: business?.telegramBotToken ?? null,
      });

      return { escalated: true, reason };
    }
    default:
      return { error: `Unknown tool: ${toolCall.function.name}` };
  }
}

/** Read a string field out of a tool call's JSON argument object ("" if absent). */
function readArgument(rawArguments: string, key: string): string {
  try {
    const parsed = JSON.parse(rawArguments) as Record<string, unknown>;
    return typeof parsed?.[key] === "string" ? (parsed[key] as string) : "";
  } catch {
    return "";
  }
}

async function loadNegotiation(
  businessId: string,
  conversationId: string,
  incoming: string,
): Promise<StoredNegotiation | null> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { negotiationState: true },
  });
  const rawState = conv?.negotiationState;
  if (!rawState || typeof rawState !== "object") return null;
  const s = rawState as Record<string, unknown>;
  const productId = typeof s.productId === "string" ? s.productId : "";
  if (!productId) return null;
  const updatedAtStr = typeof s.updatedAt === "string" ? s.updatedAt : "";
  const updatedAt = updatedAtStr ? new Date(updatedAtStr) : null;
  if (!updatedAt || Date.now() - updatedAt.getTime() > NEGOTIATION_INACTIVITY_MS) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { negotiationState: Prisma.DbNull },
    });
    return null;
  }
  const p = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true, name: true, price: true, floorPrice: true, negotiable: true },
  });
  if (!p || !p.negotiable) {
    await prisma.conversation.update({ where: { id: conversationId }, data: { negotiationState: Prisma.DbNull } });
    return null;
  }
  const listPrice = Number(p.price);
  const floorPrice = p.floorPrice == null ? null : Number(p.floorPrice);
  const offer = parseOffer(incoming, listPrice);
  if (offer != null) {
    const nextState = {
      productId: p.id,
      productName: p.name,
      listPrice,
      floorPrice,
      currentOffer: offer,
      round: (typeof s.round === "number" ? s.round : 0) + 1,
      maxRounds: DEFAULT_MAX_ROUNDS,
      updatedAt: new Date().toISOString(),
    };
    await prisma.conversation.update({ where: { id: conversationId }, data: { negotiationState: nextState } });
    return nextState as StoredNegotiation;
  }
  const stored = {
    productId: p.id,
    productName: p.name,
    listPrice,
    floorPrice: floorPrice,
    currentOffer: typeof s.currentOffer === "number" ? s.currentOffer : listPrice,
    round: typeof s.round === "number" ? s.round : 0,
    maxRounds: DEFAULT_MAX_ROUNDS,
    updatedAt: new Date().toISOString(),
  };
  return stored as StoredNegotiation;
}
