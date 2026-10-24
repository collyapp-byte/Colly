import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { reembedProduct } from "@/lib/embedding-pipeline";

type CsvRow = Record<string, string | undefined>;

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[₦,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

// POST /api/products/import
// Body: multipart/form-data with a `file` CSV containing name, price,
// description (optional) and stock (optional).
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();
    if (!businessId) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "CSV file is required" }, { status: 400 });
    }

    const csvText = await file.text();
    const parsed = Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) =>
        header.replace(/^\uFEFF/, "").trim().toLowerCase(),
    });

    let imported = 0;
    let duplicates = 0;
    let errors = parsed.errors.length;

    for (const row of parsed.data) {
      const name = String(row.name ?? "").trim();
      const price = parseNumber(String(row.price ?? ""));

      if (!name || price === null || price < 0) {
        errors += 1;
        continue;
      }

      const existing = await prisma.product.findFirst({
        where: {
          businessId,
          name: { equals: name, mode: "insensitive" },
        },
        select: { id: true },
      });

      if (existing) {
        duplicates += 1;
        continue;
      }

      const stockRaw = String(row.stock ?? "").trim();
      let stock: number | null = null;
      if (stockRaw) {
        const parsedStock = parseNumber(stockRaw);
        if (
          parsedStock === null ||
          !Number.isInteger(parsedStock) ||
          parsedStock < 0
        ) {
          errors += 1;
          continue;
        }
        stock = parsedStock;
      }

      const description = String(row.description ?? "").trim() || null;

      try {
        const product = await prisma.product.create({
          data: {
            businessId,
            name,
            price,
            stock,
            description,
            images: [],
          },
        });
        imported += 1;

        void reembedProduct(product.id).catch((error) => {
          console.error(
            "[products/import] failed to embed product",
            product.id,
            error,
          );
        });
      } catch (error) {
        console.error("[products/import] failed to create row:", name, error);
        errors += 1;
      }
    }

    return Response.json({
      success: true,
      imported,
      duplicates,
      errors,
    });
  } catch (error) {
    console.error("[POST /api/products/import]", error);
    return Response.json(
      {
        error: "Failed to import products",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
