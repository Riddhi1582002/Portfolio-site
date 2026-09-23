// PHONES, ON CLOUDFLARE PAGES: redirected before the site is served.
//
// vercel.json does this on Vercel with a header-matched redirect; Cloudflare
// Pages' own `_redirects` file cannot match on a request header, so the same
// rule is done here instead, as a Pages Function that runs in front of every
// request. Same phone test as PhoneGate.tsx's in-page fallback: a phone
// user-agent (checked, not a screen-size guess, since a header is all a
// worker has to go on).
//
// Left alone: /phone.html itself, anything Next's export needs
// (/_next/*), and non-navigations (images, fonts, the model files) —
// a phone that already has the note open must still be able to load
// its own tiny page.
//
// BOTH "/phone.html" AND "/phone" are excluded. Cloudflare Pages serves
// static HTML under "clean URLs" by default: a request for /phone.html is
// itself 308-redirected, by Pages' own asset server, to /phone. Excluding
// only the ".html" path left that second request to come back through
// this function and be sent to /phone.html again — a redirect loop that
// never reached the note at all.

const PHONE_UA =
  /iphone|ipod|android.+mobile|windows phone|blackberry|bb10|opera mini|iemobile/i;
const PHONE_PATHS = new Set(["/phone.html", "/phone"]);

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (
    request.method === "GET" &&
    !PHONE_PATHS.has(url.pathname) &&
    !url.pathname.startsWith("/_next/") &&
    PHONE_UA.test(request.headers.get("user-agent") || "")
  ) {
    return Response.redirect(new URL("/phone.html", url), 307);
  }

  return next();
}
