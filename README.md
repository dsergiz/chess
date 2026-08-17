# Chess Eval

AI-powered chess game review — import games from Chess.com or PGN, navigate moves, and get multi-engine analysis with commentary.

## Features

- **Chess.com integration** — fetch recent games by username
- **PGN import** — paste any game
- **Multi-engine analysis** — Stockfish at multiple depths with consensus voting
- **AI commentary** — explains best moves, eval swings, and path to position
- **Classic UI** — cburnett piece set, capture animations, mobile-friendly controls
- **Drag & drop board** — touch-optimized piece movement on mobile

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test          # Unit tests (Vitest) — 39 tests
npm run test:e2e  # E2E tests (Playwright) — 10 tests
npm run qa        # Full QA: unit + build + e2e
```

See [docs/QA.md](docs/QA.md) for CI and multi-agent QA workflow.

## Analysis modes

In the analysis panel, pick a mode before clicking **Analyze**:

| Mode | Speed | Purpose |
|------|-------|---------|
| **Fast** (default) | ~0.5s | Quick eval while browsing |
| **Deep** | ~2s | Important positions |
| **Tactical** | ~1s | Multiple candidate lines |
| **Compare** | ~2.5s | 3-pass Stockfish consensus |

## Tech Stack

- Next.js 15, React 19, TypeScript
- chess.js, react-chessboard, Stockfish.js
- Tailwind CSS, Framer Motion
- Vitest, Playwright

## Stockfish Setup

After `npm install`, copy the engine to public:

```bash
cp node_modules/stockfish.js/stockfish.js public/stockfish.js
```

On Windows PowerShell:

```powershell
Copy-Item node_modules/stockfish.js/stockfish.js public/stockfish.js
```
