import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient instance across hot-reloads in development.
// Without this, every file change creates a new client and a new connection
// pool, which quickly exhausts database connections. In production the module
// is evaluated once per server instance, so a single client is already fine.
//
// The `as unknown as` cast is the standard Prisma pattern: `globalThis` has no
// typed `prisma` property, so we assert the shape we stash/read there. It is
// required precisely because dev hot-reload re-evaluates this module; without
// the global the client (and its pool) would be re-instantiated each time.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
