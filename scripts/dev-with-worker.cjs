/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * `npm run dev:all` — the Next dev server plus the standalone WhatsApp worker.
 *
 * WHY THIS SCRIPT EXISTS
 * `next dev` never starts the worker (see `workers/whatsapp-worker.ts`): a
 * Baileys socket is long-lived and stateful, so it lives outside a request
 * scope. That also means pressing "Connect WhatsApp" with no worker running
 * writes `WhatsAppSession.status = CONNECTING` and nothing ever turns it into a
 * QR — which is exactly what a forever-spinning "Starting" screen looks like.
 *
 * `npm run dev` is unchanged and stays the fast path for everything that is not
 * WhatsApp. This one runs both, with prefixed output and a single Ctrl+C.
 *
 * No new dependency: `next` and `tsx` are already installed, and the two
 * binaries are spawned through the same `node` that runs this file, so it works
 * on Windows (where `npm.cmd` re-parsing turns a quoted path into extra args).
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");

const targets = [
  {
    label: "web",
    bin: path.join(root, "node_modules", "next", "dist", "bin", "next"),
    args: ["dev"],
  },
  {
    label: "whatsapp",
    bin: path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
    args: [path.join("workers", "whatsapp-worker.ts")],
  },
];

const children = [];
let shuttingDown = false;

/** Prefix every line so two interleaved streams stay readable. */
function prefixed(label, stream, chunk) {
  const text = String(chunk);
  const lines = text.split(/\r?\n/);
  const tail = lines.pop();

  for (const line of lines) {
    stream.write(`[${label}] ${line}\n`);
  }

  // A partial line waits for the rest of it.
  if (tail) stream.write(`[${label}] ${tail}`);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill();
      } catch {
        // Already gone; nothing to do.
      }
    }
  }

  // Give the worker's SIGTERM handler a moment to close its sockets.
  setTimeout(() => process.exit(code), 1_000).unref();
}

for (const target of targets) {
  const child = spawn(process.execPath, [target.bin, ...target.args], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.push(child);

  child.stdout.on("data", (chunk) =>
    prefixed(target.label, process.stdout, chunk),
  );
  child.stderr.on("data", (chunk) =>
    prefixed(target.label, process.stderr, chunk),
  );

  child.on("error", (error) => {
    console.error(`[${target.label}] could not start:`, error.message);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    // One process dying takes the pair down: a dev server without the worker
    // is the bug this script exists to prevent.
    console.error(
      `[${target.label}] exited (${signal ?? code ?? "unknown"}); stopping the other process`,
    );
    shutdown(typeof code === "number" && code !== 0 ? code : 1);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.info(
  "[dev:all] Next dev + WhatsApp worker. Ctrl+C stops both. WhatsApp pairing is",
);
console.info(
  "[dev:all] only available while the worker is alive; the dashboard says so",
);
console.info("[dev:all] after 45 seconds without a QR.");
