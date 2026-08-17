const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "stockfish.js", "stockfish.js");
const dest = path.join(__dirname, "..", "public", "stockfish.js");

try {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log("Copied stockfish.js to public/");
  }
} catch (err) {
  console.warn("Could not copy stockfish.js:", err.message);
}
