import { Figtree, Geist_Mono } from "next/font/google";

// Shared by the root layout and global-error, which renders without it.
export const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
