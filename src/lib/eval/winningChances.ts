/** Lichess-style winning chances from centipawns or mate (white POV). */

export function cpToWinningChances(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 2 / (1 + Math.exp(-0.00368208 * clamped)) - 1;
}

export function mateToWinningChances(mate: number): number {
  if (mate === 0) return 0;
  return mate > 0 ? 1 : -1;
}

export function winningChancesWhitePov(evalCp: number, mate?: number): number {
  if (mate !== undefined) return mateToWinningChances(mate);
  return cpToWinningChances(evalCp);
}

export function whitePercentFromWinningChances(chances: number): number {
  return ((chances + 1) / 2) * 100;
}
