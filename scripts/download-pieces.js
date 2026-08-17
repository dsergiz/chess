const fs = require("fs");
const path = require("path");
const https = require("https");

const PIECES = ["wp", "wn", "wb", "wr", "wq", "wk", "bp", "bn", "bb", "br", "bq", "bk"];
const BASE = "https://images.chesscomfiles.com/chess-themes/pieces/neo/150";
const destDir = path.join(__dirname, "..", "public", "pieces", "neo");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(destDir, { recursive: true });
  for (const piece of PIECES) {
    const dest = path.join(destDir, `${piece}.png`);
    if (fs.existsSync(dest)) continue;
    await download(`${BASE}/${piece}.png`, dest);
    console.log(`Downloaded ${piece}.png`);
  }
  console.log("Piece assets ready.");
}

main().catch((err) => console.warn("Piece download skipped:", err.message));
