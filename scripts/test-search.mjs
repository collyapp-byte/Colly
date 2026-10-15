import { PrismaClient } from "@prisma/client";
import { searchProducts } from "../lib/tools.ts";

const p = new PrismaClient();

async function main() {
  const biz = await p.business.findFirst({ where: { name: { contains: "ABC" } } });
  if (!biz) { console.error("No ABC business"); process.exit(1); }
  
  const queries = [
    "the big screen wey dey your shop",
    "something for watching football",
    "samsng a15",
    "device for charging phone",
    "abeg how much be that tv",
  ];
  
  for (const q of queries) {
    const r = await searchProducts(biz.id, q);
    console.log(`\nQ: "${q}"`);
    console.log(`  → ${r.map(x => x.name).join(", ") || "(no results)"}`);
  }
  
  process.exit();
}

main().catch(e => { console.error(e); process.exit(1); });
