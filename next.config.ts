import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables `use cache` + cacheLife for the hourly air quality data.
  cacheComponents: true,
};

export default nextConfig;
