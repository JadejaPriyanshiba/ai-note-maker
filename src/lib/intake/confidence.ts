import { TextChunk, ConfidenceResult } from "./types";

const FILLER_WORDS = new Set([
  "please", "make", "notes", "note", "about", "on", "for", "me", "some", "a", "the", "of",
  "learn", "study", "want", "need", "help", "with", "i", "to",
]);

function meaningfulWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !FILLER_WORDS.has(w));
}

// Purely deterministic — no LLM call. Combines how specific the user's prompt is, how much
// relevant source material backs it, and how well the two line up lexically. Feeds the single
// intake-brief LLM call as a hint; the model still makes the final call on whether to ask a
// clarifying question, but this keeps that decision grounded in a measurable signal instead of
// the model's own (unreliable) self-assessment alone.
export function computeConfidence(prompt: string, chunks: TextChunk[]): ConfidenceResult {
  const reasons: string[] = [];

  const promptWords = meaningfulWords(prompt);
  const specificity = Math.min(40, promptWords.length * 8);
  if (promptWords.length === 0) {
    reasons.push("No specific subject terms found in the prompt.");
  } else if (promptWords.length < 3) {
    reasons.push("Prompt is very short/generic.");
  }

  const totalSourceWords = chunks.reduce((sum, c) => sum + c.wordCount, 0);
  const coverage = Math.min(35, Math.round((totalSourceWords / 600) * 35));
  if (chunks.length === 0) {
    reasons.push("No source material provided.");
  } else if (totalSourceWords < 150) {
    reasons.push("Source material is thin.");
  }

  let alignment = 0;
  if (promptWords.length > 0 && chunks.length > 0) {
    const promptSet = new Set(promptWords);
    const sourceWords = new Set(chunks.flatMap((c) => meaningfulWords(c.text)));
    const overlap = [...promptSet].filter((w) => sourceWords.has(w)).length;
    const ratio = overlap / promptSet.size;
    alignment = Math.round(ratio * 25);
    if (ratio < 0.15) {
      reasons.push("Prompt and source material don't overlap much — sources may be off-topic.");
    }
  } else if (chunks.length > 0) {
    // Sources alone, no descriptive prompt — plausible (e.g. "just make notes from this PDF"),
    // so don't penalize alignment, just don't award points for a match that can't be checked.
    alignment = 15;
  }

  const score = Math.max(0, Math.min(100, specificity + coverage + alignment));
  return { score, reasons };
}
