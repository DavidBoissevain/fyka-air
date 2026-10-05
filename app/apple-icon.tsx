import { ImageResponse } from "next/og";

// The Stroom mark full-bleed; iOS rounds the corners itself.
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
          background: "linear-gradient(135deg, #0284C7, #0369A1)",
        }}
      >
        <svg
          width="108"
          height="108"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" />
          <path d="M3 15.5c2-2.4 4-2.4 6 0s4 2.4 6 0" />
          <circle cx="19.5" cy="15.5" r="1.6" fill="white" stroke="none" />
        </svg>
      </div>
    ),
    size,
  );
}
