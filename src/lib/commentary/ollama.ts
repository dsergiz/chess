export interface OllamaGenerateResult {
  text: string | null;
  error?: string;
}

import { CHESS_COACH_SYSTEM } from "./llmPrompt";

export async function generateWithOllama(
  prompt: string,
  options?: { baseUrl?: string; model?: string }
): Promise<OllamaGenerateResult> {
  const baseUrl = (options?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(
    /\/$/,
    ""
  );
  const model = options?.model ?? process.env.OLLAMA_MODEL ?? "chess-coach";

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: CHESS_COACH_SYSTEM },
          { role: "user", content: prompt },
        ],
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 48,
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      return { text: null, error: `Ollama HTTP ${res.status}` };
    }

    const data = (await res.json()) as { message?: { content?: string } };
    const text = data.message?.content?.trim();
    return text ? { text } : { text: null, error: "Empty Ollama response" };
  } catch (err) {
    return {
      text: null,
      error: err instanceof Error ? err.message : "Ollama unreachable",
    };
  }
}

export function isOllamaConfigured(): boolean {
  return process.env.COMMENTARY_LLM !== "off";
}
