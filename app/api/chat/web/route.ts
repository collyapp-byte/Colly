import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleIncomingMessage } from "@/lib/chat-engine";

/** Longest message a web visitor may send, matching the widget input. */
const MAX_MESSAGE_LENGTH = 2000;

/** Longest visitor id we keep; it becomes part of the customer's phone key. */
const MAX_CUSTOMER_ID_LENGTH = 100;

/**
 * Sent when the AI is paused, capped, or out of credit. Web visitors still get
 * a reply, and the owner can follow up from the dashboard.
 */
const FALLBACK_REPLY =
  "Thanks for your message. A member of our team will get back to you shortly.";

// GET /api/chat/web?businessId=...
// Public business name for the widget header. Only the name is exposed.
export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams
      .get("businessId")
      ?.trim();

    if (!businessId) {
      return NextResponse.json(
        { error: "Missing businessId" },
        { status: 400 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error("[WEB CHAT] Failed to load business:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}

// POST /api/chat/web
// Public entry point for the website chat widget.
// Body: { businessId, customerId, message }.
//
// Delegates reply generation to the shared chat engine so web visitors get the
// same products, FAQs, tone, history, and billing rules as WhatsApp/Telegram.
// Visitors are identified by a browser-generated `customerId`, stored as the
// phone `web:<id>` so they never collide with real phone numbers.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: unknown;
      customerId?: unknown;
      message?: unknown;
    };

    const businessId =
      typeof body.businessId === "string" ? body.businessId.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";
    const rawCustomerId =
      typeof body.customerId === "string" ? body.customerId.trim() : "";

    if (!businessId || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` },
        { status: 400 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const customerId = rawCustomerId
      ? rawCustomerId.slice(0, MAX_CUSTOMER_ID_LENGTH)
      : crypto.randomUUID();
    const customerPhone = `web:${customerId}`;

    // Give web visitors a readable name in the dashboard. The engine's own
    // upsert is a no-op for existing rows, so this name sticks.
    await prisma.customer.upsert({
      where: {
        businessId_phone: { businessId: business.id, phone: customerPhone },
      },
      update: {},
      create: {
        businessId: business.id,
        name: "Web Visitor",
        phone: customerPhone,
      },
    });

    const result = await handleIncomingMessage({
      businessId: business.id,
      customerPhone,
      message,
    });

    if (result.blocked) {
      if (result.reason === "no_message") {
        return NextResponse.json(
          { error: "Message is required" },
          { status: 400 },
        );
      }

      return NextResponse.json({
        reply: FALLBACK_REPLY,
        blocked: true,
        reason: result.reason,
      });
    }

    return NextResponse.json({ reply: result.reply, blocked: false });
  } catch (error) {
    console.error("[WEB CHAT ERROR]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
