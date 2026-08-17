const fs = require("fs");
const path = require("path");

// Stockfish 18, single-threaded WASM/NNUE build (no SharedArrayBuffer/cross-origin-isolation
// needed) — same engine Chess.com ships. The npm package bundles many build variants; we only
// need this one pair.
const binDir = path.join(__dirname, "..", "node_modules", "stockfish", "bin");
const files = [
  ["stockfish-18-lite-single.js", "stockfish.js"],
  ["stockfish-18-lite-single.wasm", "stockfish.wasm"],
];

for (const [srcName, destName] of files) {
  const src = path.join(binDir, srcName);
  const dest = path.join(__dirname, "..", "public", destName);
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${srcName} to public/${destName}`);
    } else {
      console.warn(`Could not find ${src}`);
    }
  } catch (err) {
    console.warn(`Could not copy ${srcName}:`, err.message);
  }
}
