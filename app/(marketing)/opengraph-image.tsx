import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

export const alt = "Colly AI - Stop losing sales to missed replies.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Force Next.js to generate this ONCE at build time and serve it statically.
// This prevents runtime OOM crashes on Pxxl.
export const dynamic = "force-static";
export const revalidate = false;

export default async function Image() {
  // Read the font directly from the filesystem at build time
  const fontPath = path.join(process.cwd(), "app/(marketing)/Inter-Bold.ttf");
  const fontData = await readFile(fontPath);

  return new ImageResponse(
    (
      <div
        style={{
          // Solid color instead of gradient to save memory
          background: "#FF6600", 
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "40px" }}>
          <div style={{ width: "80px", height: "80px", background: "white", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "40px", fontWeight: "bold", color: "#FF6600" }}>C</span>
          </div>
          <span style={{ fontSize: "48px", fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>Colly</span>
        </div>
        <h1 style={{ fontSize: "72px", fontWeight: 800, color: "white", textAlign: "center", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          Stop losing sales to missed replies.
        </h1>
        <p style={{ fontSize: "32px", color: "rgba(255,255,255,0.9)", marginTop: "30px", textAlign: "center" }}>
          The AI sales assistant for Nigerian businesses.
        </p>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          style: "normal",
          weight: 800,
        },
      ],
    }
  );
}
