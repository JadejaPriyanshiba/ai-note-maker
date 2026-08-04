import { NoteBlockImage } from "../types";

// Non-AI route (server-side proxy to Google's Custom Search JSON API) — lives outside
// aiService.ts since it never touches Gemini and shouldn't count against AI request stats.
export async function searchTopicImages(query: string, count: number = 3): Promise<NoteBlockImage[]> {
  const res = await fetch("/api/images/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, count }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Image search failed");
  }
  return data.images as NoteBlockImage[];
}
