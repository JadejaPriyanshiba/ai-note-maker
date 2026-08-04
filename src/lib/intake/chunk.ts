import { ExtractedSource, TextChunk } from "./types";
import { countWords } from "./normalize";

const TARGET_CHUNK_WORDS = 180;
const MAX_CHUNK_WORDS = 260;

// A line reads as a heading if it's short, has no terminal sentence punctuation, and isn't
// itself part of a longer wrapped sentence — covers markdown '#' headings, HTML-derived
// all-caps/title-case section labels, and PDF text-layer lines that were originally headings.
function looksLikeHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^#+\s*/, "");
  if (stripped.length < 3 || stripped.length > 90) return null;
  if (/[.!?;:,]$/.test(stripped)) return null;
  const wordCount = countWords(stripped);
  if (wordCount > 12) return null;
  const isMarkdownHeading = /^#+\s/.test(trimmed);
  const isAllCapsOrTitle = /^[A-Z0-9][A-Za-z0-9 ,'&/()-]*$/.test(stripped) && wordCount <= 8;
  return isMarkdownHeading || isAllCapsOrTitle ? stripped : null;
}

// Splits normalized source text into token-budgeted chunks, preferring paragraph boundaries and
// tracking the nearest preceding heading as metadata so retrieval results stay attributable
// (which source, which section) rather than being anonymous blobs of text.
export function chunkSource(source: ExtractedSource): TextChunk[] {
  const paragraphs = source.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: TextChunk[] = [];

  let currentHeading: string | undefined;
  let buffer: string[] = [];
  let bufferWords = 0;
  let order = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join("\n\n");
    chunks.push({
      id: `${source.id}_chunk_${order}`,
      sourceId: source.id,
      sourceTitle: source.title,
      sourceType: source.sourceType,
      heading: currentHeading,
      text,
      wordCount: countWords(text),
      order: order++,
    });
    buffer = [];
    bufferWords = 0;
  };

  for (const paragraph of paragraphs) {
    const heading = looksLikeHeading(paragraph);
    if (heading) {
      flush();
      currentHeading = heading;
      continue;
    }

    const paragraphWords = countWords(paragraph);
    if (bufferWords > 0 && bufferWords + paragraphWords > MAX_CHUNK_WORDS) {
      flush();
    }
    buffer.push(paragraph);
    bufferWords += paragraphWords;
    if (bufferWords >= TARGET_CHUNK_WORDS) {
      flush();
    }
  }
  flush();

  return chunks;
}

export function chunkSources(sources: ExtractedSource[]): TextChunk[] {
  return sources.flatMap(chunkSource);
}
