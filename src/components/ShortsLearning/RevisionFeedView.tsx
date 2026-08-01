import React, { useEffect, useRef, useState } from "react";
import { X, List, GraduationCap, BookOpenCheck } from "lucide-react";
import { LearningContent, SavedLearningResource } from "../../types";
import { saveSavedLearningResource } from "../../lib/storage";
import { ContentCard } from "./ContentCard";

interface RevisionFeedViewProps {
  resources: SavedLearningResource[];
  title: string;
  onExit: () => void;
  onTestMe?: (topics: { id: string; title: string }[]) => void;
}

const MUTE_PREF_KEY = "ainotemaker_shorts_muted";
const TEST_ME_THRESHOLD = 3;
const noScrollbar = "[&::-webkit-scrollbar]:hidden";
const noScrollbarStyle: React.CSSProperties = { scrollbarWidth: "none", msOverflowStyle: "none" };

function toLearningContent(r: SavedLearningResource): LearningContent {
  return {
    id: r.id,
    provider: r.provider,
    providerContentId: r.providerContentId,
    title: r.title,
    description: "",
    thumbnailUrl: r.thumbnailUrl,
    channelName: r.channelName,
    duration: r.duration,
    durationSeconds: 0,
    url: r.url,
    matchedKeyword: r.learningNodeTitle,
    topicId: r.topicId,
  };
}

// A read-focused "revision session" — reuses the exact same full-screen video interface as the
// learning feed, but scoped to only the videos you've already saved, each shown alongside its
// notes. No searching, no time budget, no session bookkeeping — just review.
export const RevisionFeedView: React.FC<RevisionFeedViewProps> = ({ resources, title, onExit, onTestMe }) => {
  const [items, setItems] = useState<SavedLearningResource[]>(resources);
  const totalSections = items.length + 1; // +1 for the end-of-review summary section
  const [index, setIndex] = useState(0);
  const [showJumpList, setShowJumpList] = useState(false);

  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(MUTE_PREF_KEY);
      return raw === null ? true : raw === "1";
    } catch {
      return true;
    }
  });
  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_PREF_KEY, next ? "1" : "0");
      } catch {
        // ignore storage failures (private browsing etc.)
      }
      return next;
    });
  }

  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const verticalRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);

  function scrollToIndex(i: number, behavior: ScrollBehavior = "smooth") {
    const el = verticalRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, totalSections - 1));
    el.scrollTo({ top: clamped * el.clientHeight, behavior });
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, clientHeight } = e.currentTarget;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const next = Math.max(0, Math.min(Math.round(scrollTop / clientHeight), totalSections - 1));
      if (next !== indexRef.current) setIndex(next);
    }, 130);
  }

  const current = index < items.length ? items[index] : undefined;

  function updateCurrent(patch: Partial<SavedLearningResource>) {
    if (!current) return;
    const saved = saveSavedLearningResource({ ...current, ...patch });
    setItems((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
  }

  const distinctTopics = Array.from(
    new Map(items.map((r) => [r.learningNodeId, { id: r.learningNodeId, title: r.learningNodeTitle }])).values()
  );

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-3 px-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No saved videos to review yet.</p>
        <button onClick={onExit} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <div
        ref={verticalRef}
        onScroll={handleScroll}
        className={`h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory overscroll-y-contain touch-pan-y ${noScrollbar}`}
        style={noScrollbarStyle}
      >
        {items.map((resource, i) => (
          <div key={resource.id} className="h-[100dvh] w-full snap-start snap-always relative bg-zinc-950">
            <ContentCard
              content={toLearningContent(resource)}
              node={{
                id: resource.learningNodeId,
                title: resource.learningNodeTitle,
                description: "",
                keywords: [],
                depth: 0,
                order: 0,
              }}
              breadcrumb={`${title} • ${resource.learningNodeTitle}`}
              isActive={i === index}
              muted={muted}
              onToggleMute={toggleMute}
              isSaved={true}
              notesValue={resource.userNotes || ""}
              timestampNotes={resource.timestampNotes || []}
              onSave={() => updateCurrent({})}
              onNotesChange={(value) => updateCurrent({ userNotes: value })}
              onAddTimestampNote={(time, note) =>
                updateCurrent({ timestampNotes: [...(current?.timestampNotes || []), { time, note }] })
              }
              onSkipNode={() => scrollToIndex(index + 1)}
            />
          </div>
        ))}

        {/* Final section: end of review */}
        <div className="h-[100dvh] w-full snap-start snap-always relative bg-zinc-950 flex flex-col items-center justify-center text-white text-center px-8 space-y-4">
          <BookOpenCheck className="w-9 h-9 text-white/80" />
          <h2 className="text-lg font-semibold">You've reviewed everything saved</h2>
          <p className="text-xs text-white/60">{items.length} saved video{items.length === 1 ? "" : "s"} from "{title}".</p>
          <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
            {onTestMe && distinctTopics.length >= TEST_ME_THRESHOLD && (
              <button
                onClick={() => onTestMe(distinctTopics)}
                className="px-4 py-2.5 rounded-xl bg-white text-zinc-900 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Test Me on {distinctTopics.length} Topics</span>
              </button>
            )}
            <button
              onClick={() => scrollToIndex(0)}
              className="px-4 py-2.5 rounded-xl border border-white/25 text-white text-xs font-medium hover:bg-white/10"
            >
              Restart Review
            </button>
            <button onClick={onExit} className="px-4 py-2.5 rounded-xl text-white/60 text-xs font-medium hover:bg-white/10">
              Exit
            </button>
          </div>
        </div>
      </div>

      {/* Floating chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 sm:px-4 pt-3 sm:pt-4">
        <button
          onClick={onExit}
          className="pointer-events-auto p-2 rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center text-white drop-shadow px-2">
          <p className="text-xs font-semibold truncate max-w-[45vw] sm:max-w-[200px]">
            {current ? current.learningNodeTitle : "Review Complete"}
          </p>
          <p className="text-[10px] text-white/80">
            {Math.min(index + 1, items.length)} / {items.length}
          </p>
        </div>
        <button
          onClick={() => setShowJumpList((v) => !v)}
          className="pointer-events-auto p-2 rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50"
        >
          <List className="w-5 h-5" />
        </button>
      </div>

      {showJumpList && (
        <div className="absolute top-14 sm:top-16 right-3 sm:right-4 left-3 sm:left-auto z-40 sm:w-64 max-h-[70vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-2 space-y-1">
          {items.map((r, i) => (
            <button
              key={r.id}
              onClick={() => {
                scrollToIndex(i);
                setShowJumpList(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-2 ${
                i === index
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="truncate">{r.title}</span>
              {r.userNotes && <span className="text-amber-500 shrink-0">📝</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
