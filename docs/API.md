# API Reference

All routes are defined in [`server.ts`](../server.ts) and served under `/api/`. This is the single source of truth for endpoint shapes — `src/lib/aiService.ts` and `src/lib/learningService.ts` are thin wrappers around these, and shouldn't be treated as separate documentation.

## Conventions shared by every route

**Response envelope.** Every route returns `{ success: boolean, ... }`. On failure: `{ success: false, error: string }`, generally with an appropriate non-200 status (`400` for bad input, `429` for quota/rate limits, `500`/`502` for upstream failures).

**Authentication / BYOK.** AI routes resolve a Gemini API key via `getGenAI(req)`:
1. `x-user-api-key` request header, or `userApiKey` in the request body, if the user has configured a personal key in Settings (BYOK mode).
2. Otherwise, the server's own `GEMINI_API_KEY` environment variable.
3. If neither is present, the route throws before calling Gemini.

**Retries.** All Gemini calls go through `generateWithRetry`, which retries transient errors (HTTP 429/500/502/503/504, or messages indicating rate limits/high demand) up to 5 times with exponential backoff, falling back through `gemini-3.6-flash` → `gemini-2.5-flash` → `gemini-1.5-flash` after the second attempt.

**JSON parsing.** Structured responses are requested via `responseSchema` + `responseMimeType: "application/json"`, then parsed with `safeJsonParse`, which strips ```` ```json ```` fences before parsing and returns a caller-supplied fallback on failure rather than throwing.

---

## `GET /api/health`

Liveness check. Returns `{ status: "ok", timestamp }`.

## `POST /api/ai/test-key`

Verifies a Gemini API key works (used by the Settings BYOK flow).

- **Body:** `{ userApiKey?: string }`
- **Response:** `{ success: true, message: string }`

## `POST /api/ai/roadmap`

Generates a 6–10 topic study roadmap for a subject, before any note content is written.

- **Body:** `{ subject, mainTopic?, learnerLevel?, complexity?, depth?, language?, instructions? }`
- **Response:** `{ success: true, roadmap: { title, description, estimatedMinutes? }[] }`

## `POST /api/ai/suggest-topics`

Suggests 3–5 additional topics to extend an existing roadmap.

- **Body:** `{ subject, existingTopics: string[] }`
- **Response:** `{ success: true, suggestedTopics: { title, description, estimatedMinutes? }[] }`

## `POST /api/ai/topic-notes`

Generates the structured note content (summary + block array) for a single approved roadmap topic. This is called once per topic during note generation (`GenerationProgress`), not once for the whole note.

- **Body:** `{ subject, topicTitle, topicDescription?, learnerLevel?, complexity?, depth?, language?, instructions? }`
- **Response:** `{ success: true, topicTitle, notes: { summary: string, blocks: NoteBlock[] } }`
- **Block types:** `heading | paragraph | bullet_list | numbered_list | checklist | quote | callout | code | table | student_tag` — see `BlockType`/`NoteBlock` in `src/types.ts` for the full shape of each.
- Returns `500` if the model produces zero blocks (treated as a generation failure the UI can retry or skip).

## `POST /api/ai/selection-action`

Runs an inline AI action on a piece of selected note text (right-click / selection toolbar in the Note Studio).

- **Body:** `{ action, selectedText, contextTopic?, language?, userPrompt? }`
- **`action` values:** `explain_simply | simplify | expand | give_example | create_analogy | make_exam_answer | create_flashcard | translate | ask_ai` (default)
- **Response:** `{ success: true, result: string }`

## `POST /api/ai/generate-test`

Generates a batch of test questions for a set of topics. The client (`generateBatchedTestQuestions` in `aiService.ts`) calls this in batches of 10 for larger tests rather than requesting everything in one call.

- **Body:** `{ subject, topics: {id, title}[], questionCount?, difficulty?, questionTypes?, contentContext? }`
- **Response:** `{ success: true, questions: Question[] }`
- **Question types:** `mcq` (exactly 4 options), `true_false` (`"True"`/`"False"`), `fill_blank`, `one_word`.

## `POST /api/ai/revision-plan`

Generates a focused 5-minute revision guide for a set of weak topics (used by the weak-topics dashboard).

- **Body:** `{ subject, weakTopics: string[] }`
- **Response:** `{ success: true, revisionPlan: { summary5Min, keyConcepts[], examples[], practiceQuestions: {question, answer}[] } }`

## `POST /api/ai/teach-back`

Grades a user's free-text explanation of a topic (Teach-Back Mode).

- **Body:** `{ topicTitle, userExplanation }`
- **Response:** `{ success: true, evaluation: { understandingPercent, understoodPoints[], missingPoints[], incorrectPoints[], studyRecommendation } }`

## `POST /api/ai/podcast-script`

Converts note content into a two-host dialogue script for the Audio Learning feature.

- **Body:** `{ noteTitle, topicTitle, textContent }` (content is truncated to 3000 chars before prompting)
- **Response:** `{ success: true, dialogue: { speaker: "Alex (Host)" | "Sam (Expert)", text }[] }`

## `POST /api/ai/generate-flashcards`

Generates 1–20 flashcards from a topic and/or source content.

- **Body:** `{ topic?, content?, count?, difficulty?, focus?, language? }`
- **Response:** `{ success: true, cards: { front, back, explanation?, example?, hint? }[] }`

## `POST /api/ai/learning-tree`

Generates a hierarchical topic breakdown (2–4 levels deep) for Shorts Learning, with YouTube search keywords per node. The response schema is built recursively up to the requested depth (`buildLearningNodeSchema`) since Gemini schemas can't self-reference.

- **Body:** `{ mainTopic, topicDescription?, depth? (2–4, default 3), language?, difficulty? }`
- **Response:** `{ success: true, topic: string, nodes: RawTreeNode[] }` — nested nodes, flattened client-side by `flattenTree` in `learningService.ts` into the flat `LearningNode[]` shape used everywhere else.
- Returns `500` if the tree fails shape validation (`isValidLearningNode`) — every node needs a non-empty `title` and a `keywords` array.

## `POST /api/ai/learning-keywords`

Regenerates 4–6 fresh YouTube search keyword phrases for a single learning-tree node (used when a user wants different video results for a node).

- **Body:** `{ nodeTitle, nodeDescription?, existingKeywords? }` — existing keywords are passed so the model avoids repeating them
- **Response:** `{ success: true, keywords: string[] }`

## `POST /api/youtube/search`

Server-side proxy to the YouTube Data API v3 (official API only, no scraping), used for both Shorts Learning content discovery and the revision feed. Requires `YOUTUBE_API_KEY` to be set — returns `500` with a clear message if it isn't.

- **Body:** `{ keyword, limit? (1–10, default 6), filters?: LearningSessionFilter }`
- **Response:** `{ success: true, items: LearningContentResult[], cached?: true }`
- **Behavior:**
  - Results are cached server-side per `keyword + filters + limit` for 30 minutes to conserve quota.
  - `filters.contentFormat` (`'short' | 'long' | 'hybrid'`, default `'long'`) is enforced by post-filtering on actual video duration, since the YouTube API's own `videoDuration` parameter is too coarse (short/medium/long buckets only) — `'short'` biases the query with `#shorts` and requires duration ≤ `shortsMaxDurationSeconds` (default 60s, capped 15–180s).
  - Returns `429` specifically on YouTube quota/permission errors (HTTP 403/429 from YouTube) so the client can distinguish "try again later" from other failures.
