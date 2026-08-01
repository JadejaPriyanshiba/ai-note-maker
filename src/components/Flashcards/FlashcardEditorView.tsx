import React, { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Edit3,
  Save,
  ArrowLeft,
  Sparkles,
  Download,
  Upload,
  Check,
  Folder,
  X,
  FileText
} from "lucide-react";
import { FlashcardDeck, Flashcard, Collection } from "../../types";
import {
  getFlashcards,
  saveFlashcard,
  deleteFlashcard,
  saveFlashcardDeck,
  deleteFlashcardDeck,
  getCollections,
  saveFlashcardBatch,
} from "../../lib/storage";
import { CollectionSelectorModal } from "../Collections/CollectionSelectorModal";
import { ConfirmModal } from "../ConfirmModal";

interface FlashcardEditorViewProps {
  deck: FlashcardDeck;
  onBack: () => void;
  onStudyDeck: (deck: FlashcardDeck) => void;
  onOpenAIGenerator: (deck: FlashcardDeck) => void;
}

export const FlashcardEditorView: React.FC<FlashcardEditorViewProps> = ({
  deck,
  onBack,
  onStudyDeck,
  onOpenAIGenerator,
}) => {
  const [currentDeck, setCurrentDeck] = useState<FlashcardDeck>(deck);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Editing Deck Info
  const [deckTitle, setDeckTitle] = useState(deck.title);
  const [deckSubject, setDeckSubject] = useState(deck.subject);
  const [deckDesc, setDeckDesc] = useState(deck.description || "");
  const [collectionId, setCollectionId] = useState<string | null>(deck.collectionId || null);

  // New / Editing Card State
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const [cardExplanation, setCardExplanation] = useState("");
  const [cardExample, setCardExample] = useState("");
  const [cardHint, setCardHint] = useState("");

  // Modals
  const [isFolderSelectorOpen, setIsFolderSelectorOpen] = useState(false);
  const [cardToDeleteId, setCardToDeleteId] = useState<string | null>(null);
  const [showDeckDeleteConfirm, setShowDeckDeleteConfirm] = useState(false);

  const reloadCards = () => {
    const loadedCards = getFlashcards(deck.id);
    setCards(loadedCards);
  };

  useEffect(() => {
    setCurrentDeck(deck);
    setDeckTitle(deck.title);
    setDeckSubject(deck.subject);
    setDeckDesc(deck.description || "");
    setCollectionId(deck.collectionId || null);
    setCollections(getCollections());
    reloadCards();
  }, [deck]);

  const handleSaveDeckInfo = () => {
    const updated: FlashcardDeck = {
      ...currentDeck,
      title: deckTitle.trim(),
      subject: deckSubject.trim(),
      description: deckDesc.trim(),
      collectionId: collectionId,
      cardCount: cards.length,
    };
    saveFlashcardDeck(updated);
    setCurrentDeck(updated);
  };

  const handleOpenAddCard = () => {
    setEditingCardId(null);
    setCardFront("");
    setCardBack("");
    setCardExplanation("");
    setCardExample("");
    setCardHint("");
    setIsEditingCard(true);
  };

  const handleEditCard = (c: Flashcard) => {
    setEditingCardId(c.id);
    setCardFront(c.front);
    setCardBack(c.back);
    setCardExplanation(c.explanation || "");
    setCardExample(c.example || "");
    setCardHint(c.hint || "");
    setIsEditingCard(true);
  };

  const handleSaveCard = (andAddAnother: boolean = false) => {
    if (!cardFront.trim() || !cardBack.trim()) return;

    const newCard: Flashcard = {
      id: editingCardId || `fc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      deckId: currentDeck.id,
      front: cardFront.trim(),
      back: cardBack.trim(),
      explanation: cardExplanation.trim() || undefined,
      example: cardExample.trim() || undefined,
      hint: cardHint.trim() || undefined,
      orderIndex: editingCardId
        ? (cards.find((c) => c.id === editingCardId)?.orderIndex || cards.length)
        : cards.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveFlashcard(newCard);
    reloadCards();

    // Update deck card count
    const updatedDeck = { ...currentDeck, cardCount: cards.length + (editingCardId ? 0 : 1) };
    saveFlashcardDeck(updatedDeck);
    setCurrentDeck(updatedDeck);

    if (andAddAnother) {
      setEditingCardId(null);
      setCardFront("");
      setCardBack("");
      setCardExplanation("");
      setCardExample("");
      setCardHint("");
    } else {
      setIsEditingCard(false);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    setCardToDeleteId(cardId);
  };

  const confirmDeleteCard = () => {
    if (!cardToDeleteId) return;
    deleteFlashcard(cardToDeleteId);
    reloadCards();
    const updatedDeck = { ...currentDeck, cardCount: Math.max(0, cards.length - 1) };
    saveFlashcardDeck(updatedDeck);
    setCurrentDeck(updatedDeck);
    setCardToDeleteId(null);
  };

  const handleDeleteDeck = () => {
    deleteFlashcardDeck(currentDeck.id);
    onBack();
  };

  // JSON Export
  const handleExportJSON = () => {
    const exportData = {
      deck: currentDeck,
      cards: cards,
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentDeck.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_flashcards.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON Import
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const importedCards: Flashcard[] = (parsed.cards || parsed || []).map((c: any, idx: number) => ({
          id: `fc_imp_${Date.now()}_${idx}`,
          deckId: currentDeck.id,
          front: c.front || c.question || "",
          back: c.back || c.answer || "",
          explanation: c.explanation,
          example: c.example,
          hint: c.hint,
          orderIndex: cards.length + idx,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })).filter((c: Flashcard) => c.front && c.back);

        if (importedCards.length > 0) {
          saveFlashcardBatch(importedCards);
          reloadCards();
          alert(`Successfully imported ${importedCards.length} cards into this deck!`);
        } else {
          alert("No valid flashcards found in the JSON file.");
        }
      } catch (err) {
        alert("Failed to parse JSON file. Ensure correct schema: { cards: [{ front, back }] }");
      }
    };
    reader.readAsText(file);
  };

  const collectionObj = collections.find((c) => c.id === collectionId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Library</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowDeckDeleteConfirm(true)}
            className="px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/60 flex items-center space-x-1"
            title="Delete this deck and all cards"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Deck</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <label className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            onClick={() => onStudyDeck(currentDeck)}
            disabled={cards.length === 0}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
          >
            <Layers className="w-4 h-4" />
            <span>Study Deck ({cards.length})</span>
          </button>
        </div>
      </div>

      {/* Deck Overview & Settings Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold uppercase tracking-wider">
                Flashcard Deck
              </span>
              <button
                onClick={() => setIsFolderSelectorOpen(true)}
                className="px-2.5 py-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
              >
                <Folder className="w-3 h-3" />
                <span>{collectionObj ? collectionObj.name : "Root Directory"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                onBlur={handleSaveDeckInfo}
                placeholder="Deck Title"
                className="text-lg font-bold text-zinc-900 dark:text-white bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-500 outline-none px-1"
              />
              <input
                type="text"
                value={deckSubject}
                onChange={(e) => setDeckSubject(e.target.value)}
                onBlur={handleSaveDeckInfo}
                placeholder="Subject / Topic"
                className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-500 outline-none px-1"
              />
            </div>
          </div>

          <button
            onClick={() => onOpenAIGenerator(currentDeck)}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-bold flex items-center space-x-2 shrink-0 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <span>+ Generate Cards with AI</span>
          </button>
        </div>
      </div>

      {/* Cards List Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          Cards in Deck ({cards.length})
        </h3>
        <button
          onClick={handleOpenAddCard}
          className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold flex items-center space-x-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Card Manually</span>
        </button>
      </div>

      {/* Add / Edit Single Card Drawer/Form */}
      {isEditingCard && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-3xl p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              {editingCardId ? "Edit Flashcard" : "New Flashcard"}
            </h4>
            <button
              onClick={() => setIsEditingCard(false)}
              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Front (Question / Prompt) *
              </label>
              <textarea
                value={cardFront}
                onChange={(e) => setCardFront(e.target.value)}
                placeholder="What is the function of Layer 4 in the OSI model?"
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Back (Answer) *
              </label>
              <textarea
                value={cardBack}
                onChange={(e) => setCardBack(e.target.value)}
                placeholder="Provides process-to-process communication and segmentation (TCP/UDP)."
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Explanation (Optional)
              </label>
              <input
                type="text"
                value={cardExplanation}
                onChange={(e) => setCardExplanation(e.target.value)}
                placeholder="Why this answer is correct..."
                className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Example (Optional)
              </label>
              <input
                type="text"
                value={cardExample}
                onChange={(e) => setCardExample(e.target.value)}
                placeholder="HTTP port 80 / HTTPS port 443"
                className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Hint (Optional)
              </label>
              <input
                type="text"
                value={cardHint}
                onChange={(e) => setCardHint(e.target.value)}
                placeholder="Clue for recall..."
                className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              onClick={() => setIsEditingCard(false)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            {!editingCardId && (
              <button
                onClick={() => handleSaveCard(true)}
                disabled={!cardFront.trim() || !cardBack.trim()}
                className="px-3.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Save & Add Another
              </button>
            )}
            <button
              onClick={() => handleSaveCard(false)}
              disabled={!cardFront.trim() || !cardBack.trim()}
              className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold disabled:opacity-50"
            >
              Save Card
            </button>
          </div>
        </div>
      )}

      {/* Cards List Grid */}
      {cards.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-3">
          <Layers className="w-8 h-8 text-zinc-400 mx-auto" />
          <h4 className="text-sm font-bold text-zinc-900 dark:text-white">This deck is empty</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Add cards manually or generate flashcards instantly using AI from your notes.
          </p>
          <div className="pt-2 flex justify-center space-x-2">
            <button
              onClick={handleOpenAddCard}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold"
            >
              + Add First Card
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {cards.map((c, idx) => (
            <div
              key={c.id}
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-zinc-400">Card #{idx + 1}</span>
                  {c.timesSeen ? (
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      Studied {c.timesSeen}x ({c.timesCorrect || 0} correct)
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">New</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white">Q: </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{c.front}</span>
                  </div>
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-white">A: </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{c.back}</span>
                  </div>
                </div>

                {(c.explanation || c.example || c.hint) && (
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-400 pt-1">
                    {c.hint && <span>💡 Hint: {c.hint}</span>}
                    {c.explanation && <span>📖 {c.explanation}</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-1 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => handleEditCard(c)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteCard(c.id)}
                  className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Move Deck Folder Modal */}
      <CollectionSelectorModal
        isOpen={isFolderSelectorOpen}
        onClose={() => setIsFolderSelectorOpen(false)}
        title="Move Flashcard Deck to Folder"
        selectedCollectionId={collectionId}
        onSelectCollection={(newColId) => {
          setCollectionId(newColId);
          saveFlashcardDeck({ ...currentDeck, collectionId: newColId });
        }}
      />

      {/* Delete Card Modal */}
      <ConfirmModal
        isOpen={Boolean(cardToDeleteId)}
        title="Delete Flashcard?"
        message="Are you sure you want to delete this flashcard?"
        confirmText="Delete Card"
        onConfirm={confirmDeleteCard}
        onClose={() => setCardToDeleteId(null)}
      />

      {/* Delete Deck Modal */}
      <ConfirmModal
        isOpen={showDeckDeleteConfirm}
        title="Delete Flashcard Deck?"
        message={`Are you sure you want to delete "${currentDeck.title}"? This flashcard deck and all nested flashcards inside it will be permanently deleted.`}
        confirmText="Delete Deck"
        onConfirm={handleDeleteDeck}
        onClose={() => setShowDeckDeleteConfirm(false)}
      />
    </div>
  );
};
