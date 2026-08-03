import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Globe, Layers, Sparkles, Plus, Search, Clock, Play, Edit2, Trash2, Folder, Flame, CheckCircle2, BookOpen } from "lucide-react";
import { FlashcardDeck, Flashcard, Collection } from "../../types";
import {
  getFlashcardDecks,
  getDueFlashcards,
  deleteFlashcardDeck,
  getCollections,
  saveFlashcardDeck,
} from "../../lib/storage";
import { PublishModal } from "../Community/PublishModal";
import { ConfirmModal } from "../ConfirmModal";
import { EmptyState } from "../EmptyState";
import { fadeInUp, staggerContainer } from "../../lib/motion";

interface FlashcardHubViewProps {
  onOpenDeckEditor: (deck: FlashcardDeck) => void;
  onStudyDeck: (deck: FlashcardDeck) => void;
  onOpenAIGenerator: (deck?: FlashcardDeck) => void;
  onCreateNewDeck: () => void;
  onStudyDueCards: (cards: Flashcard[]) => void;
}

export const FlashcardHubView: React.FC<FlashcardHubViewProps> = ({
  onOpenDeckEditor,
  onStudyDeck,
  onOpenAIGenerator,
  onCreateNewDeck,
  onStudyDueCards,
}) => {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [publishingDeck, setPublishingDeck] = useState<FlashcardDeck | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<FlashcardDeck | null>(null);

  const reloadData = () => {
    const loadedDecks = getFlashcardDecks();
    const loadedDue = getDueFlashcards();
    const loadedCols = getCollections();
    setDecks(loadedDecks);
    setDueCards(loadedDue);
    setCollections(loadedCols);
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleDeleteDeck = (deckId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const deck = decks.find((d) => d.id === deckId);
    if (deck) setDeckToDelete(deck);
  };

  const confirmDeleteDeck = () => {
    if (!deckToDelete) return;
    deleteFlashcardDeck(deckToDelete.id);
    setDeckToDelete(null);
    reloadData();
  };

  const filteredDecks = decks.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Hero Banner */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Active Recall & Spaced Repetition
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Flashcards Module
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
            Generate high-yield flashcard decks from your study notes or create custom decks manually with built-in spaced repetition intervals.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onOpenAIGenerator()}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold flex items-center space-x-2 shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Generate with AI</span>
          </button>

          <button
            onClick={onCreateNewDeck}
            className="px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create Deck</span>
          </button>
        </div>
      </div>

      {/* Due Flashcards Reminder Alert */}
      {dueCards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {dueCards.length} Flashcards Due for Review Today!
              </h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Spaced repetition timing indicates reviewing these cards now optimizes memory retention.
              </p>
            </div>
          </div>

          <button
            onClick={() => onStudyDueCards(dueCards)}
            className="px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-800 text-white dark:bg-amber-200 dark:hover:bg-amber-100 dark:text-amber-950 text-xs font-bold flex items-center space-x-1.5 shrink-0 shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Study Due Cards ({dueCards.length})</span>
          </button>
        </motion.div>
      )}

      {/* Toolbar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          All Decks ({decks.length})
        </h2>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search decks or subjects..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
          />
        </div>
      </div>

      {/* Decks Grid */}
      {filteredDecks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No flashcard decks found"
          message={searchQuery ? "No decks match your search query." : "Start by generating flashcards from your AI study notes or creating a deck manually."}
          action={{ label: "Generate with AI", onClick: () => onOpenAIGenerator() }}
        />
      ) : (
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredDecks.map((deck) => {
            const collectionObj = collections.find((c) => c.id === deck.collectionId);
            return (
              <motion.div
                key={deck.id}
                variants={fadeInUp}
                onClick={() => onOpenDeckEditor(deck)}
                className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[10px] font-bold uppercase tracking-wider">
                      {deck.subject}
                    </span>
                    {collectionObj && (
                      <span className="text-[11px] font-semibold text-zinc-400 flex items-center space-x-1">
                        <Folder className="w-3 h-3" />
                        <span>{collectionObj.name}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-zinc-900 dark:text-white line-clamp-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                    {deck.title}
                  </h3>

                  <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                    {deck.description || "Comprehensive active recall cards."}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    {deck.cardCount || 0} Cards
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      title="Publish deck to community"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPublishingDeck(deck);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </button>
                    <button
                      title="Delete deck"
                      onClick={(e) => handleDeleteDeck(deck.id, e)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStudyDeck(deck);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold flex items-center space-x-1 shadow-xs"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Study</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Publish Deck Modal */}
      <PublishModal
        isOpen={!!publishingDeck}
        onClose={() => setPublishingDeck(null)}
        onSuccess={reloadData}
        preselectedDeck={publishingDeck}
      />

      {/* Delete Deck Modal */}
      <ConfirmModal
        isOpen={Boolean(deckToDelete)}
        title="Delete Flashcard Deck?"
        message={`Are you sure you want to delete "${deckToDelete?.title}"? This flashcard deck and all nested flashcards inside it will be permanently deleted.`}
        confirmText="Delete Deck"
        onConfirm={confirmDeleteDeck}
        onClose={() => setDeckToDelete(null)}
      />
    </div>
  );
};
