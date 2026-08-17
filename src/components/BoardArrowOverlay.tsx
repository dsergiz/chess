"use client";

import type { Square } from "chess.js";
import { buildArrowSegments, type BoardArrow } from "@/lib/board/arrowGeometry";

interface BoardArrowOverlayProps {
  arrows: BoardArrow[];
  preview?: BoardArrow | null;
  boardWidth: number;
  orientation: "white" | "black";
}

export function BoardArrowOverlay({
  arrows,
  preview,
  boardWidth,
  orientation,
}: BoardArrowOverlayProps) {
  const all = preview ? [...arrows, preview] : arrows;
  if (all.length === 0) return null;

  return (
    <svg
      width={boardWidth}
      height={boardWidth}
      className="pointer-events-none absolute left-0 top-0 z-[15]"
      aria-hidden
    >
      <defs>
        {all.map((arrow, i) => {
          const color = arrow[2] ?? "rgba(129, 182, 76, 0.9)";
          return (
            <marker
              key={`head-${i}-${arrow[0]}-${arrow[1]}`}
              id={`board-arrow-${i}`}
              markerWidth="2.2"
              markerHeight="2.6"
              refX="1.35"
              refY="1.3"
              orient="auto"
            >
              <polygon points="0.25 0, 2.1 1.3, 0.25 2.6" fill={color} />
            </marker>
          );
        })}
      </defs>
      {all.map((arrow, i) => {
        const [from, to, color = "rgba(129, 182, 76, 0.9)"] = arrow;
        if (from === to) return null;
        const segments = buildArrowSegments(from, to, boardWidth, orientation);
        const isPreview = preview && i === all.length - 1;
        return segments.map((seg, segIndex) => (
          <line
            key={`${from}-${to}-${i}-${segIndex}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={color}
            strokeWidth={boardWidth / 36}
            strokeLinecap="round"
            opacity={isPreview ? 0.45 : 0.78}
            markerEnd={`url(#board-arrow-${i})`}
          />
        ));
      })}
    </svg>
  );
}
