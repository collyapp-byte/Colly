-- QA Audit V2 (High priority): performance indexes, plus a denormalised
-- "Conversation"."lastMessageAt" so the inbox is ordered and paginated by
-- Postgres instead of loading every row and sorting it in memory.
--
-- Index names are mapped explicitly in prisma/schema.prisma (`, map: "..."`), so
-- the schema and this migration agree and a future `prisma migrate dev` sees no
-- drift.

-- Product-name fuzzy search. lib/tools.ts `trigramSearchProducts()` calls
-- similarity("name", $1), a pg_trgm function, but no migration ever created the
-- extension: the query threw, was caught, and silently degraded to a non-indexed
-- ILIKE scan (no typo tolerance, no index).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "product_name_trgm_idx"
    ON "Product" USING gin ("name" gin_trgm_ops);

-- Denormalised activity stamp for the conversation list. Existing rows are
-- backfilled from their newest message; a conversation with no messages keeps
-- its creation-time default.
ALTER TABLE "Conversation"
    ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Conversation" AS c
SET "lastMessageAt" = COALESCE(
        (SELECT MAX(m."createdAt") FROM "Message" AS m WHERE m."conversationId" = c."id"),
        c."lastMessageAt"
    );

-- Inbox page: WHERE "businessId" = ? ORDER BY "lastMessageAt" DESC.
CREATE INDEX IF NOT EXISTS "conversation_business_last_message_idx"
    ON "Conversation" ("businessId", "lastMessageAt");

-- Keep "Conversation"."lastMessageAt" in sync with the newest message for EVERY
-- insert path (chat engine, voice/image pipelines, manual agent replies, seeds,
-- scripts) with no application round-trip. A trigger rather than app code so a
-- new writer cannot forget the stamp; it deliberately does not touch
-- "updatedAt", which the Telegram 24h takeover clock measures against.
CREATE OR REPLACE FUNCTION "colly_touch_conversation_activity"()
RETURNS trigger AS $$
BEGIN
    UPDATE "Conversation"
       SET "lastMessageAt" = NEW."createdAt"
     WHERE "id" = NEW."conversationId"
       AND "lastMessageAt" < NEW."createdAt";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "message_touch_conversation_activity" ON "Message";

CREATE TRIGGER "message_touch_conversation_activity"
    AFTER INSERT ON "Message"
    FOR EACH ROW
    EXECUTE FUNCTION "colly_touch_conversation_activity"();

-- Chat history: WHERE "conversationId" = ? ORDER BY "createdAt" DESC.
CREATE INDEX IF NOT EXISTS "message_conversation_created_idx"
    ON "Message" ("conversationId", "createdAt");

-- Usage rollups: WHERE "businessId" = ? AND "sender" = ? AND "createdAt" >= ?.
CREATE INDEX IF NOT EXISTS "message_business_sender_created_idx"
    ON "Message" ("businessId", "sender", "createdAt");
