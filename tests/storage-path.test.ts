import test from "node:test";
import assert from "node:assert/strict";

import {
  RECEIPTS_BUCKET,
  avatarObjectPath,
  contentTypeForFileName,
  extensionForContentType,
  isPublicStorageUrl,
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

test("avatar keys live under the tenant's own prefix", () => {
  assert.equal(
    avatarObjectPath({
      businessId: "test-biz-1",
      extension: "png",
      unique: "1700000000000-abc",
    }),
    "test-biz-1/avatar/1700000000000-abc.png",
  );

  // A channel-reported type we do not store becomes the safe fallback.
  assert.equal(
    avatarObjectPath({
      businessId: "test-biz-1",
      extension: "exe",
      unique: "1-abc",
    }),
    "test-biz-1/avatar/1-abc.jpg",
  );

  // `..` cannot climb out of that prefix.
  assert.equal(
    avatarObjectPath({
      businessId: "test-biz-1",
      extension: "jpg",
      unique: "../../other-tenant/avatar",
    }),
    "test-biz-1/avatar/other-tenant/avatar.jpg",
  );
});

test("only this project's public Storage URLs are accepted", () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abcdefgh.supabase.co";

  try {
    // The shape `uploadFileToSupabase()` appears to the browser as.
    assert.equal(
      isPublicStorageUrl(
        "https://abcdefgh.supabase.co/storage/v1/object/public/receipts/test-biz-1/555/1-a.jpg",
      ),
      true,
    );
    assert.equal(
      isPublicStorageUrl(
        "https://ABCDEFGH.supabase.co/storage/v1/object/public/product-images/test-biz-1/avatar/1-a.png",
      ),
      true,
    );

    const rejected = [
      // Another host: a validated URL must never become an SSRF proxy.
      "https://evil.example.com/storage/v1/object/public/receipts/a.jpg",
      // Plain http, credentials, and a non-443 port are classic bypasses.
      "http://abcdefgh.supabase.co/storage/v1/object/public/receipts/a.jpg",
      "https://user:pass@abcdefgh.supabase.co/storage/v1/object/public/receipts/a.jpg",
      "https://abcdefgh.supabase.co:8443/storage/v1/object/public/receipts/a.jpg",
      // Signed/internal URLs are not public objects.
      "https://abcdefgh.supabase.co/storage/v1/object/sign/receipts/a.jpg",
      "https://abcdefgh.supabase.co/storage/v1/object/authenticated/receipts/a.jpg",
      // Non-https schemes and malformed input.
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "//abcdefgh.supabase.co/storage/v1/object/public/receipts/a.jpg",
      "not a url",
      "",
    ];

    for (const value of rejected) {
      assert.equal(isPublicStorageUrl(value), false, `should reject: ${value}`);
    }
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  }
});

test("without a configured project no Storage URL is trusted", () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    assert.equal(
      isPublicStorageUrl(
        "https://abcdefgh.supabase.co/storage/v1/object/public/receipts/a.jpg",
      ),
      false,
    );
  } finally {
    if (previous !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  }
});
