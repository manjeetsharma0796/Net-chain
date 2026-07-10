import type { Metadata } from "next";
import { Schibsted_Grotesk, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * Type system:
 *  - Schibsted Grotesk, display + body. Newsy, characterful, sentence case.
 *  - Newsreader italic, the single serif accent word in each headline.
 *  - IBM Plex Mono, every figure, party ID, hash, and eyebrow label.
 */
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["400", "500"],
  variable: "--font-serif",
  display: "swap",
  // Next 14.2 has no fallback metrics for Newsreader; it only renders
  // single accent words, so a plain serif fallback is fine.
  fallback: ["Georgia", "serif"],
  adjustFontFallback: false,
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NetChain, Confidential Treasury Settlement",
  description:
    "Multilateral netting and atomic on-ledger settlement in USDCx on the Canton Network. Counterparties stay blind to each other.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        id="netchain-root"
        className={`${sans.variable} ${serif.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
