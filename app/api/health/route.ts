import { NextResponse, connection } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health
// Live status of every critical service (database, AI providers, payment and
// embeddings). No auth: ops tooling and load balancers probe this from
// outside. Never throws — always returns 200 with a per-service report.

const TIMEOUT_MS = 5_000;

const AI_PROVIDERS = ["deepseek", "groq", "openrouter"] as const;

type ServiceStatus = "ok" | "down" | "unknown";

type ServiceReport = {
  status: ServiceStatus;
  latencyMs: number;
  error: string | null;
};

const NOT_CONFIGURED: ServiceReport = {
  status: "unknown",
  latencyMs: 0,
  error: "not configured",
};

function latencySince(start: number): number {
  return Math.round(performance.now() - start);
}

function readError(error: unknown, signal?: AbortSignal): string {
  if (signal?.aborted) {
    return `timeout after ${TIMEOUT_MS}ms`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Run `work` and abort it if it doesn't settle within `ms`. */
async function withTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function errorDetail(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  return body.trim() ? `: ${body.slice(0, 200)}` : "";
}

// ---------------------------------------------------------------------------
// Per-service checks
// ---------------------------------------------------------------------------

async function checkDatabase(): Promise<ServiceReport> {
  const start = performance.now();
  try {
    await withTimeout(() => prisma.$queryRaw`SELECT 1`, TIMEOUT_MS);
    return { status: "ok", latencyMs: latencySince(start), error: null };
  } catch (error) {
    return {
      status: "down",
      latencyMs: latencySince(start),
      error: readError(error),
    };
  }
}

async function checkDeepSeek(): Promise<ServiceReport> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NOT_CONFIGURED;
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const start = performance.now();

  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        }),
      TIMEOUT_MS,
    );

    const latencyMs = latencySince(start);

    if (res.status === 402) {
      return { status: "down", latencyMs, error: "Insufficient Balance" };
    }

    if (res.ok) {
      return { status: "ok", latencyMs, error: null };
    }

    return {
      status: "down",
      latencyMs,
      error: `HTTP ${res.status}${await errorDetail(res)}`,
    };
  } catch (error) {
    return {
      status: "down",
      latencyMs: latencySince(start),
      error: readError(error),
    };
  }
}

async function checkGroq(): Promise<ServiceReport> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NOT_CONFIGURED;
  }

  const start = performance.now();

  try {
    const res = await withTimeout(
      (signal) =>
        fetch("https://api.groq.com/openai/v1/models", {
          method: "GET",
          signal,
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
      TIMEOUT_MS,
    );

    const latencyMs = latencySince(start);

    if (res.ok) {
      return { status: "ok", latencyMs, error: null };
    }

    return {
      status: "down",
      latencyMs,
      error: `HTTP ${res.status}${await errorDetail(res)}`,
    };
  } catch (error) {
    return {
      status: "down",
      latencyMs: latencySince(start),
      error: readError(error),
    };
  }
}

async function checkOpenRouter(): Promise<ServiceReport> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NOT_CONFIGURED;
  }

  const start = performance.now();

  try {
    const res = await withTimeout(
      (signal) =>
        fetch("https://openrouter.ai/api/v1/models", {
          method: "GET",
          signal,
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
      TIMEOUT_MS,
    );

    const latencyMs = latencySince(start);

    if (res.ok) {
      return { status: "ok", latencyMs, error: null };
    }

    return {
      status: "down",
      latencyMs,
      error: `HTTP ${res.status}${await errorDetail(res)}`,
    };
  } catch (error) {
    return {
      status: "down",
      latencyMs: latencySince(start),
      error: readError(error),
    };
  }
}

async function checkJina(): Promise<ServiceReport> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    return NOT_CONFIGURED;
  }

  const start = performance.now();

  try {
    const res = await withTimeout(
      (signal) =>
        fetch("https://api.jina.ai/v1/embeddings", {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: ["ping"],
            model: "jina-embeddings-v5-omni-small",
            dimensions: 384,
          }),
        }),
      TIMEOUT_MS,
    );

    const latencyMs = latencySince(start);

    if (res.ok) {
      return { status: "ok", latencyMs, error: null };
    }

    return {
      status: "down",
      latencyMs,
      error: `HTTP ${res.status}${await errorDetail(res)}`,
    };
  } catch (error) {
    return {
      status: "down",
      latencyMs: latencySince(start),
      error: readError(error),
    };
  }
}

async function checkPaystack(): Promise<ServiceReport> {
  const apiKey = process.env.PAYSTACK_SECRET_KEY;
  if (!apiKey) {
    return NOT_CONFIGURED;
  }

  const start = performance.now();

  try {
    const res = await withTimeout(
      (signal) =>
        fetch("https://api.paystack.co/transaction", {
          method: "GET",
          signal,
          headers: { Authorization: `Bearer ${apiKey}` },
        }),
      TIMEOUT_MS,
    );

    const latencyMs = latencySince(start);

    if (res.ok) {
      return { status: "ok", latencyMs, error: null };
    }

    return {
      status: "down",
      latencyMs,
      error: `HTTP ${res.status}${await errorDetail(res)}`,
    };
  } catch (error) {
    return {
      status: "down",
      latencyMs: latencySince(start),
      error: readError(error),
    };
  }
}

const CHECKS: Record<string, () => Promise<ServiceReport>> = {
  database: checkDatabase,
  deepseek: checkDeepSeek,
  groq: checkGroq,
  openrouter: checkOpenRouter,
  jina: checkJina,
  paystack: checkPaystack,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET() {
  await connection();

  const start = performance.now();

  const settled = await Promise.allSettled(
    Object.entries(CHECKS).map(async ([name, check]) => ({
      name,
      report: await check(),
    })),
  );

  const services: Record<string, ServiceReport> = {};
  for (const result of settled) {
    if (result.status === "fulfilled") {
      services[result.value.name] = result.value.report;
    } else {
      // Every check catches internally, so this is defensive only.
      services.database = {
        status: "down",
        latencyMs: 0,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
    }
  }

  const databaseOk = services.database?.status === "ok";
  const aiOk = AI_PROVIDERS.some(
    (name) => services[name]?.status === "ok",
  );

  let status: "ok" | "degraded" | "down";
  if (!databaseOk) {
    status = "down";
  } else if (aiOk) {
    status = "ok";
  } else {
    status = "degraded";
  }

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      durationMs: latencySince(start),
      services,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}