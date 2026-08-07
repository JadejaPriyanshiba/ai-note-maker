# AI Assistant Guide

Operating notes for AI coding assistants working in this repository. This file is the meta-layer only — it doesn't restate what's already documented elsewhere; it tells you *where* to look and what not to break. Read the linked docs before making non-trivial changes.

## Read this first

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design and the reasoning behind it. Read this before touching `server.ts`, `storage.ts`, `syncService.ts`, or `App.tsx`.
2. `src/types.ts` — the entire domain model in one file. Read the relevant interfaces before writing code that touches a given entity.
3. [docs/API.md](docs/API.md) — every backend endpoint, before adding or modifying AI routes.
4. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — conventions and extension guides, before adding a new view, entity, or provider.

## Non-negotiable rules

- **Never call Gemini, `@google/genai`, or read `GEMINI_API_KEY` from client code.** All AI access goes through `/api/ai/*` routes in `server.ts`, called via the thin wrappers in `aiService.ts` / `learningService.ts`. If a task seems to need an AI call from a component, it needs a new server route instead — see [DEVELOPMENT.md](docs/DEVELOPMENT.md#adding-a-new-ai-endpoint).
- **Preserve the BYOK header pattern** (`x-user-api-key`) on any new AI route — don't hardcode server-only key usage that would break the bring-your-own-key flow.
- **Always run new Firestore writes through `sanitizeForFirestore`**, and reads through `deserializeFromFirestore` (both in `syncService.ts`). Firestore rejects `undefined` values and nested arrays; these helpers exist specifically to handle that. Skipping them will cause silent write failures on fields like `tableData: string[][]`.
- **Keep `types.ts` as the single domain model.** Don't create a parallel per-feature types file, even for something that feels local to one component — cross-feature reuse (e.g. `NoteDocument` appearing inside `CommunityNote`, `TopicHubResource`, `SavedTest`) depends on this staying centralized.
- **Follow the existing view-router pattern in `App.tsx`** (the `activeView` string union) rather than introducing React Router or any other routing library. See [DEVELOPMENT.md](docs/DEVELOPMENT.md#adding-a-new-view).
- **Match existing conventions for new persisted entities**: localStorage key `ainotemaker_<entity>_v1`, ID format `<prefix>_<Date.now()>`. Every new entity needs a rule block added to `firestore.rules` — an unprotected Firestore collection is a real security bug, not a style nit.
- **Treat AI responses as untrusted input.** Gemini output is schema-constrained but not guaranteed clean — always parse with `safeJsonParse` (fallback value, strips markdown fences) and validate shape before trusting it, following the `isValidLearningNode` pattern in `server.ts`.
- **Don't add a test framework, ESLint config, or CI pipeline speculatively.** None exist today (`npm run lint` is `tsc --noEmit` only). If a task seems to call for one, that's a structural decision — flag it to the user rather than introducing it unprompted.

## Observed coding conventions

- Functional components with hooks throughout; no class components.
- Props and all domain objects are explicitly typed; `any` is mostly confined to parsing raw AI/Firestore responses in `server.ts` and `syncService.ts`, not general application code.
- Styling is Tailwind utility classes inline (no CSS modules, no styled-components) with a zinc neutral palette and `dark:` variants applied throughout every component — dark mode is a first-class state (`theme` in `App.tsx`, toggled via a `dark` class on `<html>`), not an afterthought.
- Icons are exclusively `lucide-react`.
- Error handling in `storage.ts`/`syncService.ts` favors returning `false`/`null`/empty-array fallbacks over throwing, so a failed cloud read/write degrades gracefully instead of crashing the UI — match this when adding similar functions.

## Task playbooks

**Add a new AI-powered feature** (e.g. "summarize a flashcard deck"):
1. Add a route in `server.ts` following the existing `getGenAI` / `generateWithRetry` / `responseSchema` / `safeJsonParse` pattern (see any existing `/api/ai/*` route as a template).
2. Add a thin wrapper in `aiService.ts` (or `learningService.ts` if it's Shorts-Learning-specific).
3. Wire it into the relevant component; add a new view to `App.tsx` only if it needs its own screen.
4. Document the new endpoint in `docs/API.md` in the same format as the existing entries.

**Add a new persisted entity** (e.g. a new resource type):
1. Add the type to `types.ts`.
2. Add local CRUD functions to `storage.ts` (localStorage key: `ainotemaker_<entity>_v1`).
3. Add matching cloud CRUD functions to `syncService.ts`, using `sanitizeForFirestore`/`deserializeFromFirestore`.
4. Add a rule block to `firestore.rules` scoping access to the owner.
5. If it should survive sign-in/sign-out, add it to `syncAllCloudDataToLocal` and `migrateLocalDataToCloud` in `storage.ts`.

**Add a new Shorts Learning content source** (e.g. Instagram): implement `ContentProvider` (`src/lib/providers/ContentProvider.ts`) using `YouTubeProvider.ts` as the reference implementation, then `providerRegistry.register(...)`. Don't touch `learningService.ts` call sites — they resolve providers by name through the registry.

**Modify note block rendering/generation:** the block model is `BlockType`/`NoteBlock` in `types.ts`, generated server-side in the `/api/ai/topic-notes` route, and rendered in `src/components/NoteStudio/`. Changing the set of AI-generated block types requires updating all three in lockstep, plus the `responseSchema` in `server.ts`. One exception: `image_gallery` blocks are appended deterministically by `GenerationContext.tsx` after each topic's AI response (via `/api/images/search`, not Gemini) — they're not in `topic-notes`'s `responseSchema` and never will be. Any new block type still needs rendering added in all three `NoteStudio.tsx` block-render spots (main editor, full-screen reading mode, `generateNoteStudioHTML`) plus the TXT export and the `CommunityView.tsx` preview snippet.

## Context-loading shortcuts by task type

| Task touches... | Read |
|---|---|
| A feature UI / new view | `App.tsx`, the relevant `src/components/<Feature>/` folder, `docs/DEVELOPMENT.md#adding-a-new-view` |
| An AI prompt or response shape | The route in `server.ts`, `docs/API.md`, the corresponding `aiService.ts`/`learningService.ts` wrapper |
| Data persistence or sync behavior | `storage.ts`, `syncService.ts`, `firestore.rules`, `docs/ARCHITECTURE.md#data-flow-writes-and-sync` |
| Auth | `AuthContext.tsx`, `firebase.ts` |
| Shorts Learning content sources | `learningService.ts`, `src/lib/providers/` |
