// PHONES LEAVE BEFORE ANYTHING LOADS.
//
// Run after `next build` (the "postbuild" script). Next places its own
// stylesheets, font preloads and scripts at the top of <head>, ahead of
// anything the layout adds, so by the time the layout's phone check ran,
// the browser had already started fetching those. This puts the same
// check first in every exported page — straight after the charset — so a
// phone is sent to /phone.html before the page has asked for anything.
// See app/components/PhoneGate.tsx.

import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("out");
const MARK = "<!--phone-first-->";
const SCRIPT =
  `${MARK}<script>try{if(matchMedia('(pointer: coarse)').matches&&` +
  `Math.min(screen.width,screen.height)<600){` +
  `document.documentElement.setAttribute('data-phone','1');` +
  `location.replace('/phone.html');}}catch(e){}</script>`;
const CHARSET = '<meta charSet="utf-8"/>';

let done = 0;
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith(".html") && entry.name !== "phone.html") {
      const html = fs.readFileSync(file, "utf8");
      if (html.includes(MARK) || !html.includes(CHARSET)) continue;
      fs.writeFileSync(file, html.replace(CHARSET, CHARSET + SCRIPT));
      done++;
    }
  }
};
if (fs.existsSync(OUT)) walk(OUT);
console.log(`phone-first: ${done} pages`);
