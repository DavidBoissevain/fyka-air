import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/links";

// The API routes are map tiles and popup values, not pages to index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
