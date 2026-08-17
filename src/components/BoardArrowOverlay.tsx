"use client";

import { buildArrowShape, type BoardArrow } from "@/lib/board/arrowGeometry";

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
      {all.map((arrow, i) => {
        const [from, to, color = "rgba(129, 182, 76, 0.92)"] = arrow;
        if (from === to) return null;
        const d = buildArrowShape(from, to, boardWidth, orientation);
        const isPreview = preview && i === all.length - 1;
        return (
          <path
            key={`${from}-${to}-${i}`}
            d={d}
            fill={color}
            opacity={isPreview ? 0.5 : 1}
          />
        );
      })}
    </svg>
  );
}
