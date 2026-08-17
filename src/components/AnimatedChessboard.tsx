"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { TouchBackend } from "react-dnd-touch-backend";
import { motion, AnimatePresence } from "framer-motion";
import type { Square } from "chess.js";
import { Chess } from "@/lib/chess";
import {
  BOARD_BEST_FROM,
  BOARD_BEST_TO,
  BOARD_DARK,
  BOARD_LAST_MOVE,
  BOARD_LIGHT,
  pieceImageUrl,
} from "@/lib/pieces";
import {
  type BoardArrow,
  userArrowColor,
} from "@/lib/board/arrowGeometry";
import { BoardArrowOverlay } from "@/components/BoardArrowOverlay";
import clsx from "clsx";

type PieceKey = "wP" | "wN" | "wB" | "wR" | "wQ" | "wK" | "bP" | "bN" | "bB" | "bR" | "bQ" | "bK";

const ALL_SQUARES: Square[] = [];
for (const f of "abcdefgh") {
  for (let r = 1; r <= 8; r++) {
    ALL_SQUARES.push(`${f}${r}` as Square);
  }
}

function Piece({ piece }: { piece: PieceKey }) {
  return (
    <img
      src={pieceImageUrl(piece)}
      alt=""
      className="piece-img"
      draggable={false}
      onError={(e) => {
        (e.target as HTMLImageElement).style.opacity = "0.3";
      }}
    />
  );
}

const customPieces: Record<PieceKey, () => React.JSX.Element> = {
  wP: () => <Piece piece="wP" />,
  wN: () => <Piece piece="wN" />,
  wB: () => <Piece piece="wB" />,
  wR: () => <Piece piece="wR" />,
  wQ: () => <Piece piece="wQ" />,
  wK: () => <Piece piece="wK" />,
  bP: () => <Piece piece="bP" />,
  bN: () => <Piece piece="bN" />,
  bB: () => <Piece piece="bB" />,
  bR: () => <Piece piece="bR" />,
  bQ: () => <Piece piece="bQ" />,
  bK: () => <Piece piece="bK" />,
};

interface AnimatedChessboardProps {
  fen: string;
  boardKey?: string;
  orientation?: "white" | "black";
  lastMove?: { from: Square; to: Square } | null;
  castleRookMove?: { from: Square; to: Square } | null;
  highlightSquares?: Record<string, React.CSSProperties>;
  moveHintStyles?: Record<string, React.CSSProperties>;
  checkSquare?: Square | null;
  engineArrows?: BoardArrow[];
  userArrows?: BoardArrow[];
  onUserArrowsChange?: (arrows: BoardArrow[]) => void;
  onSquareClick?: (square: Square) => void;
  onPieceDrop?: (source: Square, target: Square) => boolean;
  onPromotionSelect?: (from: Square, to: Square, piece: "q" | "r" | "b" | "n") => boolean;
  canDragPiece?: (square: Square, piece: string) => boolean;
  interactive?: boolean;
  onBoardWidthChange?: (width: number) => void;
}

export function AnimatedChessboard({
  fen,
  boardKey,
  orientation = "white",
  lastMove,
  castleRookMove,
  highlightSquares = {},
  moveHintStyles = {},
  checkSquare,
  engineArrows = [],
  userArrows = [],
  onUserArrowsChange,
  onSquareClick,
  onPieceDrop,
  onPromotionSelect,
  canDragPiece,
  interactive = false,
  onBoardWidthChange,
}: AnimatedChessboardProps) {
  const [captureEffect, setCaptureEffect] = useState<{
    square: Square;
    key: number;
  } | null>(null);
  const [castleEffect, setCastleEffect] = useState<{
    kingTo: Square;
    rookTo: Square;
    key: number;
  } | null>(null);
  const [prevFen, setPrevFen] = useState(fen);
  const [width, setWidth] = useState(480);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [arrowFrom, setArrowFrom] = useState<Square | null>(null);
  const [arrowPreview, setArrowPreview] = useState<BoardArrow | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawModifiers = useRef({ shiftKey: false, altKey: false });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 480;
      setWidth(Math.max(280, Math.min(w, 560)));
    });
    observer.observe(node);
    const initial = Math.max(280, Math.min(node.clientWidth || 480, 560));
    setWidth(initial);
    onBoardWidthChange?.(initial);
    return () => observer.disconnect();
  }, [onBoardWidthChange]);

  useEffect(() => {
    onBoardWidthChange?.(width);
  }, [width, onBoardWidthChange]);

  useEffect(() => {
    if (fen === prevFen) return;
    const captureSquare = findCaptureSquare(prevFen, fen, lastMove?.to ?? null);
    if (captureSquare) {
      setCaptureEffect({ square: captureSquare, key: Date.now() });
      setTimeout(() => setCaptureEffect(null), 650);
    }
    if (castleRookMove && lastMove) {
      setCastleEffect({ kingTo: lastMove.to, rookTo: castleRookMove.to, key: Date.now() });
      setTimeout(() => setCastleEffect(null), 550);
    }
    setPrevFen(fen);
    setPromotion(null);
    setArrowFrom(null);
    setArrowPreview(null);
  }, [fen, prevFen, lastMove, castleRookMove]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {
      ...moveHintStyles,
      ...highlightSquares,
    };

    if (checkSquare) {
      styles[checkSquare] = {
        ...styles[checkSquare],
        backgroundColor: "rgba(255, 0, 0, 0.45)",
        boxShadow: "inset 0 0 0 3px rgba(255, 60, 60, 0.8)",
      };
    }

    if (lastMove) {
      styles[lastMove.from] = {
        ...styles[lastMove.from],
        backgroundColor: BOARD_LAST_MOVE,
      };
      styles[lastMove.to] = {
        ...styles[lastMove.to],
        backgroundColor: BOARD_LAST_MOVE,
        boxShadow: "inset 0 0 0 3px rgba(255,255,0,0.35)",
      };
    }

    return styles;
  }, [lastMove, highlightSquares, moveHintStyles, checkSquare]);

  const handlePromotionCheck = useCallback(
    (sourceSquare: Square, targetSquare: Square) => {
      const chess = new Chess(fen);
      const piece = chess.get(sourceSquare);
      if (!piece || piece.type !== "p") return false;
      const isPromo =
        (piece.color === "w" && targetSquare[1] === "8") ||
        (piece.color === "b" && targetSquare[1] === "1");
      if (isPromo) setPromotion({ from: sourceSquare, to: targetSquare });
      return isPromo;
    },
    [fen]
  );

  const squareFromEvent = useCallback((target: EventTarget | null): Square | null => {
    const el = (target as HTMLElement | null)?.closest?.("[data-square]");
    const sq = el?.getAttribute("data-square");
    return sq && sq.length === 2 ? (sq as Square) : null;
  }, []);

  const toggleUserArrow = useCallback(
    (from: Square, to: Square, color: string) => {
      if (!onUserArrowsChange) return;
      const exists = userArrows.some(([f, t]) => f === from && t === to);
      if (exists) {
        onUserArrowsChange(userArrows.filter(([f, t]) => !(f === from && t === to)));
      } else {
        onUserArrowsChange([...userArrows, [from, to, color]]);
      }
    },
    [onUserArrowsChange, userArrows]
  );

  const onBoardMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 2 || !onUserArrowsChange) return;
      e.preventDefault();
      const sq = squareFromEvent(e.target);
      if (!sq) return;
      drawModifiers.current = { shiftKey: e.shiftKey, altKey: e.altKey };
      setArrowFrom(sq);
      setArrowPreview([sq, sq, userArrowColor(drawModifiers.current)]);
    },
    [onUserArrowsChange, squareFromEvent]
  );

  const onBoardMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!arrowFrom) return;
      const sq = squareFromEvent(e.target) ?? arrowFrom;
      setArrowPreview([arrowFrom, sq, userArrowColor(drawModifiers.current)]);
    },
    [arrowFrom, squareFromEvent]
  );

  const onBoardMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 2 || !arrowFrom) return;
      e.preventDefault();
      const sq = squareFromEvent(e.target);
      if (sq && sq !== arrowFrom) {
        toggleUserArrow(arrowFrom, sq, userArrowColor(drawModifiers.current));
      }
      setArrowFrom(null);
      setArrowPreview(null);
    },
    [arrowFrom, squareFromEvent, toggleUserArrow]
  );

  const overlayArrows = useMemo(
    () => [...engineArrows, ...userArrows],
    [engineArrows, userArrows]
  );

  return (
    <div
      ref={containerRef}
      data-testid="chess-board"
      className="relative w-full mx-auto select-none touch-manipulation chess-board-shell"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={onBoardMouseDown}
      onMouseMove={onBoardMouseMove}
      onMouseUp={onBoardMouseUp}
      onMouseLeave={() => {
        setArrowFrom(null);
        setArrowPreview(null);
      }}
    >
      <AnimatePresence>
        {captureEffect && (
          <motion.div
            key={captureEffect.key}
            className="pointer-events-none absolute inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute rounded-full border-2 border-amber-300/80 bg-amber-200/20"
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: width / 8,
                height: width / 8,
                left: squareToPercent(captureEffect.square, orientation).left,
                top: squareToPercent(captureEffect.square, orientation).top,
                transform: "translate(-50%, -50%)",
              }}
            />
            <motion.div
              className="absolute h-14 w-14 rounded-full bg-red-400/40 blur-lg"
              initial={{ scale: 0.4, opacity: 1 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{
                left: squareToPercent(captureEffect.square, orientation).left,
                top: squareToPercent(captureEffect.square, orientation).top,
                transform: "translate(-50%, -50%)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {castleEffect &&
          (() => {
            const king = squareCenterPercent(castleEffect.kingTo, orientation);
            const rook = squareCenterPercent(castleEffect.rookTo, orientation);
            const barLeft = Math.min(king.left, rook.left);
            const barWidth = Math.abs(king.left - rook.left);
            return (
              <motion.div
                key={castleEffect.key}
                className="pointer-events-none absolute inset-0 z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="absolute rounded-full bg-gradient-to-r from-amber-300/0 via-amber-300/80 to-amber-300/0"
                  initial={{ opacity: 0, scaleX: 0.3 }}
                  animate={{ opacity: [0, 1, 0], scaleX: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{
                    left: `${barLeft}%`,
                    top: `${king.top}%`,
                    width: `${barWidth}%`,
                    height: Math.max(3, width / 60),
                    transform: "translateY(-50%)",
                    transformOrigin: "center",
                  }}
                />
                {[king, rook].map((pos, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full border-2 border-amber-300/70 bg-amber-200/15"
                    initial={{ scale: 0.5, opacity: 0.9 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
                    style={{
                      width: width / 8,
                      height: width / 8,
                      left: `${pos.left}%`,
                      top: `${pos.top}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}
              </motion.div>
            );
          })()}
      </AnimatePresence>

      {promotion && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 rounded-sm backdrop-blur-[2px]">
          <div className="flex gap-2 p-3 rounded-lg bg-board-panel border border-board-border shadow-2xl">
            {(["q", "r", "b", "n"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className="w-14 h-14 rounded-lg hover:bg-board-hover border border-board-border flex items-center justify-center text-2xl font-bold uppercase transition-transform hover:scale-105 active:scale-95"
                onClick={() => {
                  const ok = onPromotionSelect?.(promotion.from, promotion.to, p);
                  if (ok !== false) setPromotion(null);
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <BoardArrowOverlay
        arrows={overlayArrows}
        preview={arrowPreview}
        boardWidth={width}
        orientation={orientation}
      />

      <Chessboard
        key={boardKey}
        id="review-board"
        position={fen}
        boardOrientation={orientation}
        customPieces={customPieces}
        customDarkSquareStyle={{ backgroundColor: BOARD_DARK }}
        customLightSquareStyle={{ backgroundColor: BOARD_LIGHT }}
        customSquareStyles={squareStyles}
        customArrows={[]}
        areArrowsAllowed={false}
        animationDuration={280}
        autoPromoteToQueen={false}
        showPromotionDialog={false}
        onPromotionCheck={handlePromotionCheck}
        arePiecesDraggable={interactive}
        isDraggablePiece={({ piece, sourceSquare }) =>
          canDragPiece ? canDragPiece(sourceSquare, piece) : true
        }
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        boardWidth={width}
        // react-chessboard auto-picks react-dnd's HTML5Backend vs TouchBackend based on
        // `"ontouchstart" in window`, which is true on many touch-capable laptops even when
        // the user is dragging with a mouse — and its default TouchBackend doesn't handle mouse
        // events at all, making drag feel broken/unresponsive on those devices. Forcing
        // TouchBackend with enableMouseEvents handles mouse, touch, and pen uniformly.
        customDndBackend={TouchBackend}
        customDndBackendOptions={{ enableMouseEvents: true, delayTouchStart: 0 }}
      />
    </div>
  );
}

function countPieces(fen: string): number {
  return fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
}

function findCaptureSquare(before: string, after: string, hintTo: Square | null): Square | null {
  if (countPieces(after) >= countPieces(before)) return null;
  if (hintTo) return hintTo;

  try {
    const chessBefore = new Chess(before);
    const chessAfter = new Chess(after);
    for (const sq of ALL_SQUARES) {
      const b = chessBefore.get(sq);
      const a = chessAfter.get(sq);
      if (b && a && b.color !== a.color) return sq;
      if (!b && a) return sq;
    }
  } catch {
    return null;
  }
  return null;
}

function squareCenterPercent(square: Square, orientation: "white" | "black") {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1], 10) - 1;
  const size = 12.5;
  let left = file * size + size / 2;
  let top = (7 - rank) * size + size / 2;
  if (orientation === "black") {
    left = (7 - file) * size + size / 2;
    top = rank * size + size / 2;
  }
  return { left, top };
}

function squareToPercent(square: Square, orientation: "white" | "black") {
  const { left, top } = squareCenterPercent(square, orientation);
  return { left: `${left}%`, top: `${top}%` };
}

export function BoardControls({
  onPrev,
  onNext,
  onStart,
  onEnd,
  canPrev,
  canNext,
  currentPly,
  totalPlies,
}: {
  onPrev: () => void;
  onNext: () => void;
  onStart: () => void;
  onEnd: () => void;
  canPrev: boolean;
  canNext: boolean;
  currentPly: number;
  totalPlies: number;
}) {
  return (
    <div className="flex flex-col items-center gap-3 mt-4">
      <div className="flex items-center justify-center gap-2">
        <BoardButton onClick={onStart} disabled={!canPrev} label="⏮" title="Start" />
        <BoardButton onClick={onPrev} disabled={!canPrev} label="◀" title="Previous (←)" />
        <BoardButton onClick={onNext} disabled={!canNext} label="▶" title="Next (→)" />
        <BoardButton onClick={onEnd} disabled={!canNext} label="⏭" title="End" />
      </div>
      <p className="text-xs text-gray-500 tabular-nums">
        Move {currentPly} / {totalPlies}
        <span className="hidden sm:inline text-gray-600"> · ← → to navigate</span>
      </p>
      <p className="text-[10px] text-gray-600 hidden sm:block">
        Right-drag arrows · Shift=red · Alt=blue · Esc clears
      </p>
    </div>
  );
}

function BoardButton({
  onClick,
  disabled,
  label,
  title,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={clsx(
        "h-11 w-11 rounded-lg text-base font-medium transition-all duration-200",
        "bg-board-panel border border-board-border text-gray-200",
        "hover:bg-board-hover active:scale-95",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        "touch-manipulation min-h-[44px] min-w-[44px]"
      )}
    >
      {label}
    </button>
  );
}

export { BOARD_BEST_FROM, BOARD_BEST_TO };
