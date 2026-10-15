// Manual smoke test for the Groq speech-to-text pipeline.
//
// Usage:
//   npx tsx scripts/test-stt.cjs "<audio-url>"
//
// The library lives in TypeScript ESM, so it is pulled in with a dynamic
// import() (which tsx transpiles on the fly) rather than require().

// tsx does not load .env files on its own, so bring the same variables the app
// uses into process.env before importing the library (which reads
// process.env.GROQ_API_KEY). Existing variables are never overridden.
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

async function main() {
  const audioUrl = process.argv[2];

  if (!audioUrl) {
    console.error("Usage: npx tsx scripts/test-stt.cjs \"<audio-url>\"");
    process.exit(1);
  }

  const { transcribeAudio } = await import("../lib/stt.ts");

  console.log(`Transcribing: ${audioUrl}\n`);

  try {
    const result = await transcribeAudio(audioUrl);

    console.log("Result:");
    console.log({
      text: result.text,
      language: result.language,
      duration: result.duration,
    });
  } catch (error) {
    console.error("Transcription failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unexpected error:");
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
