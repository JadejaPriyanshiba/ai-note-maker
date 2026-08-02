import React, { useState, useEffect } from "react";
import { Sparkles, Loader2, X, Check, Edit2, Trash2, Layers, Folder, Plus } from "lucide-react";
import { NoteDocument, FlashcardDeck, Flashcard, Collection } from "../../types";
import { generateFlashcards } from "../../lib/aiService";
import { getCollections, saveFlashcardDeck, saveFlashcardBatch, getSavedNotes } from "../../lib/storage";
import { Modal } from "../Modal";

interface AIFlashcardGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedNote?: NoteDocument | null;
  preselectedCollectionId?: string | null;
  onDeckCreated?: (deck: FlashcardDeck) => void;
}

export const AIFlashcardGeneratorModal: React.FC<AIFlashcardGeneratorModalProps> = ({
  isOpen,
  onClose,
  preselectedNote,
  preselectedCollectionId,
  onDeckCreated,
}) => {
  const [allNotes, setAllNotes] = useState<NoteDocument[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Form State
  const [selectedNoteId, setSelectedNoteId] = useState<string>(preselectedNote?.id || "");
  const [topic, setTopic] = useState<string>(preselectedNote?.title || "");
  const [contentSnippet, setContentSnippet] = useState<string>("");
  const [count, setCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<string>("Medium");
  const [focus, setFocus] = useState<string>("Key concepts & exam preparation");
  const [collectionId, setCollectionId] = useState<string | null>(preselectedCollectionId || preselectedNote?.collectionId || null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generated Cards Preview
  const [generatedCards, setGeneratedCards] = useState<{
    front: string;
    back: string;
    explanation?: string;
    example?: string;
    hint?: string;
  }[]>([]);
  const [step, setStep] = useState<"configure" | "preview">("configure");

  // Editing single card during preview
  const [editingCardIdx, setEditingCardIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const notes = getSavedNotes();
    const cols = getCollections();
    setAllNotes(notes);
    setCollections(cols);

    if (preselectedNote) {
      setSelectedNoteId(preselectedNote.id);
      setTopic(preselectedNote.title);
      // Combine summaries
      const text = preselectedNote.sections.map((s) => `${s.title}: ${s.summary}`).join("\n\n");
      setContentSnippet(text);
      setCollectionId(preselectedNote.collectionId || null);
    }
  }, [isOpen, preselectedNote]);

  const handleNoteSelectChange = (noteId: string) => {
    setSelectedNoteId(noteId);
    const found = allNotes.find((n) => n.id === noteId);
    if (found) {
      setTopic(found.title);
      const text = found.sections.map((s) => `${s.title}: ${s.summary}`).join("\n\n");
      setContentSnippet(text);
      if (!collectionId) {
        setCollectionId(found.collectionId || null);
      }
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const cards = await generateFlashcards({
        topic: topic.trim(),
        content: contentSnippet,
        count,
        difficulty,
        focus,
        language: "English",
      });

      setGeneratedCards(cards);
      setStep("preview");
    } catch (err: any) {
      setError(err.message || "Failed to generate flashcards. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDeck = () => {
    if (generatedCards.length === 0) return;

    const deckId = `deck_${Date.now()}`;
    const newDeck: FlashcardDeck = {
      id: deckId,
      ownerId: "user_local_1",
      collectionId: collectionId,
      title: `${topic} Flashcards`,
      description: `AI-generated deck covering ${topic} (${difficulty} level).`,
      subject: topic,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceNoteId: selectedNoteId || undefined,
      cardCount: generatedCards.length,
    };

    const newCards: Flashcard[] = generatedCards.map((c, idx) => ({
      id: `fc_${Date.now()}_${idx}`,
      deckId: deckId,
      front: c.front,
      back: c.back,
      explanation: c.explanation,
      example: c.example,
      hint: c.hint,
      orderIndex: idx,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    saveFlashcardDeck(newDeck);
    saveFlashcardBatch(newCards);

    if (onDeckCreated) {
      onDeckCreated(newDeck);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} panelClassName="max-w-2xl p-6 shadow-2xl space-y-5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">
              AI Flashcard Generator
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-medium">
              {error}
            </div>
          )}

          {step === "configure" ? (
            <form id="gen-form" onSubmit={handleGenerate} className="space-y-4">
              {/* Optional Note Source Picker */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Source Note (Optional)
                </label>
                <select
                  value={selectedNoteId}
                  onChange={(e) => handleNoteSelectChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
                >
                  <option value="">-- Custom Topic / Manual Text --</option>
                  {allNotes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.subject})
                    </option>
                  ))}
                </select>
              </div>

              {/* Topic Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Topic / Subject Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. OSI Layer 4 Protocols & TCP/UDP"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
                />
              </div>

              {/* Content / Source Text Snippet */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Source Content / Key Points (Optional)
                </label>
                <textarea
                  placeholder="Paste section notes, key definitions, or text to extract cards from..."
                  value={contentSnippet}
                  onChange={(e) => setContentSnippet(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none resize-none"
                />
              </div>

              {/* Generation Parameters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Card Count
                  </label>
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
                  >
                    <option value={5}>5 Cards (Quick Revision)</option>
                    <option value={10}>10 Cards (Standard Deck)</option>
                    <option value={15}>15 Cards (Comprehensive)</option>
                    <option value={20}>20 Cards (Deep Exam Prep)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
                  >
                    <option value="Beginner">Beginner (Basic definitions)</option>
                    <option value="Medium">Medium (Balanced questions)</option>
                    <option value="Advanced">Advanced (Deep mechanics)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Save to Folder
                  </label>
                  <select
                    value={collectionId || ""}
                    onChange={(e) => setCollectionId(e.target.value || null)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
                  >
                    <option value="">Root (Unorganized)</option>
                    {collections.map((col) => (
                      <option key={col.id} value={col.id}>
                        📂 {col.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </form>
          ) : (
            /* PREVIEW GENERATED CARDS STEP */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Generated {generatedCards.length} Cards for "{topic}"
                </p>
                <button
                  onClick={() => setStep("configure")}
                  className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline"
                >
                  ← Re-configure Parameters
                </button>
              </div>

              <div className="space-y-3">
                {generatedCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-2 relative group"
                  >
                    {editingCardIdx === idx ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={card.front}
                          onChange={(e) => {
                            const updated = [...generatedCards];
                            updated[idx].front = e.target.value;
                            setGeneratedCards(updated);
                          }}
                          placeholder="Front Question"
                          className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold"
                        />
                        <textarea
                          value={card.back}
                          onChange={(e) => {
                            const updated = [...generatedCards];
                            updated[idx].back = e.target.value;
                            setGeneratedCards(updated);
                          }}
                          placeholder="Back Answer"
                          rows={2}
                          className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium resize-none"
                        />
                        <button
                          onClick={() => setEditingCardIdx(null)}
                          className="px-2.5 py-1 rounded bg-zinc-900 text-white text-[11px] font-bold"
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <span className="text-[10px] font-bold text-zinc-400">Card #{idx + 1}</span>
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingCardIdx(idx)}
                              className="p-1 hover:text-zinc-900 dark:hover:text-white text-zinc-400"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const updated = generatedCards.filter((_, i) => i !== idx);
                                setGeneratedCards(updated);
                              }}
                              className="p-1 hover:text-red-600 text-zinc-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white">Q: {card.front}</p>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300">A: {card.back}</p>
                          {card.explanation && (
                            <p className="text-[11px] text-zinc-400 italic">💡 {card.explanation}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <span className="text-xs text-zinc-400">
            {step === "configure" ? "Free-first Gemini 3.6 Flash" : `${generatedCards.length} cards ready`}
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>

            {step === "configure" ? (
              <button
                type="submit"
                form="gen-form"
                disabled={isGenerating || !topic.trim()}
                className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold flex items-center space-x-2 shadow-xs disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating Cards...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Flashcards</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleSaveDeck}
                disabled={generatedCards.length === 0}
                className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Save Deck to Library</span>
              </button>
            )}
          </div>
        </div>
    </Modal>
  );
};
