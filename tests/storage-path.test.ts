import test from "node:test";
import assert from "node:assert/strict";

import {
  RECEIPTS_BUCKET,
  contentTypeForFileName,
  extensionForContentType,
  receiptObjectPath,
  sanitizeStoragePath,
} from "../lib/supabase/storage-path";

test("the receipts bucket is the one the Telegram webhook uploads to", () => {
  assert.equal(RECEIPTS_BUCKET, "receipts");
});

test("a Telegram content type becomes a safe file extension", () => {
  assert.equal(extensionForContentType("image/jpeg"), "jpg");
  assert.equal(extensionForContentType("image/PNG"), "png");
  assert.equal(extensionForContentType("image/png; charset=binary"), "png");
  assert.equal(extensionForContentType("image/heic"), "heic");
  // Anything that is not a known image falls back to jpg rather than leaking a
  // type into the object key.
  assert.equal(extensionForContentType("application/octet-stream"), "jpg");
  assert.equal(extensionForContentType("../../etc/passwd"), "jpg");
});

test("a stored key maps back to its MIME type", () => {
  assert.equal(contentTypeForFileName("test-biz-1/555/17-x.jpg"), "image/jpeg");
  assert.equal(contentTypeForFileName("test-biz-1/555/17-x.JPEG"), "image/jpeg");
  assert.equal(contentTypeForFileName("test-biz-1/555/17-x.webp"), "image/webp");
  assert.equal(
    contentTypeForFileName("test-biz-1/555/17-x"),
    "application/octet-stream",
  );
});

test("object keys cannot escape their tenant prefix", () => {
  assert.equal(
    sanitizeStoragePath("biz/chat/../../etc/passwd"),
    "biz/chat/etc/passwd",
  );
  assert.equal(sanitizeStoragePath("/biz//chat/"), "biz/chat");
  assert.equal(
    sanitizeStoragePath("biz\\chat\\a name!.jpg"),
    "biz/chat/a-name-.jpg",
  );
  assert.throws(() => sanitizeStoragePath(""));
  assert.throws(() => sanitizeStoragePath(".."));
  assert.throws(() => sanitizeStoragePath("../.."));
  assert.throws(() => sanitizeStoragePath("a".repeat(600)));
});

test("receipt keys are namespaced by business and chat", () => {
  assert.equal(
    receiptObjectPath({
      businessId: "test-biz-1",
      chatKey: "5551234",
      extension: "jpeg",
      unique: "1700000000000-abc",
    }),
    "test-biz-1/5551234/1700000000000-abc.jpeg",
  );

  // An unknown extension is replaced, never appended verbatim.
  assert.equal(
    receiptObjectPath({
      businessId: "test-biz-1",
      chatKey: "5551234",
      extension: "exe",
      unique: "1-abc",
    }),
    "test-biz-1/5551234/1-abc.jpg",
  );
});
