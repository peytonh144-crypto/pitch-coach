import { ImageResponse } from "next/og";

export const alt = "Pitch Coach — AI practice for storm restoration reps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "radial-gradient(ellipse at top left, #1a1a1a 0%, #0a0a0a 60%)",
          padding: "80px",
          color: "#ededed",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "48px",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="48"
            height="48"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
              fill="#FF6B35"
              stroke="#FF6B35"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
          <div
            style={{
              fontSize: "36px",
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Pitch Coach
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "76px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: "#fafafa",
            marginBottom: "32px",
          }}
        >
          AI practice for storm restoration reps
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "32px",
            color: "#a1a1aa",
            lineHeight: 1.4,
            maxWidth: "900px",
          }}
        >
          Run 100 fake doors before your next real one.
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "24px",
            color: "#FF6B35",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              background: "#FF6B35",
              borderRadius: "9999px",
            }}
          />
          Practice · Coach · Grade
        </div>
      </div>
    ),
    size,
  );
}
