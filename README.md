# AI Note Maker

**An AI-powered study workspace that turns any subject into structured notes, practice tests, flashcards, and a bite-sized video learning path — all in one place.**

Give it a subject, a level, and how deep you want to go. It plans a topic roadmap, writes structured notes topic-by-topic, and then lets you test yourself, drill flashcards, listen to an AI-narrated podcast version, or learn the same topic through a swipeable feed of short YouTube videos.

---

## Why it exists

Studying usually means juggling five disconnected tools: a notes app, a flashcard app, a quiz generator, YouTube, and a spreadsheet to track what you're actually bad at. AI Note Maker keeps all of it in one workspace, and uses AI to generate the material instead of leaving that work to you:

- You still control the outline (AI proposes a roadmap, you approve or edit it before anything is generated).
- Every downstream tool (tests, flashcards, audio, revision plans) is generated *from* the same notes, so it stays consistent with what you're actually studying.
- It works without an account, and gets multi-device sync the moment you sign in.

## Features

- **AI Study Notes** — describe a subject, approve an AI-suggested topic roadmap, and get rich structured notes (headings, callouts, tables, code blocks, exam-tag highlights) generated topic by topic.
- **Practice Tests** — auto-generated MCQ / true-false / fill-in-the-blank / one-word tests from your notes, with a weak-topic dashboard that tracks accuracy over time and targets retests at what you're actually struggling with.
- **Teach-Back Mode** — explain a topic in your own words and have the AI grade your understanding, pointing out what you missed or got wrong.
- **Flashcards** — AI-generated decks with spaced-repetition scheduling, so due cards resurface automatically.
- **Audio Learning** — turns a note into a two-host, podcast-style dialogue script for listening-based review.
- **Shorts Learning** — breaks a topic into an AI-generated learning tree and feeds you short, curated YouTube videos per node, with session time-boxing and a saved-video revision feed.
- **Collections** — nest notes, decks, and tests into folders the way you'd organize a semester.
- **Community** — publish notes, decks, or whole collections publicly, and remix anyone else's.
- **Bring Your Own API Key** — use the app's default AI access, or plug in your own Gemini API key in Settings.

## Privacy & your data

AI Note Maker is **local-first**: everything you create is written to your browser's local storage first, so the app is fully usable without ever creating an account.

- **Not signed in:** your data lives only in that browser. Nothing leaves your device except the content sent to generate AI responses.
- **Signed in (Google, email, or anonymous guest):** your data additionally syncs to a private Firestore database, scoped to your account by security rules — no one else can read it. Community-published content is the only data that's public by design.
- **Guest (anonymous) sign-in** is tied to that one browser/device — it does not sync across devices, since there's no email or credential to reconnect it with. Sign in with Google or email if you want your library to follow you.

## Screenshots

<!-- Add product screenshots here, e.g.:
![Note Studio](docs/screenshots/note-studio.png)
![Shorts Learning feed](docs/screenshots/shorts-feed.png)
-->
_Coming soon._

## Quick start

```bash
git clone <this-repo>
cd ai-note-maker
npm install
cp .env.example .env   # add your GEMINI_API_KEY
npm run dev
```

Open the app at `http://localhost:3000`. For Firebase setup, environment variable details, and deployment instructions, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Express · Firebase (Auth + Firestore) · Google Gemini API · YouTube Data API v3

## Documentation

| Doc | For |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system fits together, and why it's built this way |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Local setup, Firebase config, conventions, deployment |
| [docs/API.md](docs/API.md) | Every backend API endpoint, request/response shapes |
| [CLAUDE.md](CLAUDE.md) | Operating guide for AI coding assistants working in this repo |

## FAQ

**Do I need my own API key?** No — the app ships with server-side AI access by default. Adding your own Gemini key in Settings is optional (useful if you want your own usage quota).

**Can I use it without signing in?** Yes, fully. Signing in only adds cross-device cloud sync.

**What happens to notes I published to the Community?** They become publicly readable (per `firestore.rules`) so others can view and remix them, until you unpublish.

**License:** No license file is currently included in this repository — treat the code as all-rights-reserved until one is added.
