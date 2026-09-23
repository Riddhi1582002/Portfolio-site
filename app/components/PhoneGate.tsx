"use client";

// PHONES GET A NOTE, NOT THE SITE.
//
// The portfolio is a long scroll-scrubbed journey through several live 3D
// scenes, built for a desktop screen and a pointer. On a phone it could
// not be made to feel right, so a phone is asked, kindly, to come back on
// a computer instead. Tablets and anything with a fine pointer get the
// site as before.
//
// Whether this is a phone is decided before the first paint by an inline
// script in the document head (it sets `data-phone` on <html>, and
// globals.css hides the page and shows the note from that alone), so a
// phone never sees the site flash up first. This component then keeps the
// page's own components from mounting at all there — the WebGL scenes and
// their downloads — rather than merely hiding them.

import { useSyncExternalStore, type ReactNode } from "react";

export const PHONE_ATTR = "data-phone";

/** Inline, pre-paint: a coarse pointer on a screen under 600px on its
 *  short side is a phone, in either orientation. */
export const PHONE_SCRIPT =
  "try{if(matchMedia('(pointer: coarse)').matches&&" +
  "Math.min(screen.width,screen.height)<600)" +
  `document.documentElement.setAttribute('${PHONE_ATTR}','1');}catch(e){}`;

const isPhone = () => document.documentElement.getAttribute(PHONE_ATTR) === "1";
const subscribe = () => () => {};

export default function PhoneGate({ children }: { children: ReactNode }) {
  const phone = useSyncExternalStore(subscribe, isPhone, () => false);
  if (!phone) return <>{children}</>;
  return null;
}

export function PhoneNote() {
  return (
    <div className="phone-note" role="note">
      <div className="phone-note-text">
        <p>Hey, there! I&apos;m so glad you&apos;re interested in seeing my work.</p>
        <p>
          Though, it&apos;ll be lovely if you can open this site on your pc instead, so you can
          experience it in the way it was meant to be experienced.
        </p>
        <p className="phone-note-sign">
          With love,
          <br />
          Riddhi
        </p>
      </div>
    </div>
  );
}
