import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  QR_CARD_SUBLINE,
  QR_CARD_TAGLINE,
  QR_CARD_WIDTH,
  qrCardFileName,
} from "../lib/qr-card";

/**
 * The counter card is taped to a shop counter, printed on paper and downloaded
 * as a PNG, so its contents are a contract rather than a design choice:
 *
 * 1. the Colly lockup small, the business's own name big, the QR code, then
 *    "Scan to chat with our AI Assistant" / "Instant replies. Available 24/7.";
 * 2. nothing else - the sitewide footer (navigation columns plus the entity
 *    disclaimer) used to print underneath the card, and the browser's own
 *    date/title/URL header used to print above it;
 * 3. the downloaded PNG is that same card, not a bare QR square, and it is
 *    generated from the one module the screen card also uses, so the two can
 *    never drift apart.
 */

test("the card carries exactly the two lines a customer reads", () => {
  assert.equal(QR_CARD_TAGLINE, "Scan to chat with our AI Assistant");
  assert.equal(QR_CARD_SUBLINE, "Instant replies. Available 24/7.");
});

test("the PNG is wide enough to print sharply", () => {
  assert.equal(QR_CARD_WIDTH, 1080);
});

test("the download file name cannot carry a path", () => {
  assert.equal(qrCardFileName("test-biz-1"), "colly-qr-test-biz-1.png");
  assert.equal(qrCardFileName("../../etc/passwd"), "colly-qr-etc-passwd.png");
  assert.equal(qrCardFileName(""), "colly-qr-card.png");

  for (const id of ["a/b", "..\\..\\windows", "C:\\temp", "  ", ".."]) {
    const name = qrCardFileName(id);
    assert.ok(!name.includes("/"), `${name} must not contain a slash`);
    assert.ok(!name.includes("\\"), `${name} must not contain a backslash`);
    assert.ok(!name.includes(".."), `${name} must not climb directories`);
    assert.ok(name.startsWith("colly-qr-") && name.endsWith(".png"));
  }
});

test("the download draws the whole card, not just the QR square", () => {
  const page = readFileSync(
    new URL("../app/(dashboard)/settings/qr-code/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /drawQrCard\(/, "the PNG must come from drawQrCard()");
  assert.match(page, /QR_CARD_TAGLINE/, "the screen card must use the shared tagline");
  assert.match(page, /QR_CARD_SUBLINE/, "the screen card must use the shared subline");
  assert.match(page, /qrCardFileName\(/, "the download must use the safe file name");
});

test("print hides the site chrome that used to land on the sheet", () => {
  const footer = readFileSync(
    new URL("../components/ui/footer.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    footer,
    /<footer\s+data-print-hide/,
    "the marketing footer must never print under the QR card",
  );

  const widget = readFileSync(
    new URL("../components/dashboard/colly-ai-widget.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    widget,
    /data-print-hide className="fixed bottom-6 right-6/,
    "the floating assistant must not print over the card",
  );

  const css = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  assert.match(
    css,
    /@media print\s*\{[\s\S]*?\[data-print-hide\]\s*\{\s*display: none !important;/,
    "[data-print-hide] must stay hidden in print media",
  );
});
