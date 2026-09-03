import Link from "next/link";

// Minimal placeholder so the hero's "Riddhi Thakkar" link has somewhere
// real to go instead of 404ing. Not the requested scope — just enough
// to avoid shipping a dead link from the homepage.
export default function About() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <p className="text-sm tracking-wide text-white/60">About — coming soon</p>
      <Link href="/" className="mt-6 text-sm text-white/80 underline">
        Back home
      </Link>
    </div>
  );
}
