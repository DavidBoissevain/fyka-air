import type { MetadataRoute } from "next";

// "Zet op beginscherm": opens the map full screen, with the Stroom mark.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Luchtmeter",
    short_name: "Luchtmeter",
    description: "Elk uur de luchtkwaliteit in Nederland op de kaart.",
    lang: "nl",
    start_url: "/",
    display: "standalone",
    background_color: "#EEF1F5",
    theme_color: "#0369A1",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
