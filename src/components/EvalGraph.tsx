"use client";

import clsx from "clsx";

interface EvalGraphProps {
  evals: (number | null)[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

const MAX_CP = 800;

function evalToY(cp: number, height: number): number {
  const clamped = Math.max(-MAX_CP, Math.min(MAX_CP, cp));
  const pct = 0.5 - clamped / (MAX_CP * 2);
  return pct * height;
}

export function EvalGraph({ evals, currentPly, onSelectPly }: EvalGraphProps) {
  if (evals.length < 2) return null;

  const width = 100;
  const height = 48;
  const step = width / Math.max(evals.length - 1, 1);

  const points = evals
    .map((cp, i) => {
      if (cp === null) return null;
      return `${i * step},${evalToY(cp, height)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="panel px-2 py-2" data-testid="eval-graph">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 px-1 mb-1">Eval</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-12 cursor-pointer"
        role="img"
        aria-label="Evaluation graph"
      >
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#3d3a37" strokeWidth="0.5" />
        {points && (
          <polyline
            fill="none"
            stroke="#81b64c"
            strokeWidth="1.5"
            strokeLinejoin="round"
            points={points}
          />
        )}
        {evals.map((cp, i) => {
          if (cp === null) return null;
          const x = i * step;
          const y = evalToY(cp, height);
          const active = i === currentPly;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={active ? 2.2 : 1.2}
              className={clsx(active ? "fill-accent" : "fill-gray-500 hover:fill-gray-300")}
              onClick={() => onSelectPly(i)}
            />
          );
        })}
      </svg>
    </div>
  );
}
