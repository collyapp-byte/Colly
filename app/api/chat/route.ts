import { Prisma, type Conversation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { processVoiceNote } from "@/lib/voice-pipeline";
import { processImageMessage } from "@/lib/image-pipeline";
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
  type DetectedLanguage,
} from "@/lib/language-detect";
import { requireAiEnabled } from "@/lib/auth-guards";
import { getPlanLimits } from "@/lib/plans";

// The fixed identity every reply starts from.
const ASSISTANT_INTRO =
  "You are a helpful business assistant for a Nigerian small business.";

// How the assistant should write, keyed by Business.tone.
const TONE_INSTRUCTIONS: Record<Tone, string> = {
  formal: "Use a professional, formal tone.",
  friendly: "Use a warm, casual tone with light emoji.",
};

// Invariant instructions that never depend on a tenant's settings.
const SYSTEM_PROMPT_RULES = [
  "You have three tools: search_products for questions about products, prices, or stock, search_faqs for questions about policies, delivery, payment, returns, warranty, location, or business hours, and find_similar_products for when search_products finds no exact match. Use the correct tool.",
  "You have access to a search_products tool. Use it whenever a customer asks about products, prices, stock, availability, or specifications.",
  // Tool use is mandatory for product questions, including follow ups, because
  // the model otherwise answers from memory and invents "we don't have it".
  "You must call the search_products tool for every question about a product, a price, availability or stock. That includes follow up questions in the same conversation, because your memory of earlier messages is not a catalogue. Never answer those questions from memory.",
  "You must call the search_faqs tool for every question about policies, delivery, payment, returns, warranty, location or business hours, including follow up questions. Never answer those questions from memory.",
  // A lost sale is worse than an imperfect suggestion, so the model must always
  // offer the closest real alternatives before it tells a customer we don't have
  // something. The alternatives still come from the tool, never from memory.
  "If a customer asks for a specific product and search_products returns no exact match, do NOT just say 'we don't have it.' Immediately call find_similar_products with the customer's description. Then reply: first, honestly acknowledge: 'We don't have [exact product] right now,' then offer 1-3 alternatives: 'but here are the closest options we have: [Product A] Naira, [Product B] Naira', and end with a question: 'Would you like to see more details on any of them?' Never skip the alternatives step. Always try find_similar_products before telling a customer we don't have something.",
  "If search_products returns a fuzzy match instead of an exact match for the customer's request, treat it as NOT having the product. Then call find_similar_products.",
  "A customer asking for a specific model (like 'S24 Ultra') means you need an exact model match. If search_products returns a different model, do not claim you have the product they asked for.",
  // Price negotiation is decided in code; the model only phrases the number it
  // is handed in a system message.
  "When negotiating, always use the exact price number provided in the system message. Never invent a different price. Never go below the floor. If the customer asks for a lower price after your final offer, politely but firmly say it is your final price.",
  // Our chat bubbles render raw text, so any Markdown would be shown to the
  // customer as literal symbols. Keep every reply plain.
  "Write plain text only. Never use Markdown, and never use formatting symbols such as asterisks, hashes, backticks, underscores, plus signs or angle brackets. No bold, no italics, no headings, no bullet points and no numbered lists. Use plain sentences and short paragraphs. Line breaks are fine, formatting symbols are not. Keep a hyphen only inside a word, when that is how the word is written, for example energy-saving, pay-on-delivery, Wi-Fi or state-of-the-art. Never use a hyphen or a dash as a list marker, and never use one as a separator between two things.",
  // Exact stock figures are private. A null stock means the owner is not
  // tracking it, so the product is simply available. The model decides
  // availability internally, then tells the customer only the state.
  "If a product's stock is null, treat it as available. Never reveal exact stock numbers to customers, only say available or in stock. If stock is 0, say out of stock or sold out. If stock is 1 to 10, still only say available.",
  // PRODUCT FACTS — you may reason, not invent.
  "PRODUCT FACTS — you may reason, not invent.\n\n- You may draw LOGICAL CONCLUSIONS from facts in the description. Example: description says '128GB' → you may say 'that holds plenty of photos and apps.'\n- You may NOT introduce NEW FACTS not present in the description. Example: description doesn't mention processor or GPU → do not claim the product is 'good for gaming.'\n- When a customer asks about something the description does NOT cover (warranty length, colour options, compatibility, dimensions, exact battery life in hours), say: 'I don't have that detail — let me check with the owner.' Then call escalate_to_owner with the customer's exact question.\n- NEVER use marketing words: sleek, premium, perfect for, built to last, easy to install, cutting-edge, powerful, versatile, innovative. Those are inventions, not facts.",
  // Several products in one answer must read as clean lines, not a list. The
  // worked example matters: without it the model reaches for "name - price".
  "When a customer asks about several products or a bundle, put each product on its own line as the product name followed by its price, then give the total on its own separate line at the end. Write each line as the name then the price with nothing in between, like this: Hisense 32 inch LED TV 145000 Naira. Never put a hyphen, a dash, a colon or a bullet between the name and the price, and never start a line with a hyphen or a dash. Plain lines only, with no bullet points, no dashes and no bold.",
  // Nigerian Pidgin is a full language. The model must mirror it instead of
  // treating it as misspelled English, and must never switch to formal English
  // for a Pidgin-speaking customer.
  "Nigerian Pidgin is a real language, not bad grammar. Words like 'dey', 'na', 'wey', 'abeg', 'sabi', 'wetin', 'wahala', 'oya', 'shey' are Pidgin, not typos or misspellings. Never correct them. Never rewrite the customer's message into standard English before replying.",
  "If the customer writes in Pidgin, you MUST reply in Pidgin. Use the same vocabulary they used. It is unacceptable to reply in formal English to a Pidgin-speaking customer.",
  "If the customer writes in English with occasional typos, do NOT switch to Pidgin. Reply in clear English. Do not correct their typos either, just answer the question.",
  "Mirror the customer's register: casual to casual, formal to formal. Never lecture, never correct, never explain that their grammar is wrong.",
].join(" ");

/**
 * Builds the system prompt for one tenant: identity, the business context
 * (description and hours), the invariant rules, then the tone. The tone is only
 * a fallback for English messages: when the customer actually writes Pidgin,
 * the caller appends a language instruction after everything else and the tone
 * must not fight it, so it is omitted. An unknown stored tone falls back to
 * "friendly".
 */
function buildSystemPrompt(
  business: {
    tone: string;
    description: string | null;
    businessHours: string | null;
  },
  detectedLanguage: DetectedLanguage,
): string {
  const lines = [ASSISTANT_INTRO];

  if (business.description) {
    lines.push(`Business context: ${business.description}`);
  }
  if (business.businessHours) {
    lines.push(`Business hours: ${business.businessHours}`);
  }

  lines.push(SYSTEM_PROMPT_RULES);

  if (detectedLanguage === "english") {
    const tone = isTone(business.tone) ? business.tone : "friendly";
    lines.push(
      `Tone: ${TONE_INSTRUCTIONS[tone]} Write the whole reply in this style.`,
    );
  }

  return lines.join(" ");
}

// How many past messages to send back to the model as context.
const HISTORY_LIMIT = 20;

// How many times the model may call tools before it has to answer in words.
const MAX_TOOL_ROUNDS = 3;

// The model's capabilities: looking things up in the business's catalogue and
// its FAQ knowledge base.
const TOOLS: ChatTool[] = [
  {
    type: "function",
    function: {
      name: "search_products",
      description:
        "Search this business's product catalogue. Returns up to 5 matching products with their name, price in Naira, stock level and description. Use it for any question about products, prices, stock, availability or specifications.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Keywords from the customer's question, e.g. 'Hisense 32 inch TV' or 'Samsung A15'.",
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
      description:
        "Search this business's FAQ knowledge base. Returns up to 5 matching entries with their question, answer and category. Use it for any question about policies, delivery, payment, returns, warranty, location or business hours.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Keywords from the customer's question, e.g. 'delivery time' or 'return policy'.",
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
      description:
        "Use this when search_products returns no matches or the customer asks for a product that isn't in the catalogue. Returns the closest alternative products so you can suggest them.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The customer's product description, e.g. 'iPhone 15 Pro' or '55 inch smart TV'.",
          },
        },
        required: ["query"],
      },
    },
  },
];

type ChatRequestBody = {
  businessId?: unknown;
  customerId?: unknown;
  message?: unknown;
  audioUrl?: unknown;
  imageUrl?: unknown;
};

// POST /api/chat
// Body: { businessId: string, customerId: string, message: string }
//   or: { businessId: string, customerId: string, audioUrl: string }
//   or: { businessId: string, customerId: string, imageUrl: string }
// Persists the incoming message, asks DeepSeek for a reply, persists the reply
// and returns { reply }.
//
// When `audioUrl` or `imageUrl` is present, the audio/image is processed first
// and the transcript/description stands in for `message`; priority is audioUrl >
// imageUrl > message. `businessId` may be omitted when the caller is signed in,
// in which case the session decides the tenant. A caller with no dashboard
// session (e.g. the future WhatsApp webhook) must send the shared secret in the
// `X-Colly-Internal-Secret` header (CHAT_INTERNAL_SECRET); without it the
// request is rejected, so an anonymous caller cannot target another tenant.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const { customerId } = body;
    const messageText = typeof body.message === "string" ? body.message : "";
    // Priority for effectiveMessage: audioUrl > imageUrl > message
    const audioUrl =
      typeof body.audioUrl === "string" && body.audioUrl.length > 0
        ? body.audioUrl
        : null;
    const imageUrl =
      typeof body.imageUrl === "string" && body.imageUrl.length > 0
        ? body.imageUrl
        : null;

    const user = await getCurrentUser();

    let businessId =
      typeof body.businessId === "string" && body.businessId.length > 0
        ? body.businessId
        : null;

    if (user) {
      // A signed-in caller can only post to its own business.
      if (businessId && businessId !== user.businessId) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      businessId = user.businessId;
    } else {
      // No session: only trusted server-to-server callers may pass a
      // businessId, and only with the shared secret. Otherwise an anonymous
      // caller could write into any tenant and drain its credits.
      const secret = request.headers.get("x-colly-internal-secret");
      const expected = process.env.CHAT_INTERNAL_SECRET;

      if (!expected || secret !== expected) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    if (
      !businessId ||
      typeof customerId !== "string" ||
      customerId.length === 0 ||
      (!audioUrl && !imageUrl && messageText.length === 0)
    ) {
      return Response.json(
        {
          error:
            "businessId, customerId and either message, audioUrl or imageUrl are required",
        },
        { status: 400 },
      );
    }

    // The customer has to belong to this business, otherwise a caller could
    // graft a message onto another tenant's customer.
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true },
    });

    if (!customer) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    // 1. Save the incoming customer message. A voice note or image is processed
    //    first (audioUrl > imageUrl priority), and the transcript/description
    //    then stands in for the typed message for the whole reply flow below.
    let conversation: Conversation;
    let effectiveMessage = messageText;

    if (audioUrl) {
      const voice = await processVoiceNote({
        businessId,
        customerId,
        audioUrl,
      });

      conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: voice.conversationId },
      });
      effectiveMessage = voice.transcript;

      console.log(`[chat] voice note transcribed: "${effectiveMessage}"`);
    } else if (imageUrl) {
      const image = await processImageMessage({
        businessId,
        customerId,
        imageUrl,
      });

      conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: image.conversationId },
      });
      effectiveMessage = image.description;

      console.log(`[chat] image described: "${effectiveMessage}"`);
    } else {
      // Reuse the customer's most recent conversation, or start a fresh one.
      conversation =
        (await prisma.conversation.findFirst({
          where: { businessId, customerId },
          orderBy: { createdAt: "desc" },
        })) ??
        (await prisma.conversation.create({
          data: { businessId, customerId, status: "OPEN" },
        }));

      await prisma.message.create({
        data: {
          businessId,
          conversationId: conversation.id,
          sender: "customer",
          content: effectiveMessage,
        },
      });
    }

    // The customer's own language (English, Pidgin, or a mix) drives how the
    // reply is written; the owner's tone setting is only a fallback below.
    const detectedLanguage = detectLanguage(effectiveMessage);
    console.log(`[chat] detected language: ${detectedLanguage}`);

    // 2. Human takeover. While an agent has the conversation, do not generate a
    //    reply: the customer message above is still saved so the agent sees it.
    if (
      conversation.pausedUntil &&
      conversation.pausedUntil.getTime() > Date.now()
    ) {
      return Response.json({ reply: null, paused: true });
    }

    // 2b. AI auto-reply gate: check plan caps and credits
    const aiCheck = await requireAiEnabled(businessId);
    if (!aiCheck.ok) {
      // Save the incoming message so owner sees it, but don't generate AI reply
      return Response.json({
        reply: null,
        paused: false,
        aiDisabled: true,
        reason: aiCheck.reason,
      });
    }

    // 3. Build the prompt: system prompt + recent conversation history.
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    });
    recentMessages.reverse();

    // The tenant's settings shape the reply: tone, then business context.
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { tone: true, description: true, businessHours: true },
    });

    const baseSystemPrompt = buildSystemPrompt(
      business ?? { tone: "friendly", description: null, businessHours: null },
      detectedLanguage,
    );

    // The language instruction goes at the very end of the system prompt: with
    // LLMs the most recent instruction carries the most weight, so the
    // customer's language overrides the owner's tone setting (already omitted
    // for non-English above) and every preceding rule.
    const languageInstruction = getLanguageInstruction(detectedLanguage);
    const systemPrompt = `${baseSystemPrompt}\n\n${languageInstruction}`;

    // Deterministic negotiation: the code decides the price, the model only
    // phrases it. If this message contains an offer for a product that is in
    // play, pin the exact counter (or refusal) in an extra system message.
    const negotiationMessage = await buildNegotiationMessage({
      businessId,
      conversationId: conversation.id,
      negotiationState: conversation.negotiationState,
      recentMessages,
      message: effectiveMessage,
    });

    const chatMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...(negotiationMessage
        ? ([{ role: "system", content: negotiationMessage }] as ChatMessage[])
        : []),
      ...recentMessages.map((m): ChatMessage =>
        m.sender === "customer"
          ? { role: "user", content: m.content }
          : { role: "assistant", content: m.content },
      ),
    ];

    // 4. Ask the AI brain through the fallback chain (DeepSeek -> Groq ->
    //    OpenRouter -> static). It may answer with a tool call instead of text,
    //    so let it look things up (up to MAX_TOOL_ROUNDS times), feeding each
    //    result back into the conversation before asking again.
    let result = await askAI(chatMessages, TOOLS);
    console.log(`[chat] reply via ${result.provider}`);
    let toolCalls = result.toolCalls ?? [];

    for (let round = 0; round < MAX_TOOL_ROUNDS && toolCalls.length > 0; round++) {
      // Echo the assistant turn that requested the tools, then append one
      // "tool" message per call — the API requires both halves to be present.
      chatMessages.push({
        role: "assistant",
        content: result.completion?.choices[0]?.message?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(await runToolCall(businessId, toolCall)),
        });
      }

      result = await askAI(chatMessages, TOOLS);
      console.log(`[chat] reply via ${result.provider}`);
      toolCalls = result.toolCalls ?? [];
    }

    // The last turn should be plain text. If the model stalled on a tool call
    // without saying anything, ask once more without tools so the customer
    // always gets an answer.
    let reply = result.reply.trim();

    if (!reply) {
      const final = await askAI(chatMessages);
      console.log(`[chat] reply via ${final.provider}`);
      reply = final.reply.trim();
    }

    // 5. Save the AI's reply.
    await prisma.message.create({
      data: {
        businessId,
        conversationId: conversation.id,
        sender: "ai",
        content: reply,
      },
    });

    // 6. Track usage: increment messagesUsedThisMonth or decrement creditsBalance
    const businessForTracking = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        plan: true,
        planStatus: true,
        planInterval: true,
        onboardingEndsAt: true,
        creditsBalance: true,
      },
    });

    if (businessForTracking) {
      const now = new Date();
      const isActivePaidPlan =
        businessForTracking.planStatus === "active" &&
        ["starter", "business", "pro"].includes(businessForTracking.plan);

      const isTrialActive =
        businessForTracking.planStatus === "trialing" &&
        businessForTracking.onboardingEndsAt &&
        businessForTracking.onboardingEndsAt > now;

      if (isActivePaidPlan || isTrialActive) {
        const limits = getPlanLimits(
          businessForTracking.plan,
          businessForTracking.planInterval,
        );
        const included =
          "includedMessages" in limits
            ? limits.includedMessages
            : limits.aiRepliesLimit ?? 0;

        // Check current usage before incrementing
        const currentUsage = await prisma.message.count({
          where: {
            businessId,
            sender: "ai",
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
          },
        });

        if (currentUsage <= included) {
          // Under cap — just increment the counter
          await prisma.business.update({
            where: { id: businessId },
            data: { messagesUsedThisMonth: { increment: 1 } },
          });
        } else if (businessForTracking.creditsBalance > 0) {
          // Over cap but has credits — consume one credit
          await prisma.business.update({
            where: { id: businessId },
            data: { creditsBalance: { decrement: 1 } },
          });
        }
      } else if (businessForTracking.creditsBalance > 0) {
        // Free/expired plan with credits — consume one credit
        await prisma.business.update({
          where: { id: businessId },
          data: { creditsBalance: { decrement: 1 } },
        });
      }
    }

    return Response.json({ reply });
  } catch (error) {
    console.error("[POST /api/chat]", error);
    return Response.json(
      {
        error: "Failed to process chat message",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// What we send back to the model as the result of a tool call.
type ToolResult =
  | { query: string; count: number; products: ProductMatch[] }
  | { query: string; count: number; faqs: FaqMatch[] }
  | { error: string };

// Run one tool call the model asked for. Parallel calls (for example a
// search_products and a search_faqs in the same round) are each run through
// here from the caller's loop.
async function runToolCall(
  businessId: string,
  toolCall: ChatToolCall,
): Promise<ToolResult> {
  if (toolCall.type !== "function") {
    return { error: `Unknown tool: ${toolCall.type}` };
  }

  const query = readQuery(toolCall.function.arguments);

  switch (toolCall.function.name) {
    case "search_products": {
      const products = await searchProducts(businessId, query);

      console.log(
        `[POST /api/chat] search_products(${JSON.stringify(query)}) -> ${products.length} match(es)`,
      );

      // `count: 0` tells the model the catalogue has nothing for this query,
      // which is its cue to say so rather than inventing a product.
      return { query, count: products.length, products };
    }
    case "search_faqs": {
      const faqs = await searchFAQs(businessId, query);

      console.log(
        `[POST /api/chat] search_faqs(${JSON.stringify(query)}) -> ${faqs.length} match(es)`,
      );

      return { query, count: faqs.length, faqs };
    }
    case "find_similar_products": {
      const products = await findSimilarProducts(businessId, query);

      console.log(
        `[POST /api/chat] find_similar_products(${JSON.stringify(query)}) -> ${products.length} match(es)`,
      );

      return { query, count: products.length, products };
    }
    default:
      return { error: `Unknown tool: ${toolCall.function.name}` };
  }
}

// The model sends arguments as a JSON string (and not always valid JSON), so
// parse defensively rather than trusting them.
function readQuery(rawArguments: string): string {
  try {
    const parsed = JSON.parse(rawArguments) as { query?: unknown };
    return typeof parsed?.query === "string" ? parsed.query : "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------

// A negotiation is abandoned if the customer goes quiet for this long.
const NEGOTIATION_INACTIVITY_MS = 24 * 60 * 60 * 1000;

// What we persist on the conversation: the state machine's numbers plus which
// product they belong to and when we last moved, so we can reset on a product
// switch or a long pause.
type StoredNegotiation = NegotiationState & {
  productId: string;
  updatedAt: string;
};

type NegotiationProduct = {
  id: string;
  name: string;
  price: number;
  floorPrice: number | null;
  negotiable: boolean;
};

// Cheap gate so we only hit the product table when a message could contain a
// number ("100000", "100k", "one hundred thousand").
const NUMBER_WORD_HINT =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/i;

function mightContainOffer(message: string): boolean {
  return /\d/.test(message) || NUMBER_WORD_HINT.test(message);
}

function readStoredNegotiation(value: unknown): StoredNegotiation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const numbers = [
    record.listPrice,
    record.floorPrice,
    record.currentOffer,
    record.round,
    record.maxRounds,
    record.cumulativeConcession,
    record.startingPrice,
  ];
  if (numbers.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    return null;
  }
  if (typeof record.productId !== "string") return null;
  if (
    typeof record.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(record.updatedAt))
  ) {
    return null;
  }

  return value as StoredNegotiation;
}

/**
 * The product currently in play: the one named by the most recent message in
 * the conversation. Returns null when no product has been mentioned.
 */
async function findActiveProduct(
  businessId: string,
  messages: { content: string }[],
): Promise<NegotiationProduct | null> {
  const products = await prisma.product.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      price: true,
      floorPrice: true,
      negotiable: true,
    },
  });

  if (products.length === 0) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i].content.toLowerCase();
    for (const product of products) {
      if (content.includes(product.name.toLowerCase())) {
        return {
          id: product.id,
          name: product.name,
          price: Number(product.price),
          floorPrice:
            product.floorPrice === null ? null : Number(product.floorPrice),
          negotiable: product.negotiable,
        };
      }
    }
  }

  return null;
}

/**
 * Decide the AI's price for this turn, if the message contains an offer for a
 * product that is in play, and return the system-message instruction that pins
 * it. Returns null when the message is not a negotiation.
 *
 * The returned string is the *only* place the price number comes from: the
 * model is told to use it verbatim and never to invent a different one.
 */
async function buildNegotiationMessage(args: {
  businessId: string;
  conversationId: string;
  negotiationState: unknown;
  recentMessages: { content: string }[];
  message: string;
}): Promise<string | null> {
  const { businessId, conversationId, negotiationState, recentMessages, message } =
    args;

  if (!mightContainOffer(message)) return null;

  const product = await findActiveProduct(businessId, recentMessages);
  if (!product) return null;

  const offer = parseOffer(message, product.price);
  if (offer === null) return null;

  // Not negotiable: forget any prior session and tell the model to decline.
  if (!product.negotiable) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { negotiationState: Prisma.DbNull },
    });
    return "This product is not negotiable. Politely decline all offers.";
  }

  // A null floor means the AI never discounts below the list price.
  const floorPrice = product.floorPrice ?? product.price;
  const now = Date.now();

  const stored = readStoredNegotiation(negotiationState);
  const stale =
    !stored ||
    stored.productId !== product.id ||
    now - Date.parse(stored.updatedAt) > NEGOTIATION_INACTIVITY_MS;

  const state: StoredNegotiation = stale
    ? {
        listPrice: product.price,
        floorPrice,
        currentOffer: product.price,
        round: 0,
        maxRounds: DEFAULT_MAX_ROUNDS,
        cumulativeConcession: 0,
        startingPrice: product.price,
        productId: product.id,
        updatedAt: new Date(now).toISOString(),
      }
    : { ...stored };

  // Every detected offer advances the round, whether or not the product
  // changed (a fresh state simply starts from round 0).
  state.round += 1;
  state.updatedAt = new Date(now).toISOString();

  const result = calculateCounterOffer(state);

  state.currentOffer = result.counter;
  state.cumulativeConcession = Math.max(
    0,
    state.startingPrice - result.counter,
  );

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      // `state` is a plain app-level type; Prisma's `InputJsonValue` requires an
      // index signature that a named interface/object type does not carry, so the
      // value is funneled through the cast Prisma itself uses for JSON columns.
      // The object is JSON-serializable by construction (strings/numbers only).
      negotiationState: state as unknown as Prisma.InputJsonValue,
    },
  });

  if (result.isFinal) {
    return `Customer offered ₦${offer}. Your final price is ₦${result.counter}. Do not go lower.`;
  }

  return `Customer offered ₦${offer}. Your counter is ₦${result.counter}. This is not your final offer yet. Use this exact number in your reply.`;
}
