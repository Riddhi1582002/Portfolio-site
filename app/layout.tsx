import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Curtain from "./components/Curtain";

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
        {/* THE CURTAIN, BEFORE THE FIRST PAINT. A page arrived at through
            a card's wipe has to already be covered when it paints — a
            React effect runs several frames later, and those frames are
            the flash of unmasked page the wipe exists to hide. This is the
            earliest a page can know, so it is where the cover is raised;
            Curtain below takes it over and sweeps it off. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var r=sessionStorage.getItem('curtainIn');" +
              "if(r&&Date.now()-Number(r)<8000)" +
              "document.documentElement.setAttribute('data-curtain','1');}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Curtain />
      </body>
    </html>
  );
}
