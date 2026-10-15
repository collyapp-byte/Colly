import { requireAuth } from "@/lib/auth";
import { transcribeAudio } from "@/lib/stt";

type VoiceTestRequestBody = {
  audioUrl?: unknown;
};

// POST /api/voice/test
// Body: { audioUrl: string }
// Requires a signed-in owner. Transcribes the given audio with Groq Whisper and
// returns { text, language, duration }. Intended as a manual sanity check for
// the speech-to-text pipeline.
export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = (await request.json()) as VoiceTestRequestBody;

    if (typeof body.audioUrl !== "string" || body.audioUrl.length === 0) {
      return Response.json({ error: "audioUrl is required" }, { status: 400 });
    }

    const transcription = await transcribeAudio(body.audioUrl);

    return Response.json(transcription);
  } catch (error) {
    console.error("[POST /api/voice/test]", error);
    return Response.json(
      {
        error: "Failed to transcribe audio",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
