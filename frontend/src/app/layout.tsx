import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://printxads.lk"),
  title: { default: "Print X — Print, Events & Invitations", template: "%s · Print X" },
  description: "Custom print products, event tickets and animated wedding invitations in Sri Lanka.",
};
export const viewport: Viewport = { themeColor: "#f7f5ef", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // opts into dynamic rendering so the CSP nonce applies to framework scripts
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-forest focus:px-4 focus:py-2 focus:text-ivory">
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
