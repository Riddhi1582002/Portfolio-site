// Build-time image preparation.
//
// The raw portrait is a 3340x3340 / 4.06MB upload. Under `output: "export"`
// there is no image optimizer, so shipping it means the browser downloads
// 4MB and decodes an ~11.2 megapixel bitmap on the main thread — measured
// at ~2.1s of task time — to draw it at roughly 340 CSS px. That decode
// lands squarely inside the hero -> About name transition and is the
// single largest cause of its stalling.
//
// The raw lives outside public/ so it is never served. This emits the web
// sizes into public/photo/ instead. Runs from `prebuild`, so a plain
// `npm run build` cannot forget it.

import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(root, "assets/riddhi-photo-raw.jpg");
const OUT_DIR = resolve(root, "public/photo");

// Largest CSS box the photo occupies is clamp(220px, 26vw, 340px); 2x for
// retina is 680, so 800 leaves headroom without paying for 3340.
const EDGE = 800;

const targets = [
  { file: "riddhi-photo.jpg", fn: (p) => p.jpeg({ quality: 82, mozjpeg: true }) },
  { file: "riddhi-photo.webp", fn: (p) => p.webp({ quality: 80 }) },
];

const meta = await sharp(SRC).metadata();
await mkdir(OUT_DIR, { recursive: true });

for (const { file, fn } of targets) {
  const out = resolve(OUT_DIR, file);
  await fn(sharp(SRC).resize(EDGE, EDGE, { fit: "cover" })).toFile(out);
  const { size } = await stat(out);
  console.log(`  ${file}  ${EDGE}x${EDGE}  ${(size / 1024).toFixed(0)}KB`);
}

const { size: rawSize } = await stat(SRC);
console.log(
  `prepare-images: ${meta.width}x${meta.height} ${(rawSize / 1024 / 1024).toFixed(2)}MB -> ${EDGE}x${EDGE}`
);
