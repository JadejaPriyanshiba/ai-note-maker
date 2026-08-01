import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = 3000;

// Helper to get GenAI instance (supports BYOK via x-user-api-key header or body)
function getGenAI(req: Request) {
  const userApiKey = (req.headers["x-user-api-key"] as string) || req.body?.userApiKey;
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please set process.env.GEMINI_API_KEY or provide your own key in Settings.");
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Call Gemini API with automatic exponential backoff retry for transient errors (429 Rate Limits, 503 High Demand, etc.)
async function generateWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  maxRetries = 5,
  baseDelayMs = 2500
) {
  let attempt = 0;
  const primaryModel = params.model || "gemini-3.6-flash";
  const fallbackModels = ["gemini-2.5-flash", "gemini-1.5-flash"];

  while (attempt < maxRetries) {
    try {
      // Use fallback models if primary model is experiencing sustained high demand/503
      const currentModel = attempt >= 2 && fallbackModels.length > 0
        ? fallbackModels[(attempt - 2) % fallbackModels.length]
        : primaryModel;

      const currentParams = { ...params, model: currentModel };
      return await ai.models.generateContent(currentParams);
    } catch (err: any) {
      attempt++;
      const errMsg = (err?.message || "").toLowerCase();
      const errStatus = err?.status || err?.code;

      const isTransientError =
        errStatus === 429 ||
        errStatus === 503 ||
        errStatus === 500 ||
        errStatus === 502 ||
        errStatus === 504 ||
        errMsg.includes("429") ||
        errMsg.includes("503") ||
        errMsg.includes("resource_exhausted") ||
        errMsg.includes("unavailable") ||
        errMsg.includes("high demand") ||
        errMsg.includes("quota exceeded") ||
        errMsg.includes("rate-limits") ||
        errMsg.includes("overloaded") ||
        errMsg.includes("temporarily") ||
        errMsg.includes("spikes in demand") ||
        errMsg.includes("deadline");

      if (isTransientError && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(1.5, attempt - 1) + Math.random() * 1000;
        console.warn(`[Gemini API Transient Error ${errStatus || '503/429'}] Retrying request (attempt ${attempt}/${maxRetries}) in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Gemini API request failed after rate limit and high-demand retries.");
}

// Safely parse JSON from model output
function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    let clean = text.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/i, "").replace(/\s*```$/i, "");
    }
    return JSON.parse(clean);
  } catch (err) {
    console.error("JSON parse error:", err, "Raw text:", text);
    return fallback;
  }
}

// ==================== YOUTUBE SEARCH (Shorts Learning) ==================== //

// Server-side cache to avoid re-hitting YouTube for the same keyword/filters (quota-conscious)
const youtubeSearchCache = new Map<string, { timestamp: number; items: any[] }>();
const YOUTUBE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function parseIsoDuration(iso?: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Precise post-filter since YouTube's own "videoDuration" param is coarse (short/medium/long only)
function durationBucketMatches(durationSeconds: number, bucket?: string): boolean {
  switch (bucket) {
    case "< 1 min": return durationSeconds > 0 && durationSeconds < 60;
    case "1–3 min": return durationSeconds >= 60 && durationSeconds <= 180;
    case "3–5 min": return durationSeconds > 180 && durationSeconds <= 300;
    case "5–10 min": return durationSeconds > 300 && durationSeconds <= 600;
    default: return true; // 'Any' or unspecified
  }
}

const YOUTUBE_LANGUAGE_CODES: Record<string, string> = {
  English: "en",
  Hindi: "hi",
  Gujarati: "gu",
  Hinglish: "hi",
};

// Search YouTube for short educational videos matching a learning-node keyword.
// Prefers official YouTube Data API v3 only — no scraping. Caches + limits + dedupes
// results server-side to stay within free-tier quota.
app.post("/api/youtube/search", async (req: Request, res: Response) => {
  try {
    const { keyword, limit, filters } = req.body || {};
    const cleanKeyword = (keyword || "").trim();
    if (!cleanKeyword) {
      return res.status(400).json({ success: false, error: "A search keyword is required." });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "YouTube API key is not configured on the server. Set YOUTUBE_API_KEY to enable Shorts Learning.",
      });
    }

    const maxResults = Math.min(Math.max(Number(limit) || 6, 1), 10);
    const cacheKey = `${cleanKeyword.toLowerCase()}_${JSON.stringify(filters || {})}_${maxResults}`;
    const cached = youtubeSearchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < YOUTUBE_CACHE_TTL_MS) {
      return res.json({ success: true, items: cached.items, cached: true });
    }

    // 'short' = only short-form (<=shortsMaxDurationSeconds); 'long' = only regular-length
    // (excludes short-form); 'hybrid' = both, no restriction. Defaults to 'long' to preserve
    // the original (pre-Shorts-filter) search behavior.
    const contentFormat: "short" | "long" | "hybrid" = filters?.contentFormat || "long";
    const shortsMaxSeconds = Math.min(Math.max(Number(filters?.shortsMaxDurationSeconds) || 60, 15), 180);

    // Augment the query for educational relevance (spec: prioritize educational relevance)
    let query = cleanKeyword;
    if (filters?.content && filters.content !== "Any") query += ` ${filters.content}`;
    if (filters?.difficulty && filters.difficulty !== "Mixed") query += ` ${filters.difficulty}`;
    // YouTube Data API v3 has no official "Shorts only" filter. Best-effort proxy: bias the
    // query toward videos hash-tagged as Shorts and require <=shortsMaxSeconds duration (post-
    // filtered below). This is a heuristic, not a guarantee.
    if (contentFormat === "short") query += " #shorts";

    const searchParams = new URLSearchParams({
      part: "snippet",
      type: "video",
      q: query,
      maxResults: String(Math.min(maxResults * 2, 15)), // overfetch a bit to survive post-filtering
      safeSearch: "strict",
      videoEmbeddable: "true",
      key: apiKey,
    });

    if (contentFormat === "short") {
      searchParams.set("videoDuration", "short");
    } else if (contentFormat === "long") {
      if (filters?.duration && ["< 1 min", "1–3 min", "3–5 min"].includes(filters.duration)) {
        searchParams.set("videoDuration", "short");
      } else if (filters?.duration === "5–10 min") {
        searchParams.set("videoDuration", "medium");
      }
    }
    // 'hybrid': no videoDuration hint — let both short and long-form surface naturally.

    const langCode = filters?.language && filters.language !== "Any" ? YOUTUBE_LANGUAGE_CODES[filters.language] : undefined;
    if (langCode) searchParams.set("relevanceLanguage", langCode);

    if (filters?.freshness && filters.freshness !== "Any" && filters.freshness !== "Custom") {
      const days = filters.freshness === "Last 7 days" ? 7 : filters.freshness === "Last 30 days" ? 30 : 365;
      searchParams.set("publishedAfter", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
    }

    const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`);
    if (!searchRes.ok) {
      if (searchRes.status === 403 || searchRes.status === 429) {
        return res.status(429).json({
          success: false,
          error: "YouTube API quota exceeded or access forbidden. Please try again later.",
        });
      }
      const errBody = await searchRes.json().catch(() => ({} as any));
      return res.status(502).json({ success: false, error: errBody?.error?.message || "YouTube search request failed." });
    }
    const searchData = await searchRes.json();
    const videoIds: string[] = (searchData.items || [])
      .map((item: any) => item.id?.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) {
      youtubeSearchCache.set(cacheKey, { timestamp: Date.now(), items: [] });
      return res.json({ success: true, items: [] });
    }

    const videosParams = new URLSearchParams({
      part: "contentDetails,snippet",
      id: videoIds.join(","),
      key: apiKey,
    });
    const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${videosParams.toString()}`);
    if (!videosRes.ok) {
      return res.status(502).json({ success: false, error: "Failed to retrieve video details from YouTube." });
    }
    const videosData = await videosRes.json();

    const seenIds = new Set<string>();
    const items = (videosData.items || [])
      .map((v: any) => {
        const durationSeconds = parseIsoDuration(v.contentDetails?.duration);
        return {
          providerContentId: v.id as string,
          title: v.snippet?.title as string,
          description: (v.snippet?.description as string) || "",
          thumbnailUrl:
            v.snippet?.thumbnails?.medium?.url ||
            v.snippet?.thumbnails?.default?.url ||
            `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          channelName: (v.snippet?.channelTitle as string) || "Educational Channel",
          duration: formatDuration(durationSeconds),
          durationSeconds,
          publishedAt: v.snippet?.publishedAt as string | undefined,
          url: `https://www.youtube.com/watch?v=${v.id}`,
        };
      })
      .filter((item: any) => {
        if (!item.providerContentId || seenIds.has(item.providerContentId)) return false;
        seenIds.add(item.providerContentId);
        if (contentFormat === "short") return item.durationSeconds > 0 && item.durationSeconds <= shortsMaxSeconds;
        if (contentFormat === "long") {
          return item.durationSeconds > shortsMaxSeconds && durationBucketMatches(item.durationSeconds, filters?.duration);
        }
        return true; // hybrid: keep both short- and long-form results
      })
      .slice(0, maxResults);

    youtubeSearchCache.set(cacheKey, { timestamp: Date.now(), items });
    res.json({ success: true, items });
  } catch (error: any) {
    console.error("YouTube search error:", error);
    res.status(500).json({ success: false, error: error.message || "YouTube search failed." });
  }
});

// API Health
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Test Gemini API Key Connection
app.post("/api/ai/test-key", async (req: Request, res: Response) => {
  try {
    const ai = getGenAI(req);
    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: "Reply with 'API Key is working perfectly!' in 5 words or less.",
    });
    res.json({ success: true, message: response.text?.trim() || "Connected successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || "Failed to verify API key" });
  }
});

// Generate Learning Roadmap
app.post("/api/ai/roadmap", async (req: Request, res: Response) => {
  try {
    const { subject, mainTopic, learnerLevel, complexity, depth, language, instructions } = req.body;
    const ai = getGenAI(req);

    const prompt = `
Create a comprehensive study roadmap for:
Subject: ${subject}
Topic: ${mainTopic || subject}
Learner Level: ${learnerLevel || 'Undergraduate'}
Complexity: ${complexity || 'Medium'}
Target Depth: ${depth || 'Standard notes'}
Language: ${language || 'English'}
Additional Instructions: ${instructions || 'Focus on clarity, logical progression, and practical concepts.'}

Return a structured JSON list of 6 to 10 sequential topics that cover this subject logically.
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert curriculum designer and educational specialist. Return ONLY valid JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Title of the study topic" },
              description: { type: Type.STRING, description: "Brief 1-2 sentence summary of what will be learned" },
              estimatedMinutes: { type: Type.NUMBER, description: "Estimated study time in minutes (e.g. 15, 20, 30)" }
            },
            required: ["title", "description"]
          }
        }
      }
    });

    const parsed = safeJsonParse(response.text || "[]", []);
    res.json({ success: true, roadmap: parsed });
  } catch (error: any) {
    console.error("Roadmap error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate roadmap" });
  }
});

// AI Suggest Topics for Existing Roadmap
app.post("/api/ai/suggest-topics", async (req: Request, res: Response) => {
  try {
    const { subject, existingTopics } = req.body;
    const ai = getGenAI(req);

    const prompt = `
Subject: ${subject}
Current Topics: ${existingTopics.join(", ")}

Suggest 3 to 5 additional relevant study topics that would enhance or complete this curriculum.
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              estimatedMinutes: { type: Type.NUMBER }
            },
            required: ["title", "description"]
          }
        }
      }
    });

    const parsed = safeJsonParse(response.text || "[]", []);
    res.json({ success: true, suggestedTopics: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to suggest topics" });
  }
});

// Generate Notes for Single Topic
app.post("/api/ai/topic-notes", async (req: Request, res: Response) => {
  try {
    const { subject, topicTitle, topicDescription, learnerLevel, complexity, depth, language, instructions } = req.body;
    const ai = getGenAI(req);

    const prompt = `
Generate thorough, structured study notes for ONE topic.

Subject: ${subject}
Topic: ${topicTitle}
Topic Summary: ${topicDescription || ''}
Learner Level: ${learnerLevel || 'Undergraduate'}
Complexity: ${complexity || 'Medium'}
Depth: ${depth || 'Standard notes'}
Language: ${language || 'English'}
Custom Instructions: ${instructions || 'Provide clear explanations, key formulas or architecture, real-world examples, and exam highlights.'}

Provide a section with a summary and structured blocks.
Block types available:
- 'heading': level 1, 2, or 3
- 'paragraph': clear educational text
- 'bullet_list': array of string items
- 'numbered_list': array of string items
- 'checklist': array of string items
- 'quote': inspirational/key takeaway quote
- 'callout': important highlight box
- 'code': snippet with language (if applicable)
- 'table': matrix table with tableData 2D array [headers, row1, row2]
- 'student_tag': tagType ('important', 'remember', 'doubt', 'example', 'exam_point') with content text.

Make the notes engaging, well-formatted, student-friendly, and educational.
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a world-class university tutor. Generate rich, structured educational note blocks in JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Quick 2-sentence topic summary" },
            blocks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { 
                    type: Type.STRING, 
                    description: "heading, paragraph, bullet_list, numbered_list, checklist, quote, callout, code, table, or student_tag" 
                  },
                  content: { type: Type.STRING, description: "Main text content" },
                  level: { type: Type.NUMBER, description: "1, 2, or 3 for headings" },
                  items: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Items for list block" },
                  tagType: { type: Type.STRING, description: "important, remember, doubt, example, or exam_point for student_tag block" },
                  tableData: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    description: "Rows for table block"
                  },
                  language: { type: Type.STRING, description: "Code language if code block" }
                },
                required: ["type", "content"]
              }
            }
          },
          required: ["summary", "blocks"]
        }
      }
    });

    const parsed = safeJsonParse(response.text || "{}", { summary: "", blocks: [] });
    if (!parsed.blocks || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      return res.status(500).json({
        success: false,
        error: `AI response did not generate note blocks for "${topicTitle}". Please retry or skip this topic.`,
      });
    }
    res.json({ success: true, topicTitle, notes: parsed });
  } catch (error: any) {
    console.error("Topic notes error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate topic notes" });
  }
});

// Inline AI Selection Action
app.post("/api/ai/selection-action", async (req: Request, res: Response) => {
  try {
    const { action, selectedText, contextTopic, language, userPrompt } = req.body;
    const ai = getGenAI(req);

    let systemPrompt = "You are a helpful AI study assistant modifying text in a note.";
    let userInstruction = "";

    switch (action) {
      case "explain_simply":
        userInstruction = `Explain the following text in simple terms suitable for a student:\n"${selectedText}"`;
        break;
      case "simplify":
        userInstruction = `Simplify and condense the following text while keeping all key facts:\n"${selectedText}"`;
        break;
      case "expand":
        userInstruction = `Provide more detail, depth, and context for the following passage:\n"${selectedText}"`;
        break;
      case "give_example":
        userInstruction = `Provide 2 concrete real-world examples illustrating the following concept:\n"${selectedText}"`;
        break;
      case "create_analogy":
        userInstruction = `Create an intuitive, memorable analogy to help understand:\n"${selectedText}"`;
        break;
      case "make_exam_answer":
        userInstruction = `Reformat the following text into a bulleted 5-mark high-scoring exam answer:\n"${selectedText}"`;
        break;
      case "create_flashcard":
        userInstruction = `Create 2 flashcards (Question & Answer pairs) based on:\n"${selectedText}"`;
        break;
      case "translate":
        userInstruction = `Translate the following text into ${language || 'Hindi'}:\n"${selectedText}"`;
        break;
      case "ask_ai":
      default:
        userInstruction = `Regarding this context: "${selectedText}"\nUser query: ${userPrompt || 'Clarify this concept'}`;
        break;
    }

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: userInstruction,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    res.json({ success: true, result: response.text?.trim() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "AI action failed" });
  }
});

// Generate Assessment Questions
app.post("/api/ai/generate-test", async (req: Request, res: Response) => {
  try {
    const { subject, topics, questionCount, difficulty, questionTypes, contentContext } = req.body;
    const ai = getGenAI(req);

    const prompt = `
Generate a practice test for subject: ${subject}
Topics included: ${JSON.stringify(topics)}
Total Questions required: ${questionCount || 10}
Difficulty: ${difficulty || 'Medium'}
Question Types requested: ${JSON.stringify(questionTypes || ['mcq', 'true_false', 'fill_blank'])}
${contentContext ? `Source Context / Learning Notes / Weak Areas:\n"${contentContext.substring(0, 4000)}"` : ''}

Requirements:
- Map every question to one of the provided topic titles and topic IDs.
- For 'mcq': provide exactly 4 options array (A, B, C, D) and specify the exact correct answer (e.g. "A: ...").
- For 'true_false': correct answer MUST be "True" or "False".
- For 'fill_blank' and 'one_word': provide clear correct answer text.
- Provide a brief 1-2 sentence educational explanation for why the answer is correct.
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert examiner. Generate accurate, well-crafted test questions in JSON format.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topicId: { type: Type.STRING },
              topicTitle: { type: Type.STRING },
              type: { type: Type.STRING, description: "mcq, true_false, fill_blank, or one_word" },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 options for MCQ" },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["topicId", "topicTitle", "type", "question", "correctAnswer", "explanation"]
          }
        }
      }
    });

    const parsed = safeJsonParse(response.text || "[]", []);
    const questionsWithIds = (Array.isArray(parsed) ? parsed : []).map((q: any, i: number) => ({
      id: q.id || `q_${Date.now()}_${i}`,
      ...q,
    }));
    res.json({ success: true, questions: questionsWithIds });
  } catch (error: any) {
    console.error("Generate test error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate assessment" });
  }
});

// Generate Revision Plan for Weak Topics
app.post("/api/ai/revision-plan", async (req: Request, res: Response) => {
  try {
    const { subject, weakTopics } = req.body;
    const ai = getGenAI(req);

    const prompt = `
The student needs targeted revision on these weak topics for subject '${subject}':
Weak Topics: ${weakTopics.join(", ")}

Generate a focused 5-minute targeted revision guide containing:
1. summary5Min: concise clarification of core principles
2. keyConcepts: 3-5 bullet points of crucial rules/definitions
3. examples: 2 intuitive examples
4. practiceQuestions: 3 quick review Q&A pairs.
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary5Min: { type: Type.STRING },
            keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
            examples: { type: Type.ARRAY, items: { type: Type.STRING } },
            practiceQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                },
                required: ["question", "answer"]
              }
            }
          },
          required: ["summary5Min", "keyConcepts", "examples", "practiceQuestions"]
        }
      }
    });

    const parsed = safeJsonParse(response.text || "{}", {});
    res.json({ success: true, revisionPlan: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Failed to generate revision plan" });
  }
});

// Teach-Back Mode Evaluation
app.post("/api/ai/teach-back", async (req: Request, res: Response) => {
  try {
    const { topicTitle, userExplanation } = req.body;
    const ai = getGenAI(req);

    const prompt = `
Evaluate student teach-back explanation:
Topic: ${topicTitle}
Student's written explanation:
"${userExplanation}"

Analyze their understanding:
- Assign understandingPercent (0 to 100).
- List understoodPoints (concepts they got right).
- List missingPoints (crucial aspects they missed).
- List incorrectPoints (misconceptions or errors).
- Provide studyRecommendation (constructive advice in 2 sentences).
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a supportive, encouraging study mentor. Evaluate the student's self-explanation in JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            understandingPercent: { type: Type.NUMBER },
            understoodPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            incorrectPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            studyRecommendation: { type: Type.STRING }
          },
          required: ["understandingPercent", "understoodPoints", "missingPoints", "incorrectPoints", "studyRecommendation"]
        }
      }
    });

    const parsed = safeJsonParse(response.text || "{}", {});
    res.json({ success: true, evaluation: parsed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Teach-back evaluation failed" });
  }
});

// AI Podcast Script Generator
app.post("/api/ai/podcast-script", async (req: Request, res: Response) => {
  try {
    const { noteTitle, topicTitle, textContent } = req.body;
    const ai = getGenAI(req);

    const prompt = `
Convert the following study note into an engaging, conversational 2-person audio podcast script.
Note Title: ${noteTitle}
Topic: ${topicTitle}
Note Content:
"${textContent.substring(0, 3000)}"

Format as a dialogue between:
- Alex (Host): enthusiastic learner asking great questions & making analogies.
- Sam (Expert): friendly tutor explaining concepts with real-world examples.

Generate 6 to 10 back-and-forth dialogue exchanges. Keep it clear, educational, and natural to read aloud.
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING, description: "Alex (Host) or Sam (Expert)" },
              text: { type: Type.STRING, description: "Spoken line" }
            },
            required: ["speaker", "text"]
          }
        }
      }
    });

    const dialogue = safeJsonParse(response.text || "[]", []);
    res.json({ success: true, dialogue });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Podcast script generation failed" });
  }
});

// AI Flashcard Generator
app.post("/api/ai/generate-flashcards", async (req: Request, res: Response) => {
  try {
    const { topic, content, count, difficulty, focus, language } = req.body;
    const ai = getGenAI(req);

    const targetCount = Math.min(Math.max(Number(count) || 10, 1), 20);

    const prompt = `
Generate exactly ${targetCount} high-yield, educational flashcards.

Topic / Context: ${topic || 'General Learning'}
Source Material:
"${(content || '').substring(0, 4000)}"

Target Parameters:
- Difficulty: ${difficulty || 'Medium'}
- Educational Focus: ${focus || 'Key concepts & exam preparation'}
- Target Language: ${language || 'English'}

Requirements for each flashcard:
1. 'front': Clear, focused question or prompt.
2. 'back': Precise, accurate answer.
3. 'explanation': Brief 1-2 sentence breakdown or reasoning.
4. 'example': Concrete example or application where helpful.
5. 'hint': Subtle clue for recall.

Generate structured JSON array.
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a master study mentor generating precise flashcards for rapid student retention.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              front: { type: Type.STRING },
              back: { type: Type.STRING },
              explanation: { type: Type.STRING },
              example: { type: Type.STRING },
              hint: { type: Type.STRING },
            },
            required: ["front", "back"]
          }
        }
      }
    });

    const cards = safeJsonParse(response.text || "[]", []);
    res.json({ success: true, cards });
  } catch (error: any) {
    console.error("Flashcard generation error:", error);
    res.status(500).json({ success: false, error: error.message || "Flashcard generation failed" });
  }
});

// ==================== SHORTS LEARNING (Gemini) ==================== //

// Recursively build a nested Gemini responseSchema for a learning tree. Gemini schemas
// can't self-reference, so depth is bounded structurally by how many times we nest here
// (keeps schema size / token cost proportional to the user-chosen depth, capped at 4).
function buildLearningNodeSchema(remainingDepth: number): any {
  const properties: any = {
    title: { type: Type.STRING, description: "Concise, specific title for this node" },
    description: { type: Type.STRING, description: "1-2 sentence purpose/summary of this node" },
    keywords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3-5 effective, realistic YouTube search phrases for this specific node",
    },
  };
  const required = ["title", "description", "keywords"];

  if (remainingDepth > 0) {
    properties.children = {
      type: Type.ARRAY,
      items: buildLearningNodeSchema(remainingDepth - 1),
      description: "Child sub-topics. Empty array if this node is already a concrete, individually-learnable leaf item.",
    };
    required.push("children");
  }

  return { type: Type.OBJECT, properties, required };
}

// Recursively validate a nested learning-tree node has the minimum required shape.
function isValidLearningNode(n: any): boolean {
  return (
    !!n &&
    typeof n.title === "string" &&
    n.title.trim().length > 0 &&
    Array.isArray(n.keywords) &&
    (!n.children || (Array.isArray(n.children) && n.children.every(isValidLearningNode)))
  );
}

app.post("/api/ai/learning-tree", async (req: Request, res: Response) => {
  try {
    const { mainTopic, topicDescription, depth, language, difficulty } = req.body;
    if (!mainTopic || typeof mainTopic !== "string" || !mainTopic.trim()) {
      return res.status(400).json({ success: false, error: "A main topic is required." });
    }
    const ai = getGenAI(req);
    const treeDepth = Math.min(Math.max(Number(depth) || 3, 2), 4);

    const prompt = `
Create a structured learning tree (topic hierarchy) for:
Main Topic: ${mainTopic}
${topicDescription ? `Context/Description: ${topicDescription}` : ""}
Maximum Depth: ${treeDepth} levels
Language: ${language || "English"}
Difficulty: ${difficulty || "Mixed"}

Break the topic down into logical categories, then sub-categories, down to concrete, individually-learnable leaf items (e.g. "K-Means Clustering", not just "Clustering").
Leaf nodes (empty children array) MUST represent a single focused learning item that one short YouTube video could teach.
For every node (category or leaf), provide 3-5 specific, realistic YouTube search keyword phrases that would find good short educational videos for it.
Do NOT generate full notes, explanations, or content — only the tree structure and search keywords.
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction:
          "You are an expert curriculum architect. Break topics into a clean, logically-ordered, non-redundant hierarchy. Return ONLY valid JSON matching the schema.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: "Refined/normalized title for the overall topic" },
            nodes: {
              type: Type.ARRAY,
              items: buildLearningNodeSchema(treeDepth - 1),
            },
          },
          required: ["topic", "nodes"],
        },
      },
    });

    const parsed = safeJsonParse<{ topic?: string; nodes?: any[] }>(response.text || "{}", {});
    if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0 || !parsed.nodes.every(isValidLearningNode)) {
      return res.status(500).json({
        success: false,
        error: `AI did not generate a valid learning tree for "${mainTopic}". Please retry.`,
      });
    }

    res.json({ success: true, topic: parsed.topic || mainTopic, nodes: parsed.nodes });
  } catch (error: any) {
    console.error("Learning tree generation error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate learning tree" });
  }
});

app.post("/api/ai/learning-keywords", async (req: Request, res: Response) => {
  try {
    const { nodeTitle, nodeDescription, existingKeywords } = req.body;
    if (!nodeTitle || typeof nodeTitle !== "string" || !nodeTitle.trim()) {
      return res.status(400).json({ success: false, error: "A node title is required." });
    }
    const ai = getGenAI(req);

    const prompt = `
Generate 4-6 highly effective YouTube search keyword phrases for finding short educational videos about this specific learning topic:

Topic: ${nodeTitle}
Description: ${nodeDescription || ""}
${Array.isArray(existingKeywords) && existingKeywords.length ? `Provide fresh alternatives; avoid repeating: ${JSON.stringify(existingKeywords)}` : ""}

Keywords should be realistic phrases a student would actually type, mixing broad and specific angles (e.g. "explained", "for beginners", "example", "tutorial", "in 5 minutes").
    `;

    const response = await generateWithRetry(ai, {
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["keywords"],
        },
      },
    });

    const parsed = safeJsonParse<{ keywords?: string[] }>(response.text || "{}", {});
    if (!parsed.keywords || !Array.isArray(parsed.keywords) || parsed.keywords.length === 0) {
      return res.status(500).json({ success: false, error: "Failed to generate keywords. Please retry." });
    }
    res.json({ success: true, keywords: parsed.keywords });
  } catch (error: any) {
    console.error("Learning keywords generation error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to generate keywords" });
  }
});

// Start Express Server with Vite Middleware in Dev Mode
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Note Maker running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
