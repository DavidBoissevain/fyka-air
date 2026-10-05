"use client";

import { useTheme } from "next-themes";

import { controlButtonClass } from "./control-button";

/**
 * Stateless by design, like notes-website: the Sun/Moon swap is driven by the
 * `dark` class on <html> via CSS, which next-themes sets before paint. So
 * there is nothing to hydrate and no mount guard; the click reads the DOM.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();

  const toggle = () => {
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative ${controlButtonClass}`}
      aria-label="Wissel kleurthema"
    >
      <svg
        className="h-4 w-4 rotate-0 scale-100 transition-transform duration-200 motion-reduce:transition-none dark:-rotate-90 dark:scale-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
      <svg
        className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-200 motion-reduce:transition-none dark:rotate-0 dark:scale-100"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
