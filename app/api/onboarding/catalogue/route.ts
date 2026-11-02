import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, price } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }
    if (typeof price !== "number" || price <= 0) {
      return NextResponse.json({ error: "Valid price is required" }, { status: 400 });
    }

    const product = await prisma.product.upsert({
      where: { id: "first-product" },
      create: {
        businessId: user.businessId,
        name: name.trim(),
        price,
        negotiable: false,
        stock: null,
      },
      update: {
        name: name.trim(),
        price,
      },
    });

    return NextResponse.json({ product: { id: product.id, name: product.name, price: Number(product.price) } });
  } catch (error) {
    console.error("[onboarding/catalogue] error:", error);
    return NextResponse.json({ error: "Failed to save product" }, { status: 500 });
  }
}
