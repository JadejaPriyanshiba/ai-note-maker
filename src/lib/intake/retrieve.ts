import { TextChunk } from "./types";

// Deterministic lexical retrieval (Okapi BM25) — deliberately not embeddings-based. This app has
// no vector store and per-project token-optimization guidance is to never call an LLM (or a paid
// embeddings API) when deterministic processing is sufficient. A short stopword list here is a
// standard BM25 tokenization detail, not the compression strategy itself — meaning-preserving
// compression happens once, downstream, in the single intake-brief LLM call.
const STOPWORDS = new Set([
  "a", "an", "the", "of", "to", "in", "on", "for", "and", "or", "is", "are", "was", "were",
  "be", "been", "with", "as", "at", "by", "this", "that", "it", "from", "into", "such", "than",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t)
  );
}

interface IndexedChunk {
  chunk: TextChunk;
  termFrequency: Map<string, number>;
  length: number;
}

export interface BM25Index {
  chunks: IndexedChunk[];
  documentFrequency: Map<string, number>;
  avgLength: number;
  totalChunks: number;
}

const K1 = 1.5;
const B = 0.75;

export function buildIndex(chunks: TextChunk[]): BM25Index {
  const documentFrequency = new Map<string, number>();
  const indexed: IndexedChunk[] = chunks.map((chunk) => {
    const tokens = tokenize(`${chunk.heading || ""} ${chunk.text}`);
    const termFrequency = new Map<string, number>();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }
    for (const token of termFrequency.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
    }
    return { chunk, termFrequency, length: tokens.length };
  });

  const totalChunks = indexed.length;
  const avgLength = totalChunks > 0 ? indexed.reduce((sum, c) => sum + c.length, 0) / totalChunks : 0;

  return { chunks: indexed, documentFrequency, avgLength, totalChunks };
}

// Returns the top-K chunks most relevant to `queryText`, highest score first. Chunks that score
// zero (no term overlap at all) are excluded rather than padding out the result.
export function queryIndex(index: BM25Index, queryText: string, topK: number): TextChunk[] {
  const queryTokens = Array.from(new Set(tokenize(queryText)));
  if (queryTokens.length === 0 || index.totalChunks === 0) return [];

  const scored = index.chunks.map(({ chunk, termFrequency, length }) => {
    let score = 0;
    for (const token of queryTokens) {
      const tf = termFrequency.get(token) || 0;
      if (tf === 0) continue;
      const df = index.documentFrequency.get(token) || 0;
      const idf = Math.log(1 + (index.totalChunks - df + 0.5) / (df + 0.5));
      const denom = tf + K1 * (1 - B + (B * length) / (index.avgLength || 1));
      score += idf * ((tf * (K1 + 1)) / (denom || 1));
    }
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}
