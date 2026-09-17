import { useCallback, useEffect, useState } from "react";

/**
 * Minimal History API router.
 *
 * Deliberately not react-router: App.tsx's `activeView` string union stays the single
 * source of truth for which screen is mounted (see CLAUDE.md / DEVELOPMENT.md), this
 * module only keeps the browser URL in sync with it and parses URLs back into a view
 * on a cold load or a back/forward navigation.
 *
 * To add a view: add it to `AppView`, add one entry to `ROUTES`, and — if the path
 * carries an id — hydrate the matching state from storage in App.tsx's deep-link effect.
 */
export type AppView =
  | "home"
  | "collections"
  | "notes_list"
  | "roadmap_editor"
  | "generation_progress"
  | "note_studio"
  | "audio_learning"
  | "flashcards"
  | "flashcard_editor"
  | "flashcard_study"
  | "test_generator"
  | "test_runner"
  | "test_results"
  | "teach_back"
  | "community"
  | "settings"
  | "shorts_setup"
  | "shorts_map"
  | "shorts_feed"
  | "shorts_revision";

export interface RouteParams {
  noteId?: string;
  deckId?: string;
  collectionId?: string;
  testId?: string;
  attemptId?: string;
  treeId?: string;
}

export interface RouteState {
  view: AppView;
  params: RouteParams;
}

interface RouteDef {
  view: AppView;
  /** `:name` segments are captured into RouteParams; everything else matches literally. */
  pattern: string;
}

/**
 * Order matters for matching: a pattern whose literal segment could also be read as an
 * id (e.g. `/flashcards/study/due` vs `/flashcards/:deckId`) must come first.
 */
const ROUTES: RouteDef[] = [
  { view: "home", pattern: "/" },
  { view: "roadmap_editor", pattern: "/create/roadmap" },
  { view: "collections", pattern: "/collections" },
  { view: "community", pattern: "/community" },
  { view: "settings", pattern: "/settings" },
  { view: "teach_back", pattern: "/teach-back" },

  { view: "notes_list", pattern: "/notes" },
  { view: "audio_learning", pattern: "/notes/:noteId/audio" },
  { view: "generation_progress", pattern: "/notes/:noteId/generating" },
  { view: "note_studio", pattern: "/notes/:noteId" },

  { view: "flashcards", pattern: "/flashcards" },
  { view: "flashcard_study", pattern: "/flashcards/study/due" },
  { view: "flashcard_study", pattern: "/flashcards/study/collection/:collectionId" },
  { view: "flashcard_study", pattern: "/flashcards/:deckId/study" },
  { view: "flashcard_editor", pattern: "/flashcards/:deckId" },

  { view: "test_generator", pattern: "/tests" },
  { view: "test_results", pattern: "/tests/results/:attemptId" },
  { view: "test_runner", pattern: "/tests/:testId/run" },

  { view: "shorts_setup", pattern: "/shorts" },
  { view: "shorts_revision", pattern: "/shorts/revision" },
  { view: "shorts_feed", pattern: "/shorts/:treeId/feed" },
  { view: "shorts_revision", pattern: "/shorts/:treeId/revision" },
  { view: "shorts_map", pattern: "/shorts/:treeId" },
];

const HOME: RouteState = { view: "home", params: {} };

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function matchRoute(def: RouteDef, parts: string[]): RouteParams | null {
  const patternParts = segments(def.pattern);
  if (patternParts.length !== parts.length) return null;

  const params: RouteParams = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    if (p.startsWith(":")) {
      if (!parts[i]) return null;
      params[p.slice(1) as keyof RouteParams] = decodeURIComponent(parts[i]);
    } else if (p !== parts[i]) {
      return null;
    }
  }
  return params;
}

/** Parses a pathname into a view + params. Unknown paths fall back to home. */
export function parsePath(pathname: string): RouteState {
  const parts = segments(pathname);
  for (const def of ROUTES) {
    const params = matchRoute(def, parts);
    if (params) return { view: def.view, params };
  }
  return HOME;
}

/**
 * Builds the URL for a view. Picks the most specific pattern the given params can
 * satisfy, so `flashcard_study` with a `deckId` becomes `/flashcards/<id>/study` while
 * the same view without one becomes `/flashcards/study/due`.
 */
export function buildPath(view: AppView, params: RouteParams = {}): string {
  const candidates = ROUTES.filter((def) => def.view === view)
    .map((def) => {
      const patternParts = segments(def.pattern);
      const needed = patternParts.filter((p) => p.startsWith(":")).map((p) => p.slice(1) as keyof RouteParams);
      const satisfied = needed.every((key) => !!params[key]);
      return { def, needed, satisfied };
    })
    .filter((c) => c.satisfied)
    .sort((a, b) => b.needed.length - a.needed.length);

  const chosen = candidates[0];
  if (!chosen) return "/";

  const path = segments(chosen.def.pattern)
    .map((p) => (p.startsWith(":") ? encodeURIComponent(params[p.slice(1) as keyof RouteParams] as string) : p))
    .join("/");
  return `/${path}`;
}

function currentPath(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one. */
  replace?: boolean;
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(() => parsePath(window.location.pathname));

  // Normalize an unrecognized cold-load URL (e.g. a stale bookmark) to the path it
  // actually resolved to, so the address bar never disagrees with the rendered view.
  useEffect(() => {
    const canonical = buildPath(route.view, route.params);
    if (canonical !== window.location.pathname) {
      window.history.replaceState({}, "", canonical + window.location.search);
    }
    // Intentionally on-mount only: later syncing is handled by navigate().
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback(
    (view: AppView, params: RouteParams = {}, options: NavigateOptions = {}) => {
      const path = buildPath(view, params);
      if (path !== window.location.pathname) {
        if (options.replace) window.history.replaceState({}, "", path);
        else window.history.pushState({}, "", path);
      } else if (currentPath() !== path) {
        window.history.replaceState({}, "", path);
      }
      setRoute((prev) =>
        prev.view === view && buildPath(prev.view, prev.params) === path ? prev : { view, params }
      );
    },
    []
  );

  return { route, navigate };
}
