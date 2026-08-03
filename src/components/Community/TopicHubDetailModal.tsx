import React, { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  Layers,
  HelpCircle,
  GitFork,
  Bookmark,
  Share2,
  Trash2,
  Check,
  ChevronRight,
  Clock,
  User,
  Sparkles,
  ArrowRight,
  RotateCw,
} from "lucide-react";
import {
  CommunityTopicHub,
  TopicHubResource,
  NoteDocument,
  FlashcardDeck,
  SavedTest,
} from "../../types";
import {
  toggleSaveTopicHub,
  remixTopicHub,
  unpublishTopicHub,
} from "../../lib/storage";
import { auth } from "../../lib/firebase";
import { Modal } from "../Modal";

interface TopicHubDetailModalProps {
  hub: CommunityTopicHub | null;
  onClose: () => void;
  onRefresh: () => void;
  onOpenNoteStudio?: (note: NoteDocument) => void;
  onOpenFlashcards?: (deck: FlashcardDeck) => void;
  onTakeTest?: (test: SavedTest) => void;
}

export const TopicHubDetailModal: React.FC<TopicHubDetailModalProps> = ({
  hub,
  onClose,
  onRefresh,
  onOpenNoteStudio,
  onOpenFlashcards,
  onTakeTest,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "learning_path" | "resources" | "lineage">("overview");
  const [selectedResource, setSelectedResource] = useState<TopicHubResource | null>(null);

  // Deck preview flip state
  const [cardIdx, setCardIdx] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Keeps rendering the last-open hub's content while the close animation plays (the `hub`
  // prop itself goes null immediately on close, which would otherwise blank the modal mid-exit).
  const [displayHub, setDisplayHub] = useState<CommunityTopicHub | null>(hub);
  useEffect(() => {
    if (hub) setDisplayHub(hub);
  }, [hub]);

  // Reset per-hub UI state only when actually switching to a *different* hub — not on every
  // content refresh of the same hub (e.g. a save-count bump), which previously left stale
  // activeTab/selectedResource/flip state behind when jumping between hubs without closing.
  useEffect(() => {
    if (!hub) return;
    setActiveTab("overview");
    setSelectedResource(displayHub.resources && displayHub.resources.length > 0 ? displayHub.resources[0] : null);
    setCardIdx(0);
    setIsFlipped(false);
  }, [hub?.id]);

  if (!displayHub) return null;

  const currentUserId = auth.currentUser?.uid;
  const isCreator = currentUserId ? displayHub.creatorId === currentUserId : false;

  const handleToggleSave = () => {
    toggleSaveTopicHub(displayHub);
    onRefresh();
  };

  const handleRemixHub = () => {
    try {
      const remixed = remixTopicHub(displayHub);
      alert(`Remixed Topic Hub "${displayHub.title}" into your private workspace!`);
      onRefresh();
      onClose();
    } catch (e: any) {
      alert(`Failed to remix topic hub: ${e.message || "Unknown error"}`);
    }
  };

  const handleUnpublish = () => {
    if (confirm(`Are you sure you want to unpublish "${displayHub.title}" from the Community?`)) {
      unpublishTopicHub(displayHub.id);
      alert("Topic Hub unpublished.");
      onRefresh();
      onClose();
    }
  };

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case "note":
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      case "flashcard_deck":
        return <Layers className="w-4 h-4 text-purple-500" />;
      case "test":
        return <HelpCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <BookOpen className="w-4 h-4 text-zinc-500" />;
    }
  };

  return (
    <Modal isOpen={!!hub} onClose={onClose} panelClassName="max-w-4xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
              <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                {displayHub.subject}
              </span>
              {displayHub.topic && (
                <>
                  <span>•</span>
                  <span>{displayHub.topic}</span>
                </>
              )}
              {displayHub.difficulty && (
                <>
                  <span>•</span>
                  <span className="text-zinc-400">{displayHub.difficulty}</span>
                </>
              )}
              {displayHub.version && displayHub.version > 1 && (
                <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono text-[10px]">
                  v{displayHub.version}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
              {displayHub.title}
            </h1>

            <div className="flex items-center space-x-3 text-xs text-zinc-500">
              <div className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  @{displayHub.creatorName}
                </span>
              </div>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Est. {displayHub.stats?.estimatedStudyMinutes || 45} mins</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-zinc-100 dark:border-zinc-800 pb-3 text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "overview"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Overview
          </button>

          <button
            onClick={() => setActiveTab("learning_path")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "learning_path"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Learning Path ({displayHub.learningPath?.length || displayHub.resources.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("resources")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "resources"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            Resources ({displayHub.resources.length})
          </button>

          {displayHub.lineage && displayHub.lineage.length > 0 && (
            <button
              onClick={() => setActiveTab("lineage")}
              className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-1.5 ${
                activeTab === "lineage"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Lineage ({displayHub.lineage.length})</span>
            </button>
          )}
        </div>

        {/* Tab Contents */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {displayHub.description}
            </p>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-center space-y-1">
                <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                  {displayHub.stats?.notesCount || 0}
                </span>
                <p className="text-xs font-semibold text-zinc-500">Notes</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-center space-y-1">
                <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
                  {displayHub.stats?.decksCount || 0}
                </span>
                <p className="text-xs font-semibold text-zinc-500">Flashcard Decks</p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-center space-y-1">
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {displayHub.stats?.testsCount || 0}
                </span>
                <p className="text-xs font-semibold text-zinc-500">Practice Tests</p>
              </div>
            </div>

            {/* Included Resources Preview List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Included Topic Resources
              </h3>
              <div className="space-y-2">
                {displayHub.resources.map((res, index) => (
                  <div
                    key={res.id || index}
                    className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 shadow-xs">
                        {getResourceTypeIcon(res.resourceType)}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-zinc-900 dark:text-white">
                          {res.title}
                        </h4>
                        <span className="text-[11px] text-zinc-500 capitalize">
                          {res.resourceType.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedResource(res);
                        setActiveTab("resources");
                      }}
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "learning_path" && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Follow this structured step-by-step learning progression to master the topic systematically.
            </p>

            <div className="relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-6">
              {(displayHub.learningPath || displayHub.resources.map((r, i) => ({
                stepIndex: i + 1,
                title: r.title,
                description: r.description,
                resourceType: r.resourceType,
                resourceId: r.resourceId,
              }))).map((step, idx) => (
                <div key={idx} className="relative space-y-2">
                  <div className="absolute -left-[31px] top-0.5 w-6 h-6 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-extrabold text-[11px] flex items-center justify-center">
                    {step.stepIndex || idx + 1}
                  </div>

                  <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getResourceTypeIcon(step.resourceType)}
                        <h4 className="font-bold text-sm text-zinc-900 dark:text-white">
                          {step.title}
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-zinc-500 uppercase">
                        {step.resourceType.replace("_", " ")}
                      </span>
                    </div>

                    {step.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "resources" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Resource Selector List */}
            <div className="space-y-2 md:col-span-1 border-r border-zinc-200 dark:border-zinc-800 pr-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Topic Items
              </h3>
              {displayHub.resources.map((res) => (
                <button
                  key={res.id}
                  onClick={() => {
                    setSelectedResource(res);
                    setCardIdx(0);
                    setIsFlipped(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl border flex items-center space-x-3 transition-all ${
                    selectedResource?.id === res.id
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <div className="shrink-0">{getResourceTypeIcon(res.resourceType)}</div>
                  <div className="truncate">
                    <p className="font-bold text-xs truncate">{res.title}</p>
                    <span className="text-[10px] opacity-70 capitalize">
                      {res.resourceType.replace("_", " ")}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Right Column: Selected Resource Preview & Actions */}
            <div className="md:col-span-2 space-y-4">
              {selectedResource ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-zinc-500">
                        {selectedResource.resourceType.replace("_", " ")}
                      </span>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                        {selectedResource.title}
                      </h3>
                    </div>

                    {/* Direct Launch Actions */}
                    {selectedResource.noteContent && onOpenNoteStudio && (
                      <button
                        onClick={() => onOpenNoteStudio(selectedResource.noteContent!)}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs flex items-center space-x-1"
                      >
                        <span>Open in Note Studio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {selectedResource.deckContent && onOpenFlashcards && (
                      <button
                        onClick={() => onOpenFlashcards(selectedResource.deckContent!.deck)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs flex items-center space-x-1"
                      >
                        <span>Study Flashcards</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {selectedResource.testContent && onTakeTest && (
                      <button
                        onClick={() => onTakeTest(selectedResource.testContent!)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center space-x-1"
                      >
                        <span>Take Practice Test</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Body Content Preview */}
                  {selectedResource.noteContent && (
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3 max-h-[300px] overflow-y-auto text-xs">
                      {(selectedResource.noteContent.sections || []).map((sec) => (
                        <div key={sec.id} className="space-y-1">
                          <h4 className="font-bold text-zinc-900 dark:text-white">{sec.title}</h4>
                          <p className="text-zinc-600 dark:text-zinc-400">{sec.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedResource.deckContent && (
                    <div className="space-y-3">
                      <div className="p-6 rounded-3xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-center space-y-3 shadow-inner min-h-[140px] flex flex-col justify-center items-center">
                        <span className="text-[10px] font-bold uppercase opacity-60">
                          Card {cardIdx + 1} of {selectedResource.deckContent.cards.length}
                        </span>
                        <p className="text-sm font-bold max-w-sm">
                          {isFlipped
                            ? selectedResource.deckContent.cards[cardIdx]?.back
                            : selectedResource.deckContent.cards[cardIdx]?.front}
                        </p>
                        <button
                          onClick={() => setIsFlipped(!isFlipped)}
                          className="px-3 py-1 rounded-xl bg-white/20 dark:bg-zinc-900/20 text-xs font-semibold flex items-center space-x-1"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Flip</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <button
                          disabled={cardIdx === 0}
                          onClick={() => {
                            setCardIdx((p) => Math.max(0, p - 1));
                            setIsFlipped(false);
                          }}
                          className="px-3 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          disabled={cardIdx >= selectedResource.deckContent.cards.length - 1}
                          onClick={() => {
                            setCardIdx((p) => Math.min(selectedResource.deckContent!.cards.length - 1, p + 1));
                            setIsFlipped(false);
                          }}
                          className="px-3 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedResource.testContent && (
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-2">
                      <h4 className="font-bold text-zinc-900 dark:text-white">
                        {selectedResource.testContent.title}
                      </h4>
                      <p className="text-zinc-600 dark:text-zinc-400">
                        {selectedResource.testContent.questions.length} Practice Questions • {selectedResource.testContent.subject}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  Select a resource on the left to preview.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "lineage" && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Provenance and attribution tree tracking community evolution of this topic displayHub.
            </p>

            <div className="space-y-3">
              {(displayHub.lineage || []).map((lin, idx) => (
                <div
                  key={lin.id || idx}
                  className="p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <GitFork className="w-4 h-4 text-zinc-500" />
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-white">{lin.title}</h4>
                      <span className="text-[11px] text-zinc-500">By @{lin.authorName}</span>
                    </div>
                  </div>
                  {lin.date && (
                    <span className="text-[10px] text-zinc-400">
                      {new Date(lin.date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            {isCreator && (
              <button
                onClick={handleUnpublish}
                className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center space-x-1.5 hover:bg-rose-100 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Unpublish Topic Hub</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleSave}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border transition-all ${
                displayHub.userSaved
                  ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${displayHub.userSaved ? "fill-amber-500 text-amber-500" : ""}`} />
              <span>{displayHub.userSaved ? "Saved" : "Save Hub"} ({displayHub.savesCount || 0})</span>
            </button>

            <button
              onClick={handleRemixHub}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold text-xs flex items-center space-x-1.5 shadow-xs"
            >
              <GitFork className="w-4 h-4" />
              <span>Remix Entire Topic Hub ({displayHub.remixesCount || 0})</span>
            </button>
          </div>
        </div>
    </Modal>
  );
};
