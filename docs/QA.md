# QA & Multi-Agent Workflow

## Recommended approach

Use **split CI jobs** (already in `.github/workflows/ci.yml`) rather than one monolithic check:

| Job | Role | Fails if |
|-----|------|----------|
| **Build** | Compiler gate | TypeScript / Next.js build breaks |
| **Unit tests** | Logic QA | PGN, commentary, engine modes, API stubs |
| **E2E tests** | UX QA | Board, navigation, analysis wiring |

This mirrors a multi-agent setup: one pipeline stage builds, another validates logic, a third validates the product in a browser.

## Local full QA

```bash
npm run qa
```

Runs unit tests → production build → Playwright E2E.

## Cursor / cloud agents (optional)

If you use Cursor Cloud Agents or similar:

1. **Agent A — Implement** — feature branch, opens PR
2. **Agent B — Test** — runs `npm test`, fixes unit failures only
3. **Agent C — E2E** — runs `npm run test:e2e`, fixes UI regressions

Keep agents scoped: never let the test agent refactor unrelated code.

## Analysis modes

| Mode | Speed | Use when |
|------|-------|----------|
| **Fast** (live) | ~0.5s | Auto-updates as you browse moves |
| **Deep** | ~2s | Important positions + AI commentary |
| **Tactical** | ~1s | Top 4 candidate engine lines |
| **Compare** | ~2.5s | Multi-pass consensus (3 Stockfish runs) |

**Live analysis** always runs in Fast mode while navigating. Pick a mode and click **Deep analyze** for commentary, multi-line tactical output, or compare consensus. Deep results are kept separate from live eval until you change moves.

## Opening book

Master-game statistics come from the [Lichess opening explorer](https://lichess.org/analysis) API (same database approach as Lichess). Each move shows **% played** plus W/D/B result bars.

## E2E coverage

Playwright includes a **full game review walkthrough** (navigate → tactical deep analyze → mode switch → deep refresh) plus unit tests for engine modes, opening stats, and API fallbacks.
