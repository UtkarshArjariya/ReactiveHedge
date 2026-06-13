import { ImageResponse } from "next/og";

// Apple touch icon — the Trace motif on Ink, rendered to PNG at request time.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b141b",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 36 24" fill="none">
          <path
            d="M2 12C7 12 10 20 18 20C26 20 29 12 34 12"
            stroke="#4fe0c2"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.5"
          />
          <path
            d="M2 12C7 12 10 4 18 4C26 4 29 12 34 12"
            stroke="#4fe0c2"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="18" cy="12" r="1.7" fill="#4fe0c2" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
