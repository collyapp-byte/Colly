const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "Product" WHERE embedding IS NOT NULL`)
  .then(r => { console.log("Products with embeddings:", r[0].count); process.exit(); })
  .catch(e => { console.error(e.message); process.exit(1); });
