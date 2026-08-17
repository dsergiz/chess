/*
 * Stockfish web worker — loads the engine from /stockfish.js.
 *
 * The installed stockfish.js build (niklasf/stockfish.js, Emscripten multi-variant) wires up its
 * own `self.onmessage`/`postMessage` UCI protocol directly against the worker's global scope when
 * loaded — it does not expose a `STOCKFISH()` factory function. Older stockfish.js builds did use
 * that factory-function convention; this build doesn't, so no such detection/relay is needed here.
 */
importScripts("/stockfish.js");
