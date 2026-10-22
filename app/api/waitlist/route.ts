import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/waitlist
// Saves a lead from the WhatsApp waitlist form. The lead is standalone (it is
// not a business yet), so it only stores the WhatsApp number and the optional
// email address.
export async function POST(req: Request) {
  try {
    const { whatsapp, email } = await req.json();

    if (!whatsapp) {
      return NextResponse.json({ error: "WhatsApp number is required" }, { status: 400 });
    }

    await prisma.whatsappWaitlist.create({
      data: {
        whatsappNumber: whatsapp,
        email: email || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WAITLIST ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
