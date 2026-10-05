/**
 * The Fyka Notes, Fyka Retro and Fyka Votes marks, kept in one place so the
 * header, footer and app switcher can't drift apart.
 *
 * This file is copied verbatim into notes-website, sprintretro and
 * sprintvotes — change it in one, copy it to the other two.
 *
 * Shared recipe: a rounded tile (25 %) with a one-hue gradient, and a white
 * line glyph at 60 % of the tile on a 24-unit grid. The Votes swatch keeps
 * its original stroke of 2.
 *
 * Notes uses literal hex stops (the steel-500 → steel-700 scale from
 * notes-website) so the file works without that repo's theme tokens. In
 * notes-website, scripts/generate-icons.mjs rasterises NotesMark for the
 * favicon — change the glyph here and re-run `npm run icons` there.
 */

type MarkProps = {
  tile?: string;
  icon?: string;
};

export function NotesMark({
  tile = "h-12 w-12",
  icon = "h-[60%] w-[60%]",
}: MarkProps) {
  return (
    <div
      className={`${tile} flex items-center justify-center rounded-[25%] bg-linear-to-br from-[#5B7BAA] to-[#3C5070] shadow-md`}
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
      >
        <path d="M4 3.75h16" />
        <path d="M4 9.25h16" />
        <path d="M4 14.75h16" />
        <path d="M4 20.25h9" />
      </svg>
    </div>
  );
}

export function RetroMark({
  tile = "h-12 w-12",
  icon = "h-[60%] w-[60%]",
}: MarkProps) {
  return (
    <div
      className={`${tile} flex items-center justify-center rounded-[25%] bg-linear-to-br from-emerald-600 to-emerald-700 shadow-md`}
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
      >
        <rect x="1.5" y="2.5" width="8" height="8" rx="1.5" />
        <rect x="14" y="2.5" width="8" height="8" rx="1.5" />
        <rect x="1.5" y="14.5" width="8" height="8" rx="1.5" />
      </svg>
    </div>
  );
}

export function VotesMark({
  tile = "h-12 w-12",
  icon = "h-[60%] w-[60%]",
}: MarkProps) {
  return (
    <div
      className={`${tile} flex items-center justify-center rounded-[25%] bg-linear-to-br from-red-500 to-red-600 shadow-md`}
    >
      <svg
        className={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    </div>
  );
}
