import { AppSwitcher } from "./app-switcher";
import { ThemeToggle } from "./theme-toggle";

/**
 * Based on notes-website's site-header so the Fyka sites read as one family:
 * a 44px (mobile) / 52px (desktop) control row, full-bleed rather than
 * max-width, and no bottom border. It has no background of its own and only
 * holds the theme toggle and app switcher on the right: the map's search box
 * takes the left of the row, and the logo and project links live in the "Over
 * de data" dialog. From lg up with the panel open the buttons sit on top of
 * the panel. AirMap's HEADER_HEIGHT, control offsets and panel padding follow
 * this height.
 */
export function SiteHeader() {
  return (
    // pointer-events-none so the empty rest of the bar doesn't block dragging the map.
    <nav className="pointer-events-none absolute inset-x-0 top-0 z-50">
      <div className="flex items-center justify-end gap-3 px-6 py-3 *:pointer-events-auto">
        <ThemeToggle />
        <AppSwitcher />
      </div>
    </nav>
  );
}
