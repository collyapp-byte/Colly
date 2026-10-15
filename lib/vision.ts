// Vision service using Groq's vision model for image description.
//
// POSTs to the OpenAI-compatible chat completions endpoint with a system prompt
// (product identifier for Nigerian retail) and a user message that includes both
// a text instruction and the image URL. Returns a short description and a flag
// indicating whether the image is a product or not.

const GROQ_VISION_URL = "https://api.groq.com/openai/v1/chat/completions";

const GROQ_VISION_MODEL = "qwen/qwen3.8-27b";

const SYSTEM_PROMPT =
  "You are a visual product identifier for a Nigerian retail shop. Describe what is in the image in one short sentence. Focus on: product type, colour, approximate size if obvious, and distinctive features. Do NOT invent specs. If the image is clearly not a product (e.g. a selfie, a document, a logo), reply with exactly: 'Not a product image.' Otherwise reply with just the description, under 25 words, plain text only, no markdown, no asterisks, no bullet points.";

type GroqChatCompletion = {
  choices: Array<{
    message: {
      content?: string | null;
    };
  }>;
};

type DescribeImageResponse = {
  description: string;
  isProduct: boolean;
};

/**
 * Sends an image to Groq's vision model and returns a short description.
 *
 * Throws a descriptive error when the API key is missing, the download of the
 * image fails, Groq rejects the request, or the response is not usable.
 */
export async function describeImage(
  imageUrl: string,
): Promise<DescribeImageResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to your .env file to enable image recognition.",
    );
  }

  const body: {
    model: string;
    messages: Array<{
      role: "system" | "user";
      content:
        | string
        | Array<{
            type: "text" | "image_url";
            text?: string;
            image_url?: { url: string };
          }>;
    }>;
  } = {
    model: GROQ_VISION_MODEL,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this image." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  };

  let response: Response;
  try {
    response = await fetch(GROQ_VISION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Could not reach Groq for image description: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Groq image description failed (${response.status} ${response.statusText})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }

  const data = (await response.json()) as GroqChatCompletion;

  const content =
    data.choices[0]?.message?.content ?? data.choices[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Groq returned an empty description.");
  }

  const description = content.trim();
  const isProduct = !description.startsWith("Not a product image");

  return { description, isProduct };
}