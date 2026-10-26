import test from "node:test";
import assert from "node:assert/strict";

import {
  LIST_PAGE_SIZE,
  cursorDate,
  decodeCursor,
  encodeCursor,
  readPageSize,
} from "../lib/pagination";

test("page size defaults, accepts a limit and is clamped", () => {
  const none = new URLSearchParams();
  assert.equal(readPageSize(none), LIST_PAGE_SIZE);

  assert.equal(readPageSize(new URLSearchParams("limit=10")), 10);
  assert.equal(readPageSize(new URLSearchParams("limit=1000")), 100);
  assert.equal(readPageSize(new URLSearchParams("limit=0")), LIST_PAGE_SIZE);
  assert.equal(readPageSize(new URLSearchParams("limit=-5")), LIST_PAGE_SIZE);
  assert.equal(readPageSize(new URLSearchParams("limit=abc")), LIST_PAGE_SIZE);
});

test("a cursor round-trips dates, strings and numbers", () => {
  const at = new Date("2026-10-26T12:34:56.789Z");
  const encoded = encodeCursor({ createdAt: at, id: "clx123" });
  assert.equal(typeof encoded, "string");
  assert.equal(encoded.includes("="), false, "base64url has no padding");

  const decoded = decodeCursor(encoded);
  assert.ok(decoded);
  assert.equal(decoded.id, "clx123");
  assert.equal(cursorDate(decoded, "createdAt")?.toISOString(), at.toISOString());
});

test("garbage cursors are rejected instead of throwing", () => {
  assert.equal(decodeCursor(null), null);
  assert.equal(decodeCursor(""), null);
  assert.equal(decodeCursor("not-base64-json"), null);

  const arrayCursor = Buffer.from(JSON.stringify([1, 2]), "utf8").toString(
    "base64url",
  );
  assert.equal(decodeCursor(arrayCursor), null);

  const emptyCursor = Buffer.from(JSON.stringify({}), "utf8").toString(
    "base64url",
  );
  assert.equal(decodeCursor(emptyCursor), null);

  assert.equal(cursorDate(decodeCursor("nonsense"), "createdAt"), null);
  assert.equal(cursorDate({ createdAt: "not-a-date" }, "createdAt"), null);
});
