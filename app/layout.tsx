import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PageReveal from "./components/PageReveal";
import ContextCursor from "./components/ContextCursor";

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
        {/* CLOSED BEFORE THE FIRST PAINT. A page arrived at through the
            transition has to already be at its closed aperture when it
            paints — a React effect runs several frames later, and those
            frames are the flash of unmasked page the transition exists to
            prevent. This is the earliest a page can know; PageReveal below
            takes that closed state over and opens it. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var r=sessionStorage.getItem('pageReveal');" +
              "if(r&&Date.now()-Number(r)<8000)" +
              "document.documentElement.setAttribute('data-reveal','1');}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* THE CLIPPED ELEMENT. The page itself is what the aperture opens
            and closes, so the destination is uncovered rather than having
            something dealt over it — see app/lib/pageTransition.ts. At
            rest it carries no clip and no transform, so it is an ordinary
            wrapper and establishes no containing block. */}
        <div id="page-frame" className="flex flex-1 flex-col">
          {children}
        </div>
        <PageReveal />
        {/* Outside the page frame, so the aperture never clips it. */}
        <ContextCursor />
      </body>
    </html>
  );
}
