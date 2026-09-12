import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Riddhi Thakkar",
  description: "Riddhi Thakkar — portfolio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* The moth's GLB is ~7.5MB and MothLayer only starts fetching it
            once its own effect runs post-hydration. Preloading from the
            head starts the download the instant the browser has the HTML,
            in parallel with everything else, which is what gets the
            creature on screen within a couple of seconds of the page
            loading rather than only after the reader has already started
            scrolling. */}
        <link
          rel="preload"
          as="fetch"
          href="/model/moth-final.glb"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
