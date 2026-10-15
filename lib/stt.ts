// Speech-to-text via Groq's free Whisper endpoint (OpenAI-compatible).
//
// Groq exposes `POST /openai/v1/audio/transcriptions` and accepts a
// multipart/form-data body with `file`, `model` and `response_format`. We ask
// for `verbose_json` so the language and duration come back with the text.
// Node 18+ ships `fetch`, `FormData` and `Blob` globally, so there is no SDK to
// install.

const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

// WhatsApp voice notes are Ogg/Opus. Other formats are mapped so the filename
// we send Groq carries a sensible extension.
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
};

// Keep the transcript verbatim: the AI chat pipeline downstream understands
// Nigerian Pidgin, so normalising it to English would lose meaning.
const STT_PROMPT =
  "Transcribe this Nigerian Pidgin or English audio verbatim. Do not standardize Pidgin words like 'dey', 'na', 'wey', 'abeg', 'sabi' into English. Preserve the speaker's actual words.";

type GroqVerboseJson = {
  text?: unknown;
  language?: unknown;
  duration?: unknown;
};

export type Transcription = {
  text: string;
  language: string;
  duration: number;
};

/**
 * Downloads an audio file and transcribes it with Groq Whisper.
 *
 * Throws a descriptive error when the API key is missing, the download fails,
 * Groq rejects the request, or the response is not a usable transcript, so the
 * caller can surface the reason instead of a generic failure.
 */
export async function transcribeAudio(
  audioUrl: string,
): Promise<Transcription> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to your .env file to enable voice notes.",
    );
  }

  const audio = await downloadAudio(audioUrl);

  const formData = new FormData();
  // A Blob with a filename is what makes fetch emit a multipart file part.
  formData.append("file", new Blob([audio.bytes], { type: audio.contentType }), audio.filename);
  formData.append("model", GROQ_WHISPER_MODEL);
  formData.append("response_format", "verbose_json");
  formData.append("prompt", STT_PROMPT);

  let response: Response;
  try {
    response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
  } catch (error) {
    throw new Error(
      `Could not reach Groq for transcription: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Groq transcription failed (${response.status} ${response.statusText})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }

  const data = (await response.json()) as GroqVerboseJson;

  if (typeof data.text !== "string" || data.text.trim().length === 0) {
    throw new Error("Groq returned an empty transcript.");
  }

  return {
    text: data.text.trim(),
    language: typeof data.language === "string" ? data.language : "unknown",
    duration:
      typeof data.duration === "number" && Number.isFinite(data.duration)
        ? data.duration
        : 0,
  };
}

/**
 * Transcribes an audio Buffer directly with Groq Whisper.
 *
 * Accepts raw audio bytes and a MIME type (e.g. "audio/webm"), so callers can
 * pipe MediaRecorder chunks straight in without writing a temp file or hosting
 * the audio publicly first. The same prompt and model as `transcribeAudio` are
 * used so Nigerian Pidgin handling is consistent.
 */
export async function transcribeAudioFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<Transcription> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to your .env file to enable voice notes.",
    );
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[mimeType] ?? "webm";
  const filename = `voice-note.${extension}`;

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  formData.append("model", GROQ_WHISPER_MODEL);
  formData.append("response_format", "verbose_json");
  formData.append("prompt", STT_PROMPT);

  let response: Response;
  try {
    response = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
  } catch (error) {
    throw new Error(
      `Could not reach Groq for transcription: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Groq transcription failed (${response.status} ${response.statusText})${
        detail ? `: ${detail}` : ""
      }`,
    );
  }

  const data = (await response.json()) as GroqVerboseJson;

  if (typeof data.text !== "string" || data.text.trim().length === 0) {
    throw new Error("Groq returned an empty transcript.");
  }

  return {
    text: data.text.trim(),
    language: typeof data.language === "string" ? data.language : "unknown",
    duration:
      typeof data.duration === "number" && Number.isFinite(data.duration)
        ? data.duration
        : 0,
  };
}

/** Fetches the audio into memory and picks a filename to upload it under. */
async function downloadAudio(audioUrl: string): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
}> {
  let response: Response;
  try {
    response = await fetch(audioUrl);
  } catch (error) {
    throw new Error(
      `Could not download audio from ${audioUrl}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Could not download audio from ${audioUrl} (${response.status} ${response.statusText}).`,
    );
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) {
    throw new Error(`Downloaded audio from ${audioUrl} is empty.`);
  }

  const headerType = response.headers.get("content-type") ?? "";
  const contentType = headerType.split(";")[0].trim() || "audio/ogg";
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "ogg";

  return { bytes, contentType, filename: `voice-note.${extension}` };
}
