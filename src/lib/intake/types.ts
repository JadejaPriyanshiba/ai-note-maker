import { KnowledgeSourceType } from "../../types";

// Pipeline-internal working shapes for the Knowledge Intake wizard. These never get persisted
// as-is — only the compressed KnowledgeSource.brief (see types.ts) is ever saved.

export interface ExtractedSource {
  id: string;
  sourceType: KnowledgeSourceType;
  title: string;
  originUrl?: string;
  fileName?: string;
  text: string; // normalized plain text
  wordCount: number;
  contentHash: string;
}

export interface TextChunk {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: KnowledgeSourceType;
  heading?: string;
  text: string;
  wordCount: number;
  order: number;
}

export interface ConfidenceResult {
  score: number; // 0-100
  reasons: string[];
}
