# Development Guide

Setup, conventions, and extension guides for working on AI Note Maker locally. For *why* the system is shaped this way, see [ARCHITECTURE.md](ARCHITECTURE.md). For endpoint details, see [API.md](API.md).

## Prerequisites

- Node.js 22.x (matches the `@types/node` version pinned in `package.json`; anything Node 18+ should work but isn't verified here)
- npm (the committed `package-lock.json` is the canonical lockfile; a `bun.lock` also exists in the repo but npm is what the scripts below assume)
- A Google Gemini API key ([aistudio.google.com](https://aistudio.google.com)) — required for any AI feature to work locally
- Optionally, a YouTube Data API v3 key — only required for the Shorts Learning feature

## Setup

```bash
git clone <this-repo>
cd ai-note-maker
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Server-side Gemini access for all `/api/ai/*` routes. Falls back to nothing — AI routes throw a clear error if unset and the user hasn't provided a BYOK key. |
| `YOUTUBE_API_KEY` | Only for Shorts Learning | Server-side YouTube Data API v3 access. Without it, `/api/youtube/search` returns a 500 with a clear message; the rest of the app works fine. |
| `APP_URL` | No (local dev) | Used for self-referential links / OAuth callbacks when hosted on AI Studio's Cloud Run. Not needed to run locally. |

These are read via `process.env` in `server.ts` only — never bundled into the client, and never prefixed `VITE_`, so there's no risk of them leaking into the browser bundle.

### Firebase

The repo ships with a working Firebase project config in `firebase-applet-config.json`. This file is **not a secret** — Firebase web client config is meant to be public; access control is enforced entirely by `firestore.rules`, not by hiding this file. You can run against the existing project as-is for local development, or point at your own:

1. Create a Firebase project, enable **Firestore** and **Authentication**.
2. In Authentication → Sign-in method, enable **Email/Password**, **Google**, and **Anonymous** — all three are used by `src/lib/AuthContext.tsx`.
3. Replace the values in `firebase-applet-config.json` with your project's web app config.
4. Deploy `firestore.rules` to your project. No `firebase.json` is committed in this repo, so either run `firebase init firestore` to generate one before using the Firebase CLI, or paste the contents of `firestore.rules` directly into the Firebase Console's Rules editor.

### Run it

```bash
npm run dev
```

This runs `tsx server.ts`, which starts a single Express server on port 3000 that also mounts Vite's dev middleware for the React app (HMR included). Open `http://localhost:3000`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server (Express + Vite middleware, one process) |
| `npm run build` | `vite build` (client bundle) + `esbuild` bundles `server.ts` into `dist/server.cjs` |
| `npm run vercel-build` | `vite build` only — Vercel builds `api/index.ts` separately as a serverless function |
| `npm start` | Run the production build: `node dist/server.cjs` |
| `npm run clean` | Remove `dist/` and `server.cjs` |
| `npm run lint` | `tsc --noEmit` — type-checking only. **There is no ESLint config and no test suite in this project.** Don't assume either exists when verifying a change; rely on type-checking plus manually exercising the feature in the browser. |

## Deployment

**Vercel:** `vercel.json` rewrites `/api/(.*)` to `api/index.ts`, which wraps the same Express `app` used in dev/Cloud Run as a serverless function handler. Set `GEMINI_API_KEY`, `YOUTUBE_API_KEY` (if using Shorts Learning), and `APP_URL` as Vercel project environment variables.

**Google AI Studio / Cloud Run:** the project carries AI Studio scaffolding (`metadata.json`, `assets/.aistudio/`). AI Studio injects `GEMINI_API_KEY` and `APP_URL` automatically at runtime via its Secrets panel; `YOUTUBE_API_KEY` must be added manually the same way. Cloud Run runs `npm run build && npm start` as one long-lived process.

## Folder structure

```
server.ts                    # Express app: all API routes, dev/prod serving
api/index.ts                 # Vercel serverless entry (wraps server.ts's app)
firestore.rules              # Firestore security rules (ownership per collection)
firebase-applet-config.json  # Firebase client config (public, not a secret)
src/
  main.tsx                   # React entry point, wraps App in AuthProvider
  App.tsx                    # View-router + cross-cutting app state
  types.ts                   # Every domain type — the single source of truth
  index.css                  # Tailwind import + global type/print styles
  lib/
    firebase.ts               # Firebase app/auth/Firestore init
    AuthContext.tsx           # Auth state + email/Google/anonymous sign-in
    storage.ts                 # localStorage CRUD + cloud migration/sync orchestration
    syncService.ts             # Firestore CRUD, data-shape sanitization
    aiService.ts                # Client wrappers for note/test/flashcard AI endpoints
    learningService.ts          # Learning-tree logic + Shorts Learning content search
    providers/
      ContentProvider.ts        # Provider interface + registry
      YouTubeProvider.ts         # YouTube Data API-backed provider
  components/
    Assessment/                 # Test generation, running, results, teach-back, weak topics
    AudioPlayer/                # AI podcast script + playback
    Auth/                        # Sign-in modal, local→cloud migration modal
    Collections/                 # Nested folder organization
    Community/                    # Publish/browse/remix public resources
    Flashcards/                    # Deck CRUD, AI generation, spaced-repetition study
    NoteStudio/                     # The structured note editor/viewer
    ShortsLearning/                  # Learning tree + YouTube shorts feed
    Settings/                         # BYOK toggle
    Header.tsx, HomeView.tsx, NotesListView.tsx,
    RoadmapEditor.tsx, GenerationProgress.tsx, ConfirmModal.tsx
```

## Conventions

- **localStorage keys** follow `ainotemaker_<entity>_v1` (e.g. `ainotemaker_user_notes_v1`). The version suffix exists so a future schema change can migrate rather than silently misread old data — keep it when adding new entities.
- **IDs** are generated as `<prefix>_<Date.now()>` (optionally with a random suffix for batch-generated items, e.g. flashcards), not UUIDs — e.g. `note_`, `deck_`, `col_`, `test_`, `q_`, `ln_` (learning node), `ls_` (learning session), `rev_`. Match this pattern for new entities rather than introducing `uuid()`.
- **Every persisted entity needs four things**, kept in sync: a type in `types.ts`, local CRUD in `storage.ts`, cloud CRUD in `syncService.ts` (using `sanitizeForFirestore`/`deserializeFromFirestore`), and a rule block in `firestore.rules`. If it should round-trip through sign-in, also add it to `syncAllCloudDataToLocal` and `migrateLocalDataToCloud` in `storage.ts`.
- **AI calls are server-only.** Never import `@google/genai` or read `GEMINI_API_KEY` from client code — add a route in `server.ts` and a thin `fetch` wrapper in `aiService.ts` or `learningService.ts` instead.

### Adding a new view

Views are entries in the `activeView` string union in `src/App.tsx`, not routes:

1. Add the view name to the `activeView` union type.
2. Create the component under `src/components/`.
3. Add a render branch in `App.tsx`'s `<main>` (`{activeView === "your_view" && <YourComponent ... />}`).
4. Add a nav entry in `src/components/Header.tsx` if it should be directly reachable from navigation.

### Adding a new AI endpoint

Follow the existing pattern in `server.ts`:

1. Add an `app.post("/api/ai/your-thing", ...)` route using `getGenAI(req)` to resolve the API key, `generateWithRetry(ai, params)` for the actual call, and a `responseSchema` to constrain Gemini's JSON output.
2. Parse the result with `safeJsonParse(response.text, fallback)` and validate its shape before trusting it (see `isValidLearningNode` in `server.ts` for a validation-after-parse example).
3. Add a matching thin wrapper function in `aiService.ts` (or `learningService.ts`) that just `fetch`es the route and throws on `!data.success`.

### Adding a new content provider (e.g. Instagram, Pinterest)

1. Implement the `ContentProvider` interface from `src/lib/providers/ContentProvider.ts` — see `YouTubeProvider.ts` as a reference (server-side proxy call + caching + de-duplication by content ID).
2. Register it: `providerRegistry.register(yourProvider)`.
3. `LearningContentProvider` in `types.ts` already includes the value — no type changes needed unless adding a genuinely new provider name.

## Debugging tips

- AI JSON parse failures are logged server-side with the raw model text (`console.error("JSON parse error:", err, "Raw text:", text)`) — check the server console, not just the client error toast.
- YouTube quota/permission errors surface to the client as HTTP 429 with a clear message; the search endpoint also caches successful results for 30 minutes server-side to conserve quota.
- If a cloud write silently "succeeds" but data doesn't show up, check the return value of the relevant `syncService.ts` function — writes return `false` on failure (e.g. Firestore's 1MB document size limit) rather than throwing.
