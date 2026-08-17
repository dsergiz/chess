"use client";

import { useRef, useState } from "react";
import type { PdfExtractionResult } from "@/types/puzzle";

interface PdfImportPanelProps {
  onExtracted: (result: PdfExtractionResult) => void;
}

export function PdfImportPanel({ onExtracted }: PdfImportPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/puzzles/import-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to process PDF");
      const result = data as PdfExtractionResult;
      if (result.candidates.length === 0) {
        throw new Error("No move sequences found in this PDF — try a different chapter/page range");
      }
      onExtracted(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel p-4 space-y-3" data-testid="pdf-import-panel">
      <div>
        <h2 className="font-semibold text-gray-200">Import from a book PDF</h2>
        <p className="text-xs text-gray-500 mt-1">
          Extracts games from the PDF&apos;s text layer — diagrams aren&apos;t read, only printed move
          lists (e.g. annotated-game books like <em>Simple Chess</em> or <em>The Amateur&apos;s Mind</em>).
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        data-testid="pdf-file-input"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        data-testid="pdf-upload-button"
        className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-muted text-white font-semibold disabled:opacity-50 transition-all min-h-[44px] touch-manipulation text-sm"
      >
        {loading ? "Extracting…" : "Choose PDF"}
      </button>

      {fileName && !error && !loading && (
        <p className="text-xs text-gray-500 truncate">{fileName}</p>
      )}
      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg" data-testid="pdf-import-error">
          {error}
        </p>
      )}
    </div>
  );
}
