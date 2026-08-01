import { ContentProvider, ContentProviderOptions, providerRegistry } from "./ContentProvider";
import { LearningContent } from "../../types";

// In-memory cache to prevent unnecessary API calls and quota usage
const youtubeCache = new Map<string, { timestamp: number; results: LearningContent[] }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export class YouTubeProvider implements ContentProvider {
  readonly name = "youtube";

  async search(keyword: string, options?: ContentProviderOptions): Promise<LearningContent[]> {
    const cleanKeyword = keyword.trim();
    if (!cleanKeyword) return [];

    const limit = options?.limit || 6;
    const cacheKey = `${cleanKeyword.toLowerCase()}_${JSON.stringify(options?.filters || {})}_${limit}`;

    // 1. Check in-memory cache
    const cached = youtubeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.results;
    }

    try {
      // 2. Call server-side YouTube search proxy endpoint
      const res = await fetch("/api/youtube/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: cleanKeyword,
          limit,
          filters: options?.filters,
        }),
      });

      if (!res.ok) {
        throw new Error(`YouTube API request failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !Array.isArray(data.items)) {
        throw new Error(data.error || "Failed to retrieve educational videos from YouTube.");
      }

      // 3. Deduplicate results by video ID
      const seenIds = new Set<string>();
      const results: LearningContent[] = [];

      for (const item of data.items) {
        if (!item.providerContentId || seenIds.has(item.providerContentId)) continue;
        seenIds.add(item.providerContentId);

        results.push({
          id: `yt_${item.providerContentId}_${Math.random().toString(36).substring(2, 7)}`,
          provider: "youtube",
          providerContentId: item.providerContentId,
          title: item.title || "Educational Video",
          description: item.description || "",
          thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${item.providerContentId}/hqdefault.jpg`,
          channelName: item.channelName || "Educational Channel",
          duration: item.duration || "05:00",
          durationSeconds: item.durationSeconds || 300,
          publishedAt: item.publishedAt,
          url: item.url || `https://www.youtube.com/watch?v=${item.providerContentId}`,
          matchedKeyword: cleanKeyword,
          language: options?.filters?.language || "English",
          contentType: options?.filters?.content || "Explanation",
        });
      }

      // 4. Cache valid results
      if (results.length > 0) {
        youtubeCache.set(cacheKey, { timestamp: Date.now(), results });
      }

      return results;
    } catch (error: any) {
      console.warn(`[YouTubeProvider] Search error for "${keyword}":`, error);
      return [];
    }
  }

  clearCache(): void {
    youtubeCache.clear();
  }
}

// Instantiate and register YouTube provider as default
export const youtubeProvider = new YouTubeProvider();
providerRegistry.register(youtubeProvider);
providerRegistry.setDefaultProvider("youtube");
