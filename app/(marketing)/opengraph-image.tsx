import { ImageResponse } from "next/og";

export const alt = "Colly AI - Stop losing sales to missed replies.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(to bottom right, #FF6600, #E65C00)",
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
    { ...size }
  );
}
