/**
 * The in-store QR card, as pixels.
 *
 * `/settings/qr-code` shows this card on screen, prints it (the browser turns
 * the same markup into paper) and downloads it as a PNG. The PNG is drawn here
 * instead of screenshotting the DOM for two reasons: `canvas.toDataURL()` is the
 * only dependency-free way to save an image, and hand-drawing keeps the file
 * identical at any scale, so a card printed at 90mm and the downloaded 1080px
 * PNG carry exactly the same words.
 *
 * What belongs on a sheet taped to a counter: the Colly lockup small, the
 * business's own name big, the QR code, and the two lines a customer reads.
 * Nothing else. The marketing footer, the site navigation and the entity
 * disclaimer are website furniture; the dashboard layout hides them when this
 * page prints (see `[data-print-hide]` in app/globals.css), and they are not
 * drawn here either.
 */

/** Width of the generated PNG in pixels; tall enough to stay crisp in print. */
export const QR_CARD_WIDTH = 1080;

/** The two lines under the QR code, shared by the screen card and the PNG. */
export const QR_CARD_TAGLINE = "Scan to chat with our AI Assistant";
export const QR_CARD_SUBLINE = "Instant replies. Available 24/7.";

const PADDING = 96;
const RADIUS = 64;
const BORDER = 4;

const LOGO_SIZE = 64;
const LOGO_GAP = 18;
const WORDMARK = "Colly";
const WORDMARK_SIZE = 44;

const NAME_MAX_SIZE = 88;
const NAME_MIN_SIZE = 52;
const NAME_MAX_LINES = 3;
const NAME_LINE_HEIGHT = 1.18;
const NAME_GAP = 48;

const QR_SIZE = 660;
const QR_GAP = 64;

const TAGLINE_SIZE = 46;
const TAGLINE_MIN_SIZE = 34;
const SUBLINE_SIZE = 34;
const TAGLINE_GAP = 16;

const INK = "#111827";
const MUTED = "#6b7280";
const PAPER = "#ffffff";
const BORDER_COLOR = "#e5e7eb";

const SANS =
  '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const DISPLAY = '"Arial Black", Impact, sans-serif';

export type QrCardInput = {
  /** The business's own name — the headline of the card. */
  businessName: string;
  /** The rendered QR canvas (`qrcode.react`), used at its intrinsic size. */
  qr: HTMLCanvasElement;
  /** The Colly mark; drawn only once it has loaded. */
  logo?: HTMLImageElement | null;
};

/**
 * File name for the download. Anything that is not a plain word character is
 * collapsed, so a business id can never introduce a path separator.
 */
export function qrCardFileName(businessId: string): string {
  const safe = businessId
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  return `colly-qr-${safe || "card"}.png`;
}

/** Rounded-rectangle path, for browsers without `ctx.roundRect`. */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Greedy word wrap against the current font. */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/** Drops the overflow and ends the last kept line with an ellipsis. */
function clampLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxLines: number,
  maxWidth: number,
): string[] {
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1).trimEnd();
  }
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/**
 * Picks the largest type size that fits the name in at most three lines, so a
 * long shop name stays big instead of spilling over the QR code.
 */
function fitBusinessName(
  ctx: CanvasRenderingContext2D,
  rawName: string,
  maxWidth: number,
): { size: number; lines: string[] } {
  const name = rawName.trim() || "Our store";

  for (let size = NAME_MAX_SIZE; size >= NAME_MIN_SIZE; size -= 4) {
    ctx.font = `700 ${size}px ${SANS}`;
    const lines = wrapLines(ctx, name, maxWidth);
    if (lines.length <= NAME_MAX_LINES) return { size, lines };
  }

  ctx.font = `700 ${NAME_MIN_SIZE}px ${SANS}`;
  return {
    size: NAME_MIN_SIZE,
    lines: clampLines(
      ctx,
      wrapLines(ctx, name, maxWidth),
      NAME_MAX_LINES,
      maxWidth,
    ),
  };
}

/** Shrinks a single line of text until it fits, then returns the size used. */
function fitSingleLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  family: string,
  maxSize: number,
  minSize: number,
): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

/**
 * Draws the whole card on a fresh canvas and returns it. The corners stay
 * transparent, so the saved PNG is the rounded white box itself and can be
 * dropped onto any background.
 */
export function drawQrCard({
  businessName,
  qr,
  logo,
}: QrCardInput): HTMLCanvasElement {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas is not available in this browser");

  const contentWidth = QR_CARD_WIDTH - PADDING * 2;

  const name = fitBusinessName(measure, businessName, contentWidth);
  const nameLineHeight = Math.round(name.size * NAME_LINE_HEIGHT);
  const nameHeight = name.lines.length * nameLineHeight;
  const taglineSize = fitSingleLine(
    measure,
    QR_CARD_TAGLINE,
    contentWidth,
    700,
    SANS,
    TAGLINE_SIZE,
    TAGLINE_MIN_SIZE,
  );
  const sublineSize = fitSingleLine(
    measure,
    QR_CARD_SUBLINE,
    contentWidth,
    400,
    SANS,
    SUBLINE_SIZE,
    24,
  );

  const height = Math.round(
    PADDING +
      LOGO_SIZE +
      NAME_GAP +
      nameHeight +
      QR_GAP +
      QR_SIZE +
      QR_GAP +
      taglineSize +
      TAGLINE_GAP +
      sublineSize +
      PADDING,
  );

  const canvas = document.createElement("canvas");
  canvas.width = QR_CARD_WIDTH;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");

  // The card body: white with a hairline border, rounded, transparent corners.
  roundedRectPath(
    ctx,
    BORDER / 2,
    BORDER / 2,
    canvas.width - BORDER,
    height - BORDER,
    RADIUS,
  );
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = BORDER;
  ctx.strokeStyle = BORDER_COLOR;
  ctx.stroke();

  // 1. The brand lockup, small, centred at the top.
  let y = PADDING;
  ctx.font = `700 ${WORDMARK_SIZE}px ${DISPLAY}`;
  const wordmarkWidth = ctx.measureText(WORDMARK).width;
  const lockupWidth = (logo ? LOGO_SIZE + LOGO_GAP : 0) + wordmarkWidth;
  const lockupX = (QR_CARD_WIDTH - lockupWidth) / 2;

  if (logo) ctx.drawImage(logo, lockupX, y, LOGO_SIZE, LOGO_SIZE);

  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    WORDMARK,
    lockupX + (logo ? LOGO_SIZE + LOGO_GAP : 0),
    y + LOGO_SIZE / 2 + 2,
  );

  // 2. The business's own name, big.
  y += LOGO_SIZE + NAME_GAP;
  ctx.font = `700 ${name.size}px ${SANS}`;
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  name.lines.forEach((line, index) => {
    ctx.fillText(
      line,
      QR_CARD_WIDTH / 2,
      y + index * nameLineHeight + (nameLineHeight - name.size) / 2,
    );
  });

  // 3. The QR code, straight off the rendered canvas.
  y += nameHeight + QR_GAP;
  ctx.drawImage(qr, (QR_CARD_WIDTH - QR_SIZE) / 2, y, QR_SIZE, QR_SIZE);

  // 4. What the customer is meant to do.
  y += QR_SIZE + QR_GAP;
  ctx.font = `700 ${taglineSize}px ${SANS}`;
  ctx.fillStyle = INK;
  ctx.fillText(QR_CARD_TAGLINE, QR_CARD_WIDTH / 2, y);

  y += taglineSize + TAGLINE_GAP;
  ctx.font = `400 ${sublineSize}px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(QR_CARD_SUBLINE, QR_CARD_WIDTH / 2, y);

  return canvas;
}
