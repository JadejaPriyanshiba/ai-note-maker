import React, { useState } from "react";
import { motion } from "motion/react";
import { Modal } from "../Modal";
import { EmptyState } from "../EmptyState";
import { fadeInUp, staggerContainer } from "../../lib/motion";
import {
  CommunityNote,
  NoteDocument,
  FlashcardDeck,
  Collection,
  CommunityTopicHub,
  SavedTest,
} from "../../types";
import {
  getCommunityNotes,
  getCommunityTopicHubs,
  remixCommunityResource,
  toggleLikeCommunityResource,
  reportCommunityResource,
  unpublishCommunityNote,
  toggleSaveTopicHub,
  remixTopicHub,
  unpublishTopicHub,
} from "../../lib/storage";
import { PublishModal } from "./PublishModal";
import { TopicHubDetailModal } from "./TopicHubDetailModal";
import { auth } from "../../lib/firebase";
import {
  Search,
  Globe,
  Filter,
  GitFork,
  BookOpen,
  Heart,
  Flag,
  ShieldCheck,
  ArrowRight,
  Layers,
  Folder,
  X,
  Share2,
  Check,
  RotateCw,
  Sparkles,
  Plus,
  Compass,
  Bookmark,
  Trash2,
} from "lucide-react";

interface CommunityViewProps {
  onOpenNoteStudio: (note: NoteDocument, readOnly?: boolean) => void;
  onOpenFlashcardDeck?: (deck: FlashcardDeck) => void;
  onOpenCollection?: (collection: Collection) => void;
  onTakeTest?: (test: SavedTest) => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  onOpenNoteStudio,
  onOpenFlashcardDeck,
  onOpenCollection,
  onTakeTest,
}) => {
  const [communityResources, setCommunityResources] = useState<CommunityNote[]>(getCommunityNotes());
  const [topicHubs, setTopicHubs] = useState<CommunityTopicHub[]>(getCommunityTopicHubs());
  const [activeTab, setActiveTab] = useState<"all" | "topic_hub" | "note" | "flashcard_deck" | "collection">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"remixed" | "new" | "likes">("remixed");

  // Read Modal State
  const [activeResource, setActiveResource] = useState<CommunityNote | null>(null);
  const [selectedHub, setSelectedHub] = useState<CommunityTopicHub | null>(null);
  
  // Card Flip state in Deck preview
  const [previewCardIdx, setPreviewCardIdx] = useState<number>(0);
  const [isCardFlipped, setIsCardFlipped] = useState<boolean>(false);

  // Report Modal State
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>("Inaccurate / misleading information");

  // Publish Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);

  const currentUserId = auth.currentUser?.uid;

  const reloadData = () => {
    setCommunityResources(getCommunityNotes());
    setTopicHubs(getCommunityTopicHubs());
  };

  // Filter logic for Notes
  let filteredNotes = communityResources.filter((c) => {
    const resType = c.resourceType || (c.content ? "note" : "flashcard_deck");
    const matchesTab = activeTab === "all" || resType === activeTab;
    const matchesQuery =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.authorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = selectedDifficulty === "all" || c.difficulty === selectedDifficulty;
    const matchesSubject = selectedSubject === "all" || c.subject === selectedSubject;
    return matchesTab && matchesQuery && matchesDifficulty && matchesSubject;
  });

  // Filter logic for Topic Hubs
  let filteredHubs = topicHubs.filter((h) => {
    const matchesTab = activeTab === "all" || activeTab === "topic_hub";
    const matchesQuery =
      h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.creatorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = selectedDifficulty === "all" || h.difficulty === selectedDifficulty;
    const matchesSubject = selectedSubject === "all" || h.subject === selectedSubject;
    return matchesTab && matchesQuery && matchesDifficulty && matchesSubject;
  });

  // Sort logic
  filteredNotes.sort((a, b) => {
    if (sortBy === "remixed") return (b.remixCount || 0) - (a.remixCount || 0);
    if (sortBy === "likes") return (b.likesCount || 0) - (a.likesCount || 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  filteredHubs.sort((a, b) => {
    if (sortBy === "remixed") return (b.remixesCount || 0) - (a.remixesCount || 0);
    if (sortBy === "likes") return (b.savesCount || 0) - (a.savesCount || 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const subjectsList = Array.from(
    new Set([
      ...communityResources.map((c) => c.subject),
      ...topicHubs.map((h) => h.subject),
    ])
  );

  const handleRemix = (resource: CommunityNote) => {
    try {
      const result = remixCommunityResource(resource);
      reloadData();
      if (result.type === "note" && result.note) {
        alert(`Remixed "${resource.title}"! Opening in Note Studio.`);
        onOpenNoteStudio(result.note);
      } else if (result.type === "flashcard_deck" && result.deck && onOpenFlashcardDeck) {
        alert(`Remixed "${resource.title}" flashcard deck! Opening in Flashcards.`);
        onOpenFlashcardDeck(result.deck);
      } else if (result.type === "collection" && result.collection && onOpenCollection) {
        alert(`Remixed "${resource.title}" collection! Opening in Collections.`);
        onOpenCollection(result.collection);
      } else if (result.note) {
        onOpenNoteStudio(result.note);
      } else {
        alert(`Remixed "${resource.title}" into your local study workspace!`);
      }
    } catch (err: any) {
      alert(`Remix failed: ${err.message || "Unknown error"}`);
    }
  };

  const handleUnpublishNote = (resourceId: string, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm(`Are you sure you want to unpublish "${title}" from the Community?`)) {
      unpublishCommunityNote(resourceId);
      alert("Resource unpublished.");
      reloadData();
    }
  };

  const handleToggleLike = (resourceId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    toggleLikeCommunityResource(resourceId);
    reloadData();
    if (activeResource && activeResource.id === resourceId) {
      const updated = getCommunityNotes().find((r) => r.id === resourceId);
      if (updated) setActiveResource(updated);
    }
  };

  const handleToggleSaveHub = (hub: CommunityTopicHub, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    toggleSaveTopicHub(hub);
    reloadData();
  };

  const handleReport = () => {
    if (!reportTargetId) return;
    reportCommunityResource(reportTargetId, reportReason);
    alert("Thank you. The resource report has been submitted to community moderators.");
    setReportTargetId(null);
    reloadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Global Open Academic Exchange
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Community Knowledge Library & Remix Hub
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Discover peer-reviewed study notes, flashcard decks, and nested collections shared by students worldwide. Read, upvote, and 1-click remix content into your workspace.
          </p>
        </div>

        {/* Global Action Button */}
        <div className="shrink-0">
          <button
            onClick={() => setIsPublishModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold text-xs flex items-center space-x-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Publish My Resource</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-4">
        {/* Resource Type Tabs */}
        <div className="flex items-center space-x-2 border-b border-zinc-100 dark:border-zinc-800 pb-3 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "all"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>All Resources ({communityResources.length + topicHubs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("topic_hub")}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "topic_hub"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Topic Hubs ({topicHubs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("note")}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "note"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Study Notes</span>
          </button>

          <button
            onClick={() => setActiveTab("flashcard_deck")}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "flashcard_deck"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Flashcard Decks</span>
          </button>

          <button
            onClick={() => setActiveTab("collection")}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeTab === "collection"
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Collections</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search community library by subject, title, or author..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-zinc-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-zinc-400 focus:outline-none placeholder-zinc-400"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
            >
              <option value="all">All Subjects</option>
              {subjectsList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
            >
              <option value="all">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold"
            >
              <option value="remixed">Most Remixed</option>
              <option value="new">Recently Published</option>
              <option value="likes">Most Upvoted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Community Cards Grid */}
      {filteredHubs.length === 0 && filteredNotes.length === 0 ? (
        <EmptyState message="No community resources match yet. Be the first to publish one." />
      ) : (
      <motion.div
        variants={staggerContainer()}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {/* Topic Hub Cards */}
        {(activeTab === "all" || activeTab === "topic_hub") &&
          filteredHubs.map((hub) => (
            <motion.div
              key={hub.id}
              variants={fadeInUp}
              onClick={() => setSelectedHub(hub)}
              className="bg-white dark:bg-zinc-900 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:shadow-md hover:border-zinc-900 dark:hover:border-zinc-100 transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative"
            >
              <div className="space-y-3">
                {/* Type Badge & Subject */}
                <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2.5 py-0.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center space-x-1">
                      <Compass className="w-3 h-3" />
                      <span>Topic Hub</span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {hub.subject}
                    </span>
                  </div>
                  <span className="text-zinc-400">{hub.difficulty || "Medium"}</span>
                </div>

                <h3 className="text-base font-extrabold text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                  {hub.title}
                </h3>

                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {hub.description}
                </p>

                {/* Resource Composition Pill */}
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1 text-blue-600 dark:text-blue-400">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{hub.stats?.notesCount || 0} Notes</span>
                    </span>
                    <span className="flex items-center space-x-1 text-purple-600 dark:text-purple-400">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{hub.stats?.decksCount || 0} Decks</span>
                    </span>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {hub.stats?.testsCount || 0} Tests
                  </span>
                </div>
              </div>

              {/* Creator & Footer Actions */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-[10px] flex items-center justify-center">
                    {(hub.creatorName || "A")[0]}
                  </div>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
                    @{hub.creatorName}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                  {/* Creator Unpublish Button */}
                  {currentUserId && hub.creatorId === currentUserId && (
                    <button
                      onClick={() => {
                        if (confirm(`Unpublish Topic Hub "${hub.title}"?`)) {
                          unpublishTopicHub(hub.id);
                          reloadData();
                        }
                      }}
                      className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold"
                      title="Unpublish Topic Hub"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleToggleSaveHub(hub, e)}
                    className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-all ${
                      hub.userSaved
                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                    title="Bookmark / Save Hub"
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${hub.userSaved ? "fill-amber-500 text-amber-500" : ""}`} />
                    <span>{hub.savesCount || 0}</span>
                  </button>

                  <button
                    onClick={() => setSelectedHub(hub)}
                    className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-[11px] font-bold flex items-center space-x-1 shadow-xs"
                  >
                    <span>Explore Hub</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

        {/* Regular Community Resource Cards (Notes, Flashcard Decks, Collections) */}
        {activeTab !== "topic_hub" &&
          filteredNotes.map((comm) => {
            const resType = comm.resourceType || (comm.content ? "note" : "flashcard_deck");
            const isAuthor = currentUserId && comm.authorId === currentUserId;
            return (
              <motion.div
                key={comm.id}
                variants={fadeInUp}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Type Badge & Subject */}
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                        {resType === "note" && <BookOpen className="w-3 h-3" />}
                        {resType === "flashcard_deck" && <Layers className="w-3 h-3" />}
                        {resType === "collection" && <Folder className="w-3 h-3" />}
                        <span className="capitalize">{resType.replace("_", " ")}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500">
                        {comm.subject}
                      </span>
                    </div>
                    <span className="text-zinc-400">{comm.difficulty}</span>
                  </div>

                  <h3 className="text-base font-bold text-zinc-900 dark:text-white line-clamp-2 leading-snug">
                    {comm.title}
                  </h3>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                    {comm.description}
                  </p>

                  {/* Content Payload Metadata Badges */}
                  {resType === "flashcard_deck" && comm.deckContent && (
                    <div className="text-[11px] font-semibold text-zinc-500 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-lg flex items-center justify-between">
                      <span>Deck: {comm.deckContent.cards.length} Flashcards</span>
                      <span>{comm.deckContent.deck.language || "English"}</span>
                    </div>
                  )}

                  {resType === "collection" && comm.collectionContent && (
                    <div className="text-[11px] font-semibold text-zinc-500 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-lg flex items-center justify-between">
                      <span>
                        Collection: {comm.collectionContent.notes.length} Notes • {comm.collectionContent.decks.length} Decks
                      </span>
                    </div>
                  )}

                  {/* Lineage notice if remixed */}
                  {comm.lineage && comm.lineage.length > 0 && (
                    <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 text-[11px] text-zinc-500 flex items-center space-x-1.5">
                      <GitFork className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">Remixed from @{comm.lineage[0].authorName}</span>
                    </div>
                  )}
                </div>

                {/* Author & Footer Actions */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-[10px] flex items-center justify-center">
                      {comm.authorName[0]}
                    </div>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">
                      @{comm.authorName}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {/* Author Unpublish / Delete option */}
                    {isAuthor && (
                      <button
                        onClick={(e) => handleUnpublishNote(comm.id, comm.title, e)}
                        className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-semibold"
                        title="Unpublish / Delete from Community"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleToggleLike(comm.id, e)}
                      className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition-all ${
                        comm.userLiked
                          ? "border-rose-200 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                      title="Upvote / Like resource"
                    >
                      <Heart className={`w-3.5 h-3.5 ${comm.userLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                      <span>{comm.likesCount}</span>
                    </button>

                    <button
                      onClick={() => {
                        if (resType === "note" || comm.content) {
                          const noteDoc: NoteDocument = comm.content || {
                            id: comm.id,
                            title: comm.title,
                            subject: comm.subject,
                            learnerLevel: (comm.difficulty as any) || "Intermediate",
                            complexity: (comm.difficulty as any) || "Medium",
                            depth: "Comprehensive",
                            language: comm.language || "English",
                            createdAt: comm.createdAt,
                            updatedAt: comm.createdAt,
                            sections: [],
                            authorName: comm.authorName,
                            authorId: comm.authorId,
                            communityId: comm.id,
                          };
                          onOpenNoteStudio(noteDoc, true);
                        } else {
                          setActiveResource(comm);
                          setPreviewCardIdx(0);
                          setIsCardFlipped(false);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Read
                    </button>

                    <button
                      onClick={() => handleRemix(comm)}
                      className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-[11px] font-semibold flex items-center space-x-1 shadow-xs"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      <span>Remix ({comm.remixCount})</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
      </motion.div>
      )}

      {/* Read / Preview Resource Modal */}
      <Modal isOpen={!!activeResource} onClose={() => setActiveResource(null)} panelClassName="max-w-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
        {activeResource && (<>
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs font-bold uppercase text-zinc-500">
                  <span>{activeResource.subject}</span>
                  <span>•</span>
                  <span>Published by @{activeResource.authorName}</span>
                </div>
                <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white">
                  {activeResource.title}
                </h2>
              </div>
              <button
                onClick={() => setActiveResource(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lineage & Source Notice */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-xs text-zinc-600 dark:text-zinc-300">
              <div>
                <strong>Source:</strong> {activeResource.sourceType}
                {activeResource.sourceNotice && ` (${activeResource.sourceNotice})`}
              </div>
              {activeResource.lineage && activeResource.lineage.length > 0 && (
                <div className="flex items-center space-x-1 text-zinc-500">
                  <GitFork className="w-3.5 h-3.5" />
                  <span>
                    Lineage: Originally by @{activeResource.lineage[0].authorName}
                  </span>
                </div>
              )}
            </div>

            {/* Resource Specific Body Preview */}
            <div className="space-y-4">
              {/* Note Preview */}
              {(activeResource.resourceType === "note" || activeResource.content) && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                    {activeResource.description}
                  </p>
                  {(activeResource.content?.sections || []).map((sec) => (
                    <div key={sec.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 space-y-2">
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white">{sec.title}</h3>
                      {sec.summary && <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">{sec.summary}</p>}
                      <div className="space-y-1.5 pt-2">
                        {(sec.blocks || []).slice(0, 4).map((b) => (
                          <div key={b.id} className="text-xs text-zinc-700 dark:text-zinc-300">
                            {b.type === "heading" && <span className="font-bold">{b.content}</span>}
                            {b.type === "paragraph" && <span>{b.content}</span>}
                            {b.type === "student_tag" && (
                              <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-[11px] font-medium border border-amber-200/60 dark:border-amber-800/60">
                                <strong>[{b.tagType?.toUpperCase()}]:</strong> {b.content}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Flashcard Deck Preview */}
              {activeResource.resourceType === "flashcard_deck" && activeResource.deckContent && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {activeResource.description}
                  </p>

                  <div className="p-6 rounded-3xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-center space-y-4 shadow-inner min-h-[160px] flex flex-col justify-center items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                      Card {previewCardIdx + 1} of {activeResource.deckContent.cards.length} • {isCardFlipped ? "Back (Answer)" : "Front (Question)"}
                    </span>
                    <p className="text-base font-bold max-w-md">
                      {isCardFlipped
                        ? activeResource.deckContent.cards[previewCardIdx]?.back
                        : activeResource.deckContent.cards[previewCardIdx]?.front}
                    </p>
                    <button
                      onClick={() => setIsCardFlipped(!isCardFlipped)}
                      className="px-3 py-1.5 rounded-xl bg-white/20 dark:bg-zinc-900/20 text-xs font-semibold flex items-center space-x-1"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Flip Card</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      disabled={previewCardIdx === 0}
                      onClick={() => {
                        setPreviewCardIdx((prev) => Math.max(0, prev - 1));
                        setIsCardFlipped(false);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                    >
                      ← Previous Card
                    </button>

                    <button
                      disabled={previewCardIdx >= activeResource.deckContent.cards.length - 1}
                      onClick={() => {
                        setPreviewCardIdx((prev) => Math.min(activeResource.deckContent!.cards.length - 1, prev + 1));
                        setIsCardFlipped(false);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
                    >
                      Next Card →
                    </button>
                  </div>
                </div>
              )}

              {/* Collection Preview */}
              {activeResource.resourceType === "collection" && activeResource.collectionContent && (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {activeResource.description}
                  </p>

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-zinc-500">
                      Collection Contents
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(activeResource.collectionContent.notes || []).map((n) => (
                        <div key={n.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center space-x-2 text-xs">
                          <BookOpen className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="font-semibold text-zinc-900 dark:text-white truncate">{n.title}</span>
                        </div>
                      ))}

                      {(activeResource.collectionContent.decks || []).map((d) => (
                        <div key={d.deck.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 flex items-center space-x-2 text-xs">
                          <Layers className="w-4 h-4 text-zinc-500 shrink-0" />
                          <span className="font-semibold text-zinc-900 dark:text-white truncate">{d.deck.title} ({d.cards.length} cards)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setReportTargetId(activeResource.id)}
                className="text-xs font-semibold text-zinc-500 hover:text-rose-600 flex items-center space-x-1"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Report Content</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleToggleLike(activeResource.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border ${
                    activeResource.userLiked
                      ? "border-rose-200 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                      : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${activeResource.userLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                  <span>Upvote ({activeResource.likesCount})</span>
                </button>

                <button
                  onClick={() => {
                    const target = activeResource;
                    setActiveResource(null);
                    handleRemix(target);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold text-xs flex items-center space-x-2 shadow-xs"
                >
                  <GitFork className="w-4 h-4" />
                  <span>Remix into Workspace</span>
                </button>
              </div>
            </div>
        </>)}
      </Modal>

      {/* Content Report Modal */}
      <Modal isOpen={!!reportTargetId} onClose={() => setReportTargetId(null)} panelClassName="max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center space-x-2">
              <Flag className="w-4 h-4 text-rose-500" />
              <span>Report Resource</span>
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Flag this community content for review by platform safety guidelines.
            </p>

            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-white"
            >
              <option value="Inaccurate / misleading information">Inaccurate / misleading information</option>
              <option value="Copyright violation / unauthorized sharing">Copyright violation / unauthorized sharing</option>
              <option value="Offensive or spam material">Offensive or spam material</option>
              <option value="Exposes private personal credentials">Exposes private personal credentials</option>
            </select>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setReportTargetId(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700"
              >
                Submit Flag
              </button>
            </div>
      </Modal>

      {/* Global Publish Modal */}
      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onSuccess={reloadData}
      />

      {/* Topic Hub Detail & Explorer Modal */}
      <TopicHubDetailModal
        hub={selectedHub}
        onClose={() => setSelectedHub(null)}
        onRefresh={reloadData}
        onOpenNoteStudio={onOpenNoteStudio}
        onOpenFlashcards={onOpenFlashcardDeck}
        onTakeTest={onTakeTest}
      />
    </div>
  );
};
