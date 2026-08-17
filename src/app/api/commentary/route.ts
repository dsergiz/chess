import { NextResponse } from "next/server";
import { mergePositionCommentary } from "@/lib/commentary/coachEngineCompare";
import { generatePositionCommentary } from "@/lib/commentary/generator";
import { buildMinimalCoachPrompt, coachResponseNamesColor, trimCoachResponse } from "@/lib/commentary/llmPrompt";
import { generateWithOllama, isOllamaConfigured } from "@/lib/commentary/ollama";
import type { ImportedGame, MultiEngineAnalysis } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      game,
      ply,
      consensus,
      isVariation,
    }: {
      game: ImportedGame;
      ply: number;
      consensus: MultiEngineAnalysis;
      isVariation?: boolean;
    } = body;

    if (!game || !consensus) {
      return NextResponse.json({ error: "Missing game or analysis" }, { status: 400 });
    }

    const ruleBased = generatePositionCommentary(game, ply, consensus, { isVariation });

    if (!isOllamaConfigured()) {
      const merged = mergePositionCommentary(ruleBased, consensus, null);
      return NextResponse.json({
        commentary: merged,
        source: "rules",
        llmAvailable: false,
        alignment: merged.alignment,
      });
    }

    const prompt = buildMinimalCoachPrompt(consensus);
    const ollama = await generateWithOllama(prompt);

    if (!ollama.text) {
      const merged = mergePositionCommentary(ruleBased, consensus, null);
      return NextResponse.json({
        commentary: merged,
        source: "rules",
        llmAvailable: true,
        llmError: ollama.error ?? "Local model unavailable — using rule-based commentary",
        alignment: merged.alignment,
      });
    }

    const trimmed = trimCoachResponse(ollama.text);
    // The prompt/system message forbid naming a color; if the model ignores that, don't merge
    // its text in at all — a coach line about the wrong side is worse than no coach line.
    const coachLine = coachResponseNamesColor(trimmed) ? null : trimmed;
    const merged = mergePositionCommentary(ruleBased, consensus, coachLine);

    return NextResponse.json({
      commentary: merged,
      source: merged.source,
      llmAvailable: true,
      llmError: coachLine ? undefined : "Coach reply named a color despite instructions — using rule-based commentary",
      alignment: merged.alignment,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Commentary failed" },
      { status: 500 }
    );
  }
}
