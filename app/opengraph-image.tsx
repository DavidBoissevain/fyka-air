import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { LKI_CATEGORIES, LKI_COLORS, LKI_OUTLINE } from "@/lib/air-quality";

// The share preview for every page: the Stroom mark, the question the app
// answers, and the LKI scale with its category names (never colour alone).
export const alt = "Fyka Air: elk uur de luchtkwaliteit in Nederland op de kaart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAD = 80;
const BAR = size.width - 2 * PAD;
const STEP = BAR / LKI_COLORS.length;

// Read at build time, so the image is generated once (static).
const [medium, bold] = await Promise.all(
  [500, 700].map((w) => readFile(join(process.cwd(), `assets/fonts/figtree-latin-${w}.woff`))),
);

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: PAD,
          background: "#EEF1F5",
          color: "#1A1D24",
          fontFamily: "Figtree",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #0284C7, #0369A1)",
            }}
          >
            <svg width="53" height="53" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" />
              <path d="M3 15.5c2-2.4 4-2.4 6 0s4 2.4 6 0" />
              <circle cx="19.5" cy="15.5" r="1.6" fill="white" stroke="none" />
            </svg>
          </div>
          <span style={{ fontSize: 48, fontWeight: 700 }}>Fyka Air</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>
            Hoe schoon is de lucht bij jou?
          </span>
          <span style={{ fontSize: 34, fontWeight: 500, color: "#5A6070" }}>
            Elk uur de luchtkwaliteit in Nederland op de kaart.
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", borderRadius: 999, overflow: "hidden", border: `2px solid ${LKI_OUTLINE.light}` }}>
            {LKI_COLORS.map((c) => (
              <div key={c.bg} style={{ width: STEP, height: 26, background: c.bg }} />
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#5A6070" }}>
            {LKI_CATEGORIES.map((c, i) => (
              <div
                key={c.name}
                style={{
                  width: (c.to - c.from + 1) * STEP,
                  display: "flex",
                  // The last category is one step wide, so its name ends at the bar's end.
                  justifyContent: i === LKI_CATEGORIES.length - 1 ? "flex-end" : "flex-start",
                  whiteSpace: "nowrap",
                }}
              >
                {c.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Figtree", data: medium, weight: 500, style: "normal" },
        { name: "Figtree", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
