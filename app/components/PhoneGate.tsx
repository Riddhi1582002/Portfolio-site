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
// script in the document head, which sends it to the standalone note at
// /phone.html (see PHONE_SCRIPT), so a phone neither sees the site flash
// up nor downloads it. What follows is only the fallback for
// a browser where that script could not do so: the page is hidden by CSS
// from the same attribute, and its components are kept from mounting.

import { useSyncExternalStore, type ReactNode } from "react";

export const PHONE_ATTR = "data-phone";

/** Inline, pre-paint: a coarse pointer on a screen under 600px on its
 *  short side is a phone, in either orientation. A phone is sent straight
 *  to /phone.html — the note alone, a single small file — and leaving
 *  this document cancels everything it had started to fetch, so a phone
 *  downloads none of the site. */
export const PHONE_SCRIPT =
  "try{if(matchMedia('(pointer: coarse)').matches&&" +
  "Math.min(screen.width,screen.height)<600){" +
  `document.documentElement.setAttribute('${PHONE_ATTR}','1');` +
  "location.replace('/phone.html');}}catch(e){}";

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
          However, it&apos;ll be lovely if you can open this site on your pc instead, so you can
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
