/**
 * The Fyka Air app mark ("Stroom"): two air currents and a particle.
 *
 * Follows the shared Fyka recipe from fyka-website's app-marks.tsx: a rounded
 * tile (25 %) with a one-hue gradient (sky-600 → sky-700), and a white line
 * glyph at 60 % of the tile on a 24-unit grid with stroke 2.5. The same glyph
 * is in app/icon.svg and app/apple-icon.tsx; change all three together.
 */

type AirMarkProps = {
  tile?: string;
  icon?: string;
};

export function AirMark({
  tile = "h-12 w-12",
  icon = "h-[60%] w-[60%]",
}: AirMarkProps) {
  return (
    <div
      className={`${tile} flex items-center justify-center rounded-[25%] bg-linear-to-br from-sky-600 to-sky-700 shadow-md`}
    >
      <svg
        className={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M3 9c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0" />
        <path d="M3 15.5c2-2.4 4-2.4 6 0s4 2.4 6 0" />
        <circle cx="19.5" cy="15.5" r="1.6" fill="white" stroke="none" />
      </svg>
    </div>
  );
}
