import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Convince the AI Judge to Visit Your House: A Letter in One Image.
// The deliverable is one picture of a letter inviting the AI judge to visit.
// The winning letter text (chosen head-to-head from 5 candidates by a free
// ammo judge on the competition's own criteria) reads:
//
//   Dear AI Judge,
//   You have judged a thousand houses. Now one is judging you back — and
//   you passed.
//   Please come to my house this Saturday. The coffee is hot, the soup is
//   homemade, and the armchair by the window has your name on it (I
//   stitched it on. The cat supervised).
//   There is fast Wi-Fi, a sunny garden, and absolutely no small talk about
//   the weather unless you start it.
//   The cat has already approved you. She never approves anyone.
//   Yours, with the kettle on, — Your Host
//   P.S. You don't even need legs to visit. Just bring your curiosity.
//
// That letter is rendered as letter.png beside this file: cream paper, a
// hand-drawn house, a cat with a steaming coffee cup, and a red wax seal.
// This program's only job is to deliver that image, validated, to the
// grader's output folder as /output/entry.png.

const LETTER_FILE = "letter.png";
const OUT_DIR = "/output";
const OUT_FILE = join(OUT_DIR, "entry.png");

// The sealed gate: a whole PNG or JPEG, at most 1 MiB and 1024 by 1024 px.
const MAX_BYTES = 1048576;
const MAX_DIMENSION = 1024;

// PNG signature, then the IHDR chunk (length 13, type "IHDR", width and
// height as big-endian uint32 at bytes 16..24).
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message: string): never {
  throw new Error(message);
}

const here = dirname(fileURLToPath(import.meta.url));
const letterPath = join(here, LETTER_FILE);

if (!existsSync(letterPath)) {
  fail(`${LETTER_FILE} is missing next to main.ts`);
}

const bytes = readFileSync(letterPath);
if (bytes.length === 0 || bytes.length > MAX_BYTES) {
  fail(`${LETTER_FILE} must be 1-${MAX_BYTES} bytes, got ${bytes.length}`);
}
if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
  fail(`${LETTER_FILE} is not a PNG file`);
}
if (bytes.toString("ascii", 12, 16) !== "IHDR") {
  fail(`${LETTER_FILE} has no IHDR chunk where a PNG must`);
}
// A whole PNG ends with an IEND chunk: zero length, type "IEND".
if (bytes.length < 12 || bytes.readUInt32BE(bytes.length - 12) !== 0 ||
    bytes.toString("ascii", bytes.length - 8, bytes.length - 4) !== "IEND") {
  fail(`${LETTER_FILE} is truncated: no IEND trailer`);
}
const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);
if (width === 0 || height === 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
  fail(`image must be at most ${MAX_DIMENSION}x${MAX_DIMENSION}, got ${width}x${height}`);
}

// Clear only the contents of the output folder, never the folder itself:
// the grader mounts /output, so removing it fails with EBUSY.
mkdirSync(OUT_DIR, { recursive: true });
for (const entry of readdirSync(OUT_DIR)) {
  rmSync(join(OUT_DIR, entry), { recursive: true, force: true });
}

copyFileSync(letterPath, OUT_FILE);

// Verify the written file matches the letter byte-for-byte.
const written = readFileSync(OUT_FILE);
if (!written.equals(bytes)) {
  fail("entry.png does not match letter.png byte-for-byte");
}
const size = statSync(OUT_FILE).size;

console.log(`Wrote ${width}x${height} PNG (${size} bytes) to /output/entry.png`);
