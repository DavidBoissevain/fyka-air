import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { LKI_CATEGORIES, LKI_COLORS } from "@/lib/air-quality";

// The share preview for every page: the Stroom mark, the question the app
// answers, and the LKI scale with its category names (never colour alone).
// Dark slate with the Stroom glyph's air currents sweeping across.
export const alt = "Luchtmeter: elk uur de luchtkwaliteit in Nederland op de kaart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAD = 72;
const GAP = 8;
const CHIP = (size.width - 2 * PAD - (LKI_COLORS.length - 1) * GAP) / LKI_COLORS.length;

// Read at build time, so the image is generated once (static).
const [medium, bold] = await Promise.all(
  [500, 700].map((w) => readFile(join(process.cwd(), `assets/fonts/figtree-latin-${w}.woff`))),
);

// Air currents: the Stroom glyph's wave, repeated and stretched across the image.
function wave(y: number, amp: number, len: number) {
  let d = `M -40 ${y}`;
  for (let x = -40; x < size.width + 40; x += len) {
    d += ` q ${len / 4} ${-amp} ${len / 2} 0 t ${len / 2} 0`;
  }
  return d;
}

const CURRENTS = [
  { y: 150, amp: 34, len: 300, w: 3, o: 0.55 },
  { y: 205, amp: 26, len: 300, w: 2, o: 0.3 },
  { y: 300, amp: 40, len: 360, w: 3, o: 0.5 },
  { y: 360, amp: 22, len: 240, w: 2, o: 0.25 },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0F172A",
          color: "#F1F5F9",
          fontFamily: "Figtree",
        }}
      >
        {/* Glows and currents in SVG: Satori's own radial gradients render poorly. */}
        <svg
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.2" stopColor="#38BDF8" stopOpacity="0" />
              <stop offset="1" stopColor="#7DD3FC" stopOpacity="1" />
            </linearGradient>
            <radialGradient id="glow">
              <stop offset="0" stopColor="#0284C7" stopOpacity="0.5" />
              <stop offset="1" stopColor="#0284C7" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="glow-soft">
              <stop offset="0" stopColor="#38BDF8" stopOpacity="0.12" />
              <stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="1000" cy="120" rx="520" ry="420" fill="url(#glow)" />
          <ellipse cx="80" cy="640" rx="420" ry="300" fill="url(#glow-soft)" />
          {CURRENTS.map((c) => (
            <path
              key={c.y}
              d={wave(c.y, c.amp, c.len)}
              fill="none"
              stroke="url(#fade)"
              strokeWidth={c.w}
              strokeOpacity={c.o}
              strokeLinecap="round"
            />
          ))}
          <circle cx="1090" cy="300" r="9" fill="#7DD3FC" fillOpacity="0.6" />
        </svg>

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: PAD,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #0284C7, #0369A1)",
                  boxShadow: "0 8px 32px rgba(2,132,199,0.45)",
                }}
              >
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" />
                  <path d="M3 15.5c2-2.4 4-2.4 6 0s4 2.4 6 0" />
                  <circle cx="19.5" cy="15.5" r="1.6" fill="white" stroke="none" />
                </svg>
              </div>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>Luchtmeter</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 22px",
                borderRadius: 999,
                border: "1.5px solid #334155",
                background: "rgba(30,41,59,0.7)",
                fontSize: 22,
                fontWeight: 500,
                color: "#CBD5E1",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#38BDF8", boxShadow: "0 0 12px #38BDF8" }} />
              Elk uur bijgewerkt
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 700, letterSpacing: -3.5, lineHeight: 1 }}>
              <span>Hoe schoon is de lucht</span>
              <span
                style={{
                  backgroundImage: "linear-gradient(90deg, #38BDF8, #7DD3FC)",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                bij jou?
              </span>
            </div>
            <span style={{ fontSize: 30, fontWeight: 500, color: "#94A3B8" }}>
              Elk uur de luchtkwaliteit in Nederland op de kaart.
            </span>
          </div>

          <div style={{ display: "flex", gap: GAP }}>
            {LKI_CATEGORIES.map((cat, i) => {
              const steps = LKI_COLORS.slice(cat.from - 1, cat.to);
              const last = i === LKI_CATEGORIES.length - 1;
              return (
                <div
                  key={cat.name}
                  style={{
                    width: steps.length * CHIP + (steps.length - 1) * GAP,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: GAP }}>
                    {steps.map((c, j) => (
                      <div
                        key={c.bg}
                        style={{
                          width: CHIP,
                          height: 40,
                          borderRadius: 10,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: c.bg,
                          color: c.fg,
                          fontSize: 20,
                          fontWeight: 700,
                        }}
                      >
                        {cat.from + j}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      // The last category is one chip wide, so its name ends at the scale's end.
                      justifyContent: last ? "flex-end" : "flex-start",
                      whiteSpace: "nowrap",
                      fontSize: 22,
                      fontWeight: 500,
                      color: "#94A3B8",
                    }}
                  >
                    {cat.name}
                  </div>
                </div>
              );
            })}
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
