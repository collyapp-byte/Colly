// Manual smoke test for the Groq image recognition pipeline.
//
// Usage:
//   npx tsx scripts/test-vision.cjs "<image-url>"
//
// The library lives in TypeScript ESM, so it is pulled in with a dynamic
// import() (which tsx transpiles on the fly) rather than require().

// tsx does not load .env files on its own, so bring the same variables the app
// uses into process.env before importing the library (which reads
// process.env.GROQ_API_KEY). Existing variables are never overridden.
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

async function main() {
  const imageUrl = process.argv[2];

  if (!imageUrl) {
    console.error("Usage: npx tsx scripts/test-vision.cjs \"<image-url>\"");
    process.exit(1);
  }

  const { describeImage } = await import("../lib/vision.ts");

  console.log(`Describing image: ${imageUrl}\n`);

  try {
    const result = await describeImage(imageUrl);

    console.log("Result:");
    console.log({
      description: result.description,
      isProduct: result.isProduct,
    });
  } catch (error) {
    console.error("Image description failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Unexpected error:");
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
