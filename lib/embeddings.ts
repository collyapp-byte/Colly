// Text embeddings via the Jina AI Embeddings API.
//
// We use `jina-embeddings-v3` at its native 1024 dimensions: a
// multilingual model that handles English and Nigerian Pidgin-style phrasing
// well, and has a permanent free tier (1M tokens/month, no card required).
// Embeddings let search match on meaning ("the big screen wey dey your shop")
// instead of exact keywords.

/** The model we embed with. */
const MODEL = "jina-embeddings-v3";

/** Jina AI's OpenAI-style embeddings endpoint. */
const API_URL = "https://api.jina.ai/v1/embeddings";

/**
 * The vector width we request. Jina's model outputs 1024 natively; we ask for
 * 1024 to match `vector(1024)` in the Prisma schema — a mismatch would make
 * pgvector reject every insert.
 */
export const EMBEDDING_DIMENSIONS = 1024;

/**
 * Pull the embedding out of Jina's response shape:
 * `{ data: [{ embedding: [1024 floats], index: 0 }], usage: { ... } }`.
 *
 * Returns null when the payload isn't a usable vector.
 */
function extractVector(payload: unknown): number[] | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const first = data[0];
  if (!first || typeof first !== "object") {
    return null;
  }

  const embedding = (first as { embedding?: unknown }).embedding;
  if (!Array.isArray(embedding) || typeof embedding[0] !== "number") {
    return null;
  }

  return embedding as number[];
}

/**
 * Embed a single string into an `EMBEDDING_DIMENSIONS`-long vector.
 *
 * `task` selects Jina's task-specific adapter: index passages with
 * "retrieval.passage" (the default) and search with "retrieval.query", so a
 * query is embedded to the same space as the passages it should match.
 *
 * Throws a clear error when the API key is missing, the request fails, or the
 * response is not a usable vector, so callers can fall back to keyword search.
 */
export async function embedText(
  text: string,
  task: "retrieval.query" | "retrieval.passage" = "retrieval.passage",
): Promise<number[]> {
  const input = text.trim();

  if (!input) {
    throw new Error("Cannot embed empty text");
  }

  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "JINA_API_KEY is not set. Add it to your .env file to enable semantic search.",
    );
  }

  let response: Response;

  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [input],
        dimensions: EMBEDDING_DIMENSIONS,
        task,
      }),
    });
  } catch (error) {
    throw new Error(
      `Failed to reach the Jina embeddings API: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");

    if (response.status === 401) {
      throw new Error(
        "Jina embeddings API rejected the API key (401 Unauthorized). Check JINA_API_KEY.",
      );
    }

    // A 404 from the endpoint usually means the model name or URL is wrong,
    // not a transient failure — surface a clearer message than the raw status.
    if (response.status === 404) {
      throw new Error(
        "Embedding model unavailable — check the Jina endpoint URL and model name.",
      );
    }

    throw new Error(
      `Jina embeddings API returned ${response.status} ${
        response.statusText
      }${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }

  const payload: unknown = await response.json();
  const vector = extractVector(payload);

  if (!vector) {
    throw new Error(
      "Jina embeddings API returned an unexpected response (no vector).",
    );
  }

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding has ${vector.length} dimensions, expected ${EMBEDDING_DIMENSIONS}.`,
    );
  }

  return vector;
}

/**
 * Format a vector for pgvector: `[0.1,0.2,...]`.
 *
 * Passed as a bound parameter and cast with `::vector` in raw SQL, so we never
 * build SQL by string-concatenating user/embedding data.
 */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
