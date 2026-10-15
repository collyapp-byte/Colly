import { getCurrentBusinessId } from "@/lib/auth";
import { transcribeAudioFromBuffer } from "@/lib/stt";

const MAX_AUDIO_SIZE = 3 * 1024 * 1024; // 3 MB

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function payloadTooLarge() {
  return Response.json({ error: "Audio too large (max 3 MB)" }, { status: 413 });
}

function internalError(message: string) {
  return Response.json({ error: message }, { status: 500 });
}

// POST /api/voice/transcribe-description
// Body: multipart/form-data with `audio` file.
// Returns { transcript: string }.
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const formData = await request.formData();
    const file = formData.get("audio");

    if (!(file instanceof File)) {
      return badRequest("Missing audio file");
    }

    if (file.size > MAX_AUDIO_SIZE) {
      return payloadTooLarge();
    }

    const mimeType = file.type || "audio/webm";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await transcribeAudioFromBuffer(buffer, mimeType);

    return Response.json({ transcript: result.text });
  } catch (error) {
    console.error("[POST /api/voice/transcribe-description]", error);
    return internalError(
      error instanceof Error ? error.message : "Transcription failed",
    );
  }
}