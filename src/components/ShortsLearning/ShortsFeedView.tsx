import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, List, Loader2, WifiOff, GraduationCap } from "lucide-react";
import { LearningContent, LearningNode, LearningSession, LearningTree } from "../../types";
import { getOrderedLeafNodes, searchLearningContentForNode } from "../../lib/learningService";
import {
  saveLearningSession,
  saveSavedLearningResource,
  getSavedLearningResources,
  isLearningResourceSaved,
  saveLearningTree,
} from "../../lib/storage";
import { ContentCard } from "./ContentCard";

interface ShortsFeedViewProps {
  tree: LearningTree;
  session: LearningSession;
  onSessionChange: (session: LearningSession) => void;
  onExit: () => void;
  onTestMe: (topics: { id: string; title: string }[]) => void;
}

const TEST_ME_THRESHOLD = 3;
const MUTE_PREF_KEY = "ainotemaker_shorts_muted";
// Hide native scrollbars while keeping native scroll/snap/momentum behavior intact.
const noScrollbar = "[&::-webkit-scrollbar]:hidden";
const noScrollbarStyle: React.CSSProperties = { scrollbarWidth: "none", msOverflowStyle: "none" };

export const ShortsFeedView: React.FC<ShortsFeedViewProps> = ({ tree, session, onSessionChange, onExit, onTestMe }) => {
  const activeLeafNodes = useMemo(() => {
    const leaves = getOrderedLeafNodes(tree.nodes);
    return leaves.filter((n) => !session.skippedNodeIds.includes(n.id));
  }, [tree.nodes, session.skippedNodeIds]);

  // One extra virtual section at the end for the session summary / "you've reached the end" screen.
  const totalSections = activeLeafNodes.length + 1;

  const initialIndex = Math.max(0, activeLeafNodes.findIndex((n) => n.id === session.currentNodeId));
  const [nodeIndex, setNodeIndex] = useState(initialIndex === -1 ? 0 : initialIndex);
  const [resourceIndex, setResourceIndex] = useState(0);
  const [contentCache, setContentCache] = useState<Record<string, LearningContent[]>>({});
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(new Set());
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [showJumpList, setShowJumpList] = useState(false);
  const [sessionState, setSessionState] = useState<LearningSession>(session);
  const [showSkipMenu, setShowSkipMenu] = useState(false);
  const [budgetBannerDismissed, setBudgetBannerDismissed] = useState(false);
  const [, forceRerender] = useState(0);

  // Sound preference persists across videos/sessions so the user only has to unmute once.
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

  const currentNode = nodeIndex < activeLeafNodes.length ? activeLeafNodes[nodeIndex] : undefined;
  const budgetSeconds = sessionState.timeLimitMinutes * 60;
  const coverageSeconds = useRef(0);

  const nodeIndexRef = useRef(nodeIndex);
  const activeLeafNodesRef = useRef(activeLeafNodes);
  const resourceIndexRef = useRef(resourceIndex);
  useEffect(() => { nodeIndexRef.current = nodeIndex; }, [nodeIndex]);
  useEffect(() => { activeLeafNodesRef.current = activeLeafNodes; }, [activeLeafNodes]);
  useEffect(() => { resourceIndexRef.current = resourceIndex; }, [resourceIndex]);

  const verticalRef = useRef<HTMLDivElement>(null);
  const currentHorizontalRef = useRef<HTMLDivElement>(null);
  const vDebounceRef = useRef<number | null>(null);
  const hDebounceRef = useRef<number | null>(null);

  // Clamp index when the active leaf list shrinks (e.g. skipping the current/last node for this session)
  useEffect(() => {
    if (nodeIndex >= totalSections) setNodeIndex(Math.max(0, totalSections - 1));
  }, [totalSections, nodeIndex]);

  const persistSession = useCallback(
    (updater: (prev: LearningSession) => LearningSession) => {
      setSessionState((prev) => {
        const next = updater(prev);
        saveLearningSession(next);
        onSessionChange(next);
        return next;
      });
    },
    [onSessionChange]
  );

  const fetchNodeContent = useCallback(
    async (node: LearningNode) => {
      if (contentCache[node.id] || loadingNodeIds.has(node.id)) return;
      setLoadingNodeIds((prev) => new Set(prev).add(node.id));
      setLoadErrors((prev) => {
        const next = { ...prev };
        delete next[node.id];
        return next;
      });
      try {
        const items = await searchLearningContentForNode(node, sessionState.filters);
        setContentCache((prev) => ({ ...prev, [node.id]: items }));
      } catch (err: any) {
        setLoadErrors((prev) => ({ ...prev, [node.id]: err.message || "Could not load videos for this topic." }));
      } finally {
        setLoadingNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentCache, loadingNodeIds, sessionState.filters]
  );

  // Lazy-load only the current node + its immediate neighbors ("preload nearby feed items" per spec).
  useEffect(() => {
    [nodeIndex - 1, nodeIndex, nodeIndex + 1].forEach((i) => {
      const node = activeLeafNodes[i];
      if (node) fetchNodeContent(node);
    });
  }, [nodeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark current node visited + reset horizontal position when the node changes
  useEffect(() => {
    if (!currentNode) return;
    persistSession((prev) => ({
      ...prev,
      currentNodeId: currentNode.id,
      visitedNodeIds: prev.visitedNodeIds.includes(currentNode.id)
        ? prev.visitedNodeIds
        : [...prev.visitedNodeIds, currentNode.id],
    }));
    setResourceIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNode?.id]);

  // Scroll the horizontal row for the current node back to its start whenever we land on a new node.
  useEffect(() => {
    currentHorizontalRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [currentNode?.id]);

  function scrollToNodeIndex(index: number, behavior: ScrollBehavior = "smooth") {
    const el = verticalRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, totalSections - 1));
    el.scrollTo({ top: clamped * el.clientHeight, behavior });
  }

  // Snap to the resume position on first mount (no animation).
  useEffect(() => {
    scrollToNodeIndex(nodeIndexRef.current, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markComplete(node: LearningNode, video?: LearningContent) {
    persistSession((prev) => {
      const completed = prev.completedNodeIds.includes(node.id)
        ? prev.completedNodeIds
        : [...prev.completedNodeIds, node.id];
      return { ...prev, completedNodeIds: completed };
    });
    coverageSeconds.current += video?.durationSeconds || 300;
  }

  function settleNodeIndex(rawIndex: number) {
    const clamped = Math.max(0, Math.min(rawIndex, totalSections - 1));
    if (clamped === nodeIndexRef.current) return;
    const isAdvancing = clamped > nodeIndexRef.current;
    if (isAdvancing) {
      const prevNode = activeLeafNodesRef.current[nodeIndexRef.current];
      if (prevNode) markComplete(prevNode, contentCache[prevNode.id]?.[resourceIndexRef.current]);
    }
    setNodeIndex(clamped);
  }

  function handleVerticalScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollTop, clientHeight } = e.currentTarget;
    if (vDebounceRef.current) window.clearTimeout(vDebounceRef.current);
    vDebounceRef.current = window.setTimeout(() => {
      settleNodeIndex(Math.round(scrollTop / clientHeight));
    }, 130);
  }

  function handleHorizontalScroll(e: React.UIEvent<HTMLDivElement>) {
    const { scrollLeft, clientWidth } = e.currentTarget;
    if (hDebounceRef.current) window.clearTimeout(hDebounceRef.current);
    hDebounceRef.current = window.setTimeout(() => {
      const idx = Math.max(0, Math.round(scrollLeft / clientWidth));
      if (idx !== resourceIndexRef.current) setResourceIndex(idx);
    }, 100);
  }

  const currentContent = currentNode ? contentCache[currentNode.id] : undefined;
  const currentVideo = currentContent?.[resourceIndex];

  function upsertSavedResource(patch: Partial<Parameters<typeof saveSavedLearningResource>[0]>) {
    if (!currentNode || !currentVideo) return;
    const existing = getSavedLearningResources().find(
      (r) => r.providerContentId === currentVideo.providerContentId && r.learningNodeId === currentNode.id
    );
    const saved = saveSavedLearningResource({
      id: existing?.id || `slr_${Date.now()}`,
      userId: "",
      topicId: tree.rootTopicId,
      learningNodeId: currentNode.id,
      learningNodeTitle: currentNode.title,
      provider: currentVideo.provider,
      providerContentId: currentVideo.providerContentId,
      url: currentVideo.url,
      title: currentVideo.title,
      thumbnailUrl: currentVideo.thumbnailUrl,
      channelName: currentVideo.channelName,
      duration: currentVideo.duration,
      savedAt: existing?.savedAt || new Date().toISOString(),
      userNotes: existing?.userNotes,
      timestampNotes: existing?.timestampNotes,
      ...patch,
    });
    persistSession((prev) => ({
      ...prev,
      savedResourceIds: prev.savedResourceIds.includes(saved.id) ? prev.savedResourceIds : [...prev.savedResourceIds, saved.id],
    }));
    forceRerender((n) => n + 1); // refresh isSaved/notes lookups derived from storage
  }

  function handleSave() {
    upsertSavedResource({});
  }

  function handleNotesChange(value: string) {
    upsertSavedResource({ userNotes: value });
  }

  function handleAddTimestampNote(time: string, note: string) {
    if (!currentNode || !currentVideo) return;
    const existing = getSavedLearningResources().find(
      (r) => r.providerContentId === currentVideo.providerContentId && r.learningNodeId === currentNode.id
    );
    upsertSavedResource({ timestampNotes: [...(existing?.timestampNotes || []), { time, note }] });
  }

  function skipForSession() {
    if (!currentNode) return;
    persistSession((prev) => ({
      ...prev,
      skippedNodeIds: prev.skippedNodeIds.includes(currentNode.id) ? prev.skippedNodeIds : [...prev.skippedNodeIds, currentNode.id],
    }));
    setShowSkipMenu(false);
    // activeLeafNodes recomputes next render since it depends on session.skippedNodeIds; nodeIndex
    // then naturally points at what was the next node since the array shrinks in place.
  }

  function skipPermanently() {
    if (!currentNode) return;
    const updatedNodes = tree.nodes.map((n) => (n.id === currentNode.id ? { ...n, skipped: true } : n));
    saveLearningTree({ ...tree, nodes: updatedNodes });
    skipForSession();
  }

  const completedTitles = sessionState.completedNodeIds
    .map((id) => activeLeafNodes.find((n) => n.id === id)?.title)
    .filter(Boolean) as string[];
  const testMeTopics = () =>
    sessionState.completedNodeIds.map((id) => ({ id, title: activeLeafNodes.find((n) => n.id === id)?.title || id }));

  const budgetReached = budgetSeconds > 0 && coverageSeconds.current >= budgetSeconds && sessionState.completedNodeIds.length > 0;

  if (activeLeafNodes.length === 0) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No learning items available in this tree.</p>
        <button onClick={onExit} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
          Back to Learning Map
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black">
      {/* Vertical snap scroller: one full-screen section per learning node, plus a summary section */}
      <div
        ref={verticalRef}
        onScroll={handleVerticalScroll}
        className={`h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory overscroll-y-contain touch-pan-y ${noScrollbar}`}
        style={noScrollbarStyle}
      >
        {activeLeafNodes.map((node, i) => {
          const isCurrent = i === nodeIndex;
          const isInWindow = Math.abs(i - nodeIndex) <= 1;
          const items = contentCache[node.id];
          const isLoading = loadingNodeIds.has(node.id);
          const error = loadErrors[node.id];

          return (
            <div key={node.id} className="h-[100dvh] w-full snap-start snap-always relative bg-zinc-950">
              {!isInWindow && (
                <div className="w-full h-full flex items-center justify-center px-8">
                  <p className="text-white/30 text-xs text-center">{node.title}</p>
                </div>
              )}

              {isInWindow && isLoading && !items && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/70">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">Finding videos for "{node.title}"...</span>
                </div>
              )}

              {isInWindow && error && !items && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-8">
                  <WifiOff className="w-6 h-6 text-white/40" />
                  <p className="text-xs text-white/70">{error}</p>
                  <button
                    onClick={() => fetchNodeContent(node)}
                    className="px-3 py-1.5 rounded-lg bg-white text-zinc-900 text-xs font-bold hover:bg-zinc-100 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {isInWindow && items && items.length === 0 && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-8">
                  <p className="text-xs text-white/70">
                    No videos found for "{node.title}". Try adjusting filters in the Learning Map, or skip this topic.
                  </p>
                  <button
                    onClick={() => scrollToNodeIndex(i + 1)}
                    className="px-3 py-1.5 rounded-lg bg-white text-zinc-900 text-xs font-bold hover:bg-zinc-100 transition-colors"
                  >
                    Next Topic
                  </button>
                </div>
              )}

              {isInWindow && items && items.length > 0 && (
                <div
                  ref={isCurrent ? currentHorizontalRef : undefined}
                  onScroll={isCurrent ? handleHorizontalScroll : undefined}
                  className={`h-full w-full overflow-x-scroll snap-x snap-mandatory overscroll-x-contain touch-pan-x flex ${noScrollbar}`}
                  style={noScrollbarStyle}
                >
                  {items.map((content, j) => (
                    <div key={content.id} className="h-full w-full shrink-0 snap-start snap-always">
                      <ContentCard
                        content={content}
                        node={node}
                        breadcrumb={`${tree.title} • ${node.title}`}
                        isActive={isCurrent && j === resourceIndex}
                        muted={muted}
                        onToggleMute={toggleMute}
                        isSaved={isLearningResourceSaved(content.providerContentId, node.id)}
                        notesValue={
                          getSavedLearningResources().find(
                            (r) => r.providerContentId === content.providerContentId && r.learningNodeId === node.id
                          )?.userNotes || ""
                        }
                        timestampNotes={
                          getSavedLearningResources().find(
                            (r) => r.providerContentId === content.providerContentId && r.learningNodeId === node.id
                          )?.timestampNotes || []
                        }
                        onSave={handleSave}
                        onNotesChange={handleNotesChange}
                        onAddTimestampNote={handleAddTimestampNote}
                        onSkipNode={() => setShowSkipMenu(true)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Final section: session summary */}
        <div className="h-[100dvh] w-full snap-start snap-always relative bg-zinc-950 flex flex-col items-center justify-center text-white text-center px-8 space-y-4">
          <GraduationCap className="w-9 h-9 text-white/80" />
          <h2 className="text-lg font-bold">You've reached the end</h2>
          <p className="text-xs text-white/60">
            Completed {sessionState.completedNodeIds.length} of {activeLeafNodes.length} topics this session.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
            {completedTitles.length >= TEST_ME_THRESHOLD && (
              <button
                onClick={() => onTestMe(testMeTopics())}
                className="px-4 py-2.5 rounded-xl bg-white text-zinc-900 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-zinc-100 transition-colors"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Test Me on {completedTitles.length} Topics</span>
              </button>
            )}
            <button
              onClick={() => scrollToNodeIndex(0)}
              className="px-4 py-2.5 rounded-xl border border-white/25 text-white text-xs font-bold hover:bg-white/10 transition-colors"
            >
              Restart from the Beginning
            </button>
            <button
              onClick={() => {
                persistSession((prev) => ({ ...prev, endedAt: new Date().toISOString() }));
                onExit();
              }}
              className="px-4 py-2.5 rounded-xl text-white/60 text-xs font-bold hover:bg-white/10 transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Floating chrome (overlaid, not part of the scroll flow) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 sm:px-4 pt-3 sm:pt-4">
        <button
          onClick={onExit}
          className="pointer-events-auto p-2 rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center text-white drop-shadow px-2 min-w-0">
          <p className="text-xs font-semibold truncate max-w-[45vw] sm:max-w-[200px]">
            {currentNode ? currentNode.title : "Session Complete"}
          </p>
          <p className="text-[10px] text-white/80">
            {Math.min(nodeIndex + 1, activeLeafNodes.length)} / {activeLeafNodes.length}
          </p>
        </div>
        <button
          onClick={() => setShowJumpList((v) => !v)}
          className="pointer-events-auto p-2 rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/50"
        >
          <List className="w-5 h-5" />
        </button>
      </div>

      {budgetReached && !budgetBannerDismissed && (
        <div className="absolute inset-x-3 sm:inset-x-4 top-14 sm:top-16 z-30 flex items-center justify-between gap-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg">
          <span className="text-[11px] text-zinc-700 dark:text-zinc-300">
            Session goal reached (~{sessionState.timeLimitMinutes} min)
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {completedTitles.length >= TEST_ME_THRESHOLD && (
              <button
                onClick={() => onTestMe(testMeTopics())}
                className="text-[11px] font-medium px-2 py-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
              >
                Test Me
              </button>
            )}
            <button onClick={() => setBudgetBannerDismissed(true)} className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {currentContent && currentContent.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex items-center justify-center gap-1.5">
          {currentContent.map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === resourceIndex ? "bg-white" : "bg-white/40"}`} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showJumpList && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-14 sm:top-16 right-3 sm:right-4 left-3 sm:left-auto z-40 sm:w-64 max-h-[70vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-2 space-y-1"
          >
            {activeLeafNodes.map((n, i) => (
              <button
                key={n.id}
                onClick={() => {
                  scrollToNodeIndex(i);
                  setShowJumpList(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
                  i === nodeIndex
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="truncate">{n.title}</span>
                {sessionState.completedNodeIds.includes(n.id) && <span className="text-emerald-500 shrink-0">✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSkipMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
            onClick={() => setShowSkipMenu(false)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl w-full max-w-sm p-4 space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 px-1">Skip "{currentNode?.title}"</h3>
              <button
                onClick={skipForSession}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Skip for this session only
              </button>
              <button
                onClick={skipPermanently}
                className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Skip permanently (hide in future sessions)
              </button>
              <button
                onClick={() => setShowSkipMenu(false)}
                className="w-full text-center px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
