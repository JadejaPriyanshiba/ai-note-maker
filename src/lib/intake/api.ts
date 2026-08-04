import { KnowledgeSourceType } from "../../types";

export interface FetchUrlResult {
  sourceType: KnowledgeSourceType;
  title: string;
  text: string;
  originUrl: string;
  cached?: boolean;
}

// Non-AI route (server-side fetch + Readability extraction, or official YouTube metadata) —
// lives here rather than in aiService.ts since it never touches Gemini.
export async function fetchUrlSource(url: string): Promise<FetchUrlResult> {
  const res = await fetch("/api/intake/fetch-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || `Failed to fetch "${url}"`);
  }
  return data as FetchUrlResult;
}
