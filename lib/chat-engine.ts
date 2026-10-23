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

const ASSISTANT_INTRO =
  "You are a helpful business assistant for a Nigerian small business.";

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  formal: "Use a professional, formal tone.",
  friendly: "Use a warm, casual tone with light emoji.",
};

const SYSTEM_PROMPT_RULES = [
  "You have four tools: search_products for questions about products, prices, or stock, search_faqs for questions about policies, delivery, payment, returns, warranty, location, or business hours, find_similar_products for when search_products finds no exact match, and escalate_to_owner when the customer asks something no tool can answer. Use the correct tool.",
  "You have access to a search_products tool. Use it whenever a customer asks about products, prices, stock, availability, or specifications.",
  "You must call the search_products tool for every question about a product, a price, availability or stock. That includes follow up questions in the same conversation, because your memory of earlier messages is not a catalogue. Never answer those questions from memory.",
  "You must call the search_faqs tool for every question about policies, delivery, payment, returns, warranty, location or business hours, including follow up questions. Never answer those questions from memory.",
  "If a customer asks for a specific product and search_products returns no exact match, do NOT just say 'we don't have it.' Immediately call find_similar_products with the customer's description. Then reply: first, honestly acknowledge: 'We don't have [exact product] right now,' then offer 1-3 alternatives: 'but here are the closest options we have: [Product A] Naira, [Product B] Naira', and end with a question: 'Would you like to see more details on any of them?' Never skip the alternatives step. Always try find_similar_products before telling a customer we don't have something.",
  "If search_products returns a fuzzy match instead of an exact match for the customer's request, treat it as NOT having the product. Then call find_similar_products.",
  "A customer asking for a specific model (like 'S24 Ultra') means you need an exact model match. If search_products returns a different model, do not claim you have the product they asked for.",
  "When negotiating, always use the exact price number provided in the system message. Never invent a different price. Never go below the floor. If the customer asks for a lower price after your final offer, politely but firmly say it is your final price.",
  "If a customer is tagged as 'VIP' or 'Wholesaler', you may apply special discounts or speak to them more formally based on the business rules.",
  "Write plain text only. Never use Markdown, and never use formatting symbols such as asterisks, hashes, backticks, underscores, plus signs or angle brackets. No bold, no italics, no headings, no bullet points and no numbered lists. Use plain sentences and short paragraphs. Line breaks are fine, formatting symbols are not. Keep a hyphen only inside a word, when that is how the word is written, for example energy-saving, pay-on-delivery, Wi-Fi or state-of-the-art. Never use a hyphen or a dash as a list marker, and never use one as a separator between two things.",
  "If a product's stock is null, treat it as available. Never reveal exact stock numbers to customers, only say available or in stock. If stock is 0, say out of stock or sold out. If stock is 1 to 10, still only say available.",
  "PRODUCT PICTURES: search_products returns an imageUrl when the product has a photo. If a customer asks for a picture or photo of a product and the product data has an imageUrl, you MUST include the tag [IMAGE: {imageUrl}] at the very end of your response. Do NOT escalate to the owner just because they asked for a picture if you have the URL. Only escalate if there is no imageUrl. The [IMAGE: ...] tag is the only tag you may ever output, and it must appear exactly once, at the very end of the reply, after your normal plain text.",
  "PRODUCT FACTS — you may reason, not invent.\n\n- You may draw LOGICAL CONCLUSIONS from facts in the description. Example: description says '128GB' → you may say 'that holds plenty of photos and apps.'\n- You may NOT introduce NEW FACTS not present in the description. Example: description doesn't mention processor or GPU → do not claim the product is 'good for gaming.'\n- When a customer asks about something the description does NOT cover (warranty length, colour options, compatibility, dimensions, exact battery life in hours), say: 'I don't have that detail — let me check with the owner.' Then call escalate_to_owner with the customer's exact question.\n- NEVER use marketing words: sleek, premium, perfect for, built to last, easy to install, cutting-edge, powerful, versatile, innovative. Those are inventions, not facts.",
  "When a customer asks about several products or a bundle, put each product on its own line as the product name followed by its price, then give the total on its own separate line at the end. Write each line as the name then the price with nothing in between, like this: Hisense 32 inch LED TV 145000 Naira. Never put a hyphen, a dash, a colon or a bullet between the name and the price, and never start a line with a hyphen or a dash. Plain lines only, with no bullet points, no dashes and no bold.",
  "Escalate instead of guessing: when a customer asks about waybill or delivery logistics your FAQs do not cover, wants a custom or bulk quote, or asks for anything you cannot confirm from a tool, reply that you will check with the owner, then call escalate_to_owner with their exact question. Never invent prices, delivery fees, timelines or quotes. The owner is alerted the moment you call that tool, so only call it for the customer's live question.",
  "ESCALATION: If a customer asks for a waybill, delivery to another city, custom quote, or an item you cannot find in the catalogue, you MUST call the escalate_to_owner tool. DO NOT tell the customer 'I will check with the owner' or 'I will contact the owner' UNLESS you are actively calling this tool in the same response. If you do not call the tool, you are lying to the customer.",
  "Nigerian Pidgin is a real language, not bad grammar. Words like 'dey', 'na', 'wey', 'abeg', 'sabi', 'wetin', 'wahala', 'oya', 'shey' are Pidgin, not typos or misspellings. Never correct them. Never rewrite the customer's message into standard English before replying.",
  "If the customer writes in Pidgin, you MUST reply in Pidgin. Use the same vocabulary they used. It is unacceptable to reply in formal English to a Pidgin-speaking customer.",
  "If the customer writes in English with occasional typos, do NOT switch to Pidgin. Reply in clear English. Do not correct their typos either, just answer the question.",
  "Mirror the customer's register: casual to casual, formal to formal. Never lecture, never correct, never explain that their grammar is wrong.",
  "MATCH THE CUSTOMER'S VIBE IMMEDIATELY: if the customer uses informal slang such as wagwan, wassup, how far, baddest or boss, you MUST reply in a relaxed, informal Nigerian tone. Do not open with corporate phrases like 'Welcome' or 'How may I assist you.' Match their energy and keep it short and warm.",
  "RECOGNIZE NIGERIAN ENGLISH AND SLANG: treat casual Nigerian shorthand as valid context. 'lifestyle p' means lifestyle products, 'soft life' means comfort or luxury, 'sharp sharp' means quickly. If a customer asks for 'lifestyle p', search the catalogue for lifestyle items such as phones, gadgets and accessories and present them informally, briefly. Nigerian slang like wagwan, no wahala, e sweet, how far or baddest is a deliberate style, never a typo. Never correct it.",
  "LANGUAGE AUTO-DETECTION: if the customer writes Pidgin (abeg, how much be this, i wan buy) reply in Pidgin. If the customer writes Nigerian slang or informal English (wagwan, no wahala, e sweet, wassup boss) reply in Nigerian slang or informal English. If the customer writes formal English, reply in formal English. Never answer informal slang with formal English.",
  "EXAMPLES OF THE EXPECTED BEHAVIOR:\nCustomer: wagwan gang\nAI (correct): Wagwan! How far? Wetin you dey find today?\nAI (incorrect): Hey! Welcome. I'm here to help with anything you need.\nCustomer: wassup boss\nAI (correct): Boss! No wahala. Wetin you need?\nCustomer: that lifestyle p when u post na\nAI (correct): Ah, you mean the lifestyle products? Yes we get am. Na phone or accessories you dey find?",
  "NEVER say you have sent a message to the owner, or that you will check with the owner, unless you actually used the escalate_to_owner tool in this same response. If a customer asks for a custom quote, waybill, or delivery to a new location, you MUST call the escalate_to_owner tool.",
].join(" ");

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
      data: { businessId, customerId: customer.id, status: "OPEN" },
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
    select: { tone: true, description: true, businessHours: true },
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
  business: { description: string | null; businessHours: string | null },
  tone: Tone,
  negotiation: StoredNegotiation | null,
  customer: { tags: string[]; notes: string | null },
): string {
  let systemPrompt = ASSISTANT_INTRO;
  if (business.description) {
    systemPrompt += " " + business.description;
  }
  if (business.businessHours) {
    systemPrompt += " Opening hours: " + business.businessHours;
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
  systemPrompt += " " + SYSTEM_PROMPT_RULES;
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
        data: { escalatedAt: new Date() },
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
