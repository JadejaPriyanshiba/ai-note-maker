import { ExtractedSource } from "./types";
import { KnowledgeSourceType } from "../../types";

// Collapse whitespace/control-char noise from extracted text (PDF text layers and HTML
// extraction both produce ragged spacing) without touching actual words — this is layout
// cleanup, not the meaning-preserving compression step (that happens later, once, in the
// single intake-brief LLM call).
export function normalizeText(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ") // collapse runs of horizontal whitespace
    .replace(/\n{3,}/g, "\n\n") // collapse excessive blank lines
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

// Fast, non-cryptographic hash (FNV-1a) for de-duplication only — not a security boundary, so
// this stays synchronous and dependency-free rather than reaching for Web Crypto.
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function buildExtractedSource(
  id: string,
  sourceType: KnowledgeSourceType,
  title: string,
  rawText: string,
  origin: { originUrl?: string; fileName?: string } = {}
): ExtractedSource {
  const text = normalizeText(rawText);
  return {
    id,
    sourceType,
    title,
    ...origin,
    text,
    wordCount: countWords(text),
    contentHash: hashText(text),
  };
}

// Drops sources whose normalized text hash matches one already seen (e.g. the same article
// pasted as both a URL and a copy-pasted text block) — skips re-chunking/re-indexing cost for
// content we've already processed in this session.
export function dedupeSources(sources: ExtractedSource[]): ExtractedSource[] {
  const seen = new Set<string>();
  const result: ExtractedSource[] = [];
  for (const source of sources) {
    if (seen.has(source.contentHash)) continue;
    seen.add(source.contentHash);
    result.push(source);
  }
  return result;
}
