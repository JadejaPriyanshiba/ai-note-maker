import { ExtractedSource, TextChunk } from "./types";
import { KnowledgeSourceType } from "../../types";
import { chunkSources } from "./chunk";
import { buildIndex, queryIndex } from "./retrieve";

const TOTAL_BUDGET_WORDS = 4500; // ~6k tokens — keeps the single intake-brief call cheap regardless of source count
const MIN_WORDS_PER_SOURCE = 120;

export interface AssembledSource {
  title: string;
  sourceType: KnowledgeSourceType;
  chunks: { heading?: string; text: string }[];
}

export interface AssembledContext {
  sources: AssembledSource[];
  chunks: TextChunk[]; // all chunks actually selected, for confidence scoring
}

// Retrieval-first, adaptive-budget context assembly: each source is chunked, ranked against the
// user's prompt via BM25, and only the top chunks — within a shrinking per-source word budget as
// source count grows — are kept. This is what keeps a 5-PDF intake from linearly blowing up
// token cost, and it's the only place "which text reaches the LLM" gets decided.
export function assembleContext(sources: ExtractedSource[], prompt: string): AssembledContext {
  if (sources.length === 0) return { sources: [], chunks: [] };

  const perSourceBudget = Math.max(MIN_WORDS_PER_SOURCE, Math.floor(TOTAL_BUDGET_WORDS / sources.length));
  const assembled: AssembledSource[] = [];
  const allSelectedChunks: TextChunk[] = [];

  for (const source of sources) {
    const sourceChunks = chunkSources([source]);
    if (sourceChunks.length === 0) continue;

    const index = buildIndex(sourceChunks);
    const ranked = prompt.trim() ? queryIndex(index, prompt, sourceChunks.length) : [];
    const ordered = ranked.length > 0 ? ranked : sourceChunks; // no prompt match (or no prompt) -> fall back to source order

    const selected: TextChunk[] = [];
    let budget = perSourceBudget;
    for (const chunk of ordered) {
      if (budget <= 0) break;
      selected.push(chunk);
      budget -= chunk.wordCount;
    }
    if (selected.length === 0) selected.push(ordered[0]);

    allSelectedChunks.push(...selected);
    assembled.push({
      title: source.title,
      sourceType: source.sourceType,
      chunks: selected
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ heading: c.heading, text: c.text })),
    });
  }

  return { sources: assembled, chunks: allSelectedChunks };
}
