import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteChrome } from "@/components/site-chrome";
import { CookieBanner } from "@/components/ui/cookie-banner";
import { organizationJsonLd, dataCatalogJsonLd } from "@/lib/seo";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | SourceSignal",
    default: "SourceSignal — Procurement Intelligence",
  },
  description:
    "Discover, evaluate and monitor procurement opportunities across 15 " +
    "supported sectors. Commercial intelligence for procurement teams.",
  icons: [
    {
      rel: "icon",
      type: "image/svg+xml",
      url: "/icon.svg",
    },
  ],
  openGraph: {
    siteName: "SourceSignal",
    title: "SourceSignal — Procurement Intelligence",
    description:
      "Discover, evaluate and monitor procurement opportunities across 15 supported sectors.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased bg-black text-white`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(dataCatalogJsonLd()) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-black text-white antialiased">
        <SiteChrome>{children}</SiteChrome>
        <CookieBanner />
      </body>
    </html>
  );
}
