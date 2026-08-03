import React, { useState } from "react";
import { motion } from "motion/react";
import {
  NoteDocument,
  Complexity,
  QuestionType,
  TestConfig,
  SavedTest,
  TestAttempt,
  FlashcardDeck,
} from "../../types";
import { generateBatchedTestQuestions } from "../../lib/aiService";
import {
  getSavedTestsList,
  getTestAttempts,
  deleteSavedTest,
  deleteTestAttempt,
  getCollections,
  getFlashcardDecks,
  getWeakTopicStats,
  saveSavedTest,
  getDescendantCollectionIds,
} from "../../lib/storage";
import { QuestionPreviewEditor } from "./QuestionPreviewEditor";
import { WeakTopicsDashboard } from "./WeakTopicsDashboard";
import { ConfirmModal } from "../ConfirmModal";
import { EmptyState } from "../EmptyState";
import { fadeInUp, staggerContainer } from "../../lib/motion";
import {
  Play,
  Clock,
  Layers,
  Trash2,
  History,
  Sparkles,
  FileCheck,
  ArrowRight,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface TestGeneratorProps {
  notes: NoteDocument[];
  preselectedNote?: NoteDocument;
  preselectedCollectionId?: string;
  preselectedDeckId?: string;
  onStartTest: (config: TestConfig, questions: any[]) => void;
  onViewAttemptResults?: (attempt: TestAttempt) => void;
  onOpenFlashcardDeck?: (deck: FlashcardDeck) => void;
  onOpenNoteStudio?: (note: NoteDocument) => void;
}

const SOURCE_TYPE_OPTIONS: { value: "note" | "notes" | "collection" | "flashcard_deck" | "weakness" | "custom"; label: string }[] = [
  { value: "note", label: "Single Note" },
  { value: "notes", label: "Multi-Notes" },
  { value: "collection", label: "Collection" },
  { value: "flashcard_deck", label: "Flashcards" },
  { value: "weakness", label: "Weak Topics" },
  { value: "custom", label: "Manual" },
];

export const TestGenerator: React.FC<TestGeneratorProps> = ({
  notes,
  preselectedNote,
  preselectedCollectionId,
  preselectedDeckId,
  onStartTest,
  onViewAttemptResults,
  onOpenFlashcardDeck,
  onOpenNoteStudio,
}) => {
  const [activeTab, setActiveTab] = useState<"create" | "saved" | "weakness" | "history">("create");

  // Source configuration
  const [sourceType, setSourceType] = useState<
    "note" | "notes" | "collection" | "flashcard_deck" | "weakness" | "custom"
  >(
    preselectedDeckId
      ? "flashcard_deck"
      : preselectedCollectionId
      ? "collection"
      : "note"
  );

  const collections = getCollections();
  const flashcardDecks = getFlashcardDecks();
  const weakStats = getWeakTopicStats();

  // Selection states
  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    preselectedNote?.id || notes[0]?.id || ""
  );
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>(
    notes.map((n) => n.id)
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    preselectedCollectionId || collections[0]?.id || ""
  );
  const [includeSubcollections, setIncludeSubcollections] = useState<boolean>(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    preselectedDeckId || flashcardDecks[0]?.id || ""
  );

  const activeNote = notes.find((n) => n.id === selectedNoteId) || preselectedNote || notes[0];
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(
    activeNote ? (activeNote.roadmap || []).map((t) => t.id) : []
  );

  // Question Config
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<Complexity>("Medium");
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([
    "mcq",
    "true_false",
    "fill_blank",
  ]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(15);

  // Batch progress state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  // Preview Mode state
  const [previewQuestions, setPreviewQuestions] = useState<any[] | null>(null);
  const [previewConfig, setPreviewConfig] = useState<TestConfig | null>(null);

  // List refresh trigger
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [testToDelete, setTestToDelete] = useState<SavedTest | null>(null);
  const [attemptToDeleteId, setAttemptToDeleteId] = useState<string | null>(null);

  const confirmDeleteSavedTest = () => {
    if (!testToDelete) return;
    deleteSavedTest(testToDelete.id);
    setRefreshKey((prev) => prev + 1);
    setTestToDelete(null);
  };

  const confirmDeleteTestAttempt = () => {
    if (!attemptToDeleteId) return;
    deleteTestAttempt(attemptToDeleteId);
    setRefreshKey((prev) => prev + 1);
    setAttemptToDeleteId(null);
  };
  const savedTests = getSavedTestsList();
  const attemptHistory = getTestAttempts();

  const handleToggleTopic = (id: string) => {
    if (selectedTopicIds.includes(id)) {
      setSelectedTopicIds(selectedTopicIds.filter((t) => t !== id));
    } else {
      setSelectedTopicIds([...selectedTopicIds, id]);
    }
  };

  const handleToggleNoteMulti = (id: string) => {
    if (selectedNoteIds.includes(id)) {
      setSelectedNoteIds(selectedNoteIds.filter((nId) => nId !== id));
    } else {
      setSelectedNoteIds([...selectedNoteIds, id]);
    }
  };

  const handleGenerateQuestions = async () => {
    let subject = "General Assessment";
    let topicsObj: { id: string; title: string }[] = [];
    let contentContext = "";

    if (sourceType === "note") {
      if (!activeNote) {
        alert("Please select a study note first.");
        return;
      }
      subject = activeNote.subject;
      topicsObj = (activeNote.roadmap || [])
        .filter((t) => selectedTopicIds.includes(t.id))
        .map((t) => ({ id: t.id, title: t.title }));
      contentContext = (activeNote.sections || []).map((s) => `${s.title}: ${s.content}`).join("\n");
    } else if (sourceType === "notes") {
      const selectedNotes = notes.filter((n) => selectedNoteIds.includes(n.id));
      if (selectedNotes.length === 0) {
        alert("Please select at least one study note.");
        return;
      }
      subject = selectedNotes[0].subject || "Multi-Note Assessment";
      selectedNotes.forEach((n) => {
        (n.roadmap || []).forEach((t) => {
          topicsObj.push({ id: t.id, title: `${n.title} - ${t.title}` });
        });
        contentContext += `\n--- Note: ${n.title} ---\n` + (n.sections || []).map((s) => s.content).join("\n");
      });
    } else if (sourceType === "collection") {
      const targetCol = collections.find((c) => c.id === selectedCollectionId);
      if (!targetCol) {
        alert("Please select a collection.");
        return;
      }
      subject = targetCol.name;

      const targetColIds = includeSubcollections
        ? getDescendantCollectionIds(targetCol.id, collections)
        : [targetCol.id];

      const colNotes = notes.filter((n) => n.collectionId && targetColIds.includes(n.collectionId));
      colNotes.forEach((n) => {
        (n.roadmap || []).forEach((t) => {
          topicsObj.push({ id: t.id, title: `${n.title}: ${t.title}` });
        });
      });

      if (topicsObj.length === 0) {
        topicsObj = [{ id: "col_top_1", title: targetCol.name }];
      }
    } else if (sourceType === "flashcard_deck") {
      const targetDeck = flashcardDecks.find((d) => d.id === selectedDeckId);
      if (!targetDeck) {
        alert("Please select a flashcard deck.");
        return;
      }
      subject = targetDeck.subject || targetDeck.title;
      topicsObj = [{ id: targetDeck.id, title: targetDeck.title }];
    } else if (sourceType === "weakness") {
      const weakTopicsOnly = weakStats.filter((s) => s.currentAccuracy < 60);
      if (weakTopicsOnly.length === 0) {
        alert("No weak topics found below 60% accuracy!");
        return;
      }
      subject = weakTopicsOnly[0].subject || "Weak Topics Targeted Retest";
      topicsObj = weakTopicsOnly.map((w) => ({ id: w.topicId, title: w.topicTitle }));
    } else if (sourceType === "custom") {
      // Manual question builder starts empty in preview mode
      const emptyConfig: TestConfig = {
        id: `test_cfg_${Date.now()}`,
        subject: "Custom Assessment",
        selectedTopicIds: [],
        questionCount: 0,
        difficulty,
        questionTypes,
        timeLimitMinutes,
      };
      setPreviewConfig(emptyConfig);
      setPreviewQuestions([]);
      return;
    }

    if (topicsObj.length === 0) {
      topicsObj = [{ id: "gen_1", title: subject }];
    }

    setIsGenerating(true);
    setBatchProgress({ current: 1, total: Math.ceil(questionCount / 10) });

    try {
      const questions = await generateBatchedTestQuestions(
        {
          subject,
          topics: topicsObj,
          questionCount,
          difficulty,
          questionTypes,
          contentContext,
        },
        (batchIdx, totalBatches) => {
          setBatchProgress({ current: batchIdx, total: totalBatches });
        }
      );

      const config: TestConfig = {
        id: `test_cfg_${Date.now()}`,
        subject,
        sourceType,
        noteId: sourceType === "note" ? activeNote?.id : undefined,
        noteIds: sourceType === "notes" ? selectedNoteIds : undefined,
        collectionId: sourceType === "collection" ? selectedCollectionId : undefined,
        includeSubcollections,
        deckId: sourceType === "flashcard_deck" ? selectedDeckId : undefined,
        selectedTopicIds,
        questionCount: questions.length,
        difficulty,
        questionTypes,
        timeLimitMinutes,
      };

      setPreviewConfig(config);
      setPreviewQuestions(questions);
    } catch (err: any) {
      alert("Failed to generate test questions: " + err.message);
    } finally {
      setIsGenerating(false);
      setBatchProgress(null);
    }
  };

  const handleSavePreviewTest = (finalQuestions: any[]) => {
    if (!previewConfig) return;
    const testToSave: SavedTest = {
      id: previewConfig.id,
      noteTitle: previewConfig.subject,
      subject: previewConfig.subject,
      createdAt: new Date().toISOString(),
      config: { ...previewConfig, questionCount: finalQuestions.length },
      questions: finalQuestions,
      status: "ready",
    };

    saveSavedTest(testToSave);
    alert("Test saved successfully to your Saved Tests Library!");
    setPreviewQuestions(null);
    setPreviewConfig(null);
    setActiveTab("saved");
  };

  const handleStartPreviewTest = (finalQuestions: any[]) => {
    if (!previewConfig) return;
    onStartTest({ ...previewConfig, questionCount: finalQuestions.length }, finalQuestions);
    setPreviewQuestions(null);
    setPreviewConfig(null);
  };

  const handleDeleteSavedTest = (test: SavedTest) => {
    setTestToDelete(test);
  };

  const handleDeleteTestAttempt = (id: string) => {
    setAttemptToDeleteId(id);
  };

  const handleStartRetestWeak = (subject: string, topicTitles: string[]) => {
    setSourceType("weakness");
    setActiveTab("create");
  };

  // If in Preview Mode, render QuestionPreviewEditor!
  if (previewQuestions && previewConfig) {
    return (
      <QuestionPreviewEditor
        initialQuestions={previewQuestions}
        config={previewConfig}
        onSaveTest={handleSavePreviewTest}
        onStartTest={handleStartPreviewTest}
        onBack={() => {
          setPreviewQuestions(null);
          setPreviewConfig(null);
        }}
      />
    );
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 max-w-4xl mx-auto space-y-6 shadow-sm"
    >
      {/* Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Assessment & Learning Intelligence
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-0.5">
            Test Center
          </h2>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center flex-wrap bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "create"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Create Test
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "saved"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Saved ({savedTests.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("weakness")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "weakness"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>My Weak Topics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "history"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History ({attemptHistory.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CREATE TEST */}
      {activeTab === "create" && (
        <div className="space-y-6">
          {/* Source Type Selector Buttons */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Select Assessment Source
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-semibold">
              {SOURCE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSourceType(opt.value)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    sourceType === opt.value
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Source Form Options */}
          {sourceType === "note" && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Select Single Study Note
              </label>
              <select
                value={selectedNoteId}
                onChange={(e) => {
                  setSelectedNoteId(e.target.value);
                  const found = notes.find((n) => n.id === e.target.value);
                  if (found) setSelectedTopicIds((found.roadmap || []).map((t) => t.id));
                }}
                className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
              >
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title} ({n.subject})
                  </option>
                ))}
              </select>

              {activeNote && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Topics to Include ({selectedTopicIds.length} / {(activeNote.roadmap || []).length})
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedTopicIds((activeNote.roadmap || []).map((t) => t.id))}
                      className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 underline"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                    {(activeNote.roadmap || []).map((t) => (
                      <label
                        key={t.id}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center space-x-2 cursor-pointer transition-colors ${
                          selectedTopicIds.includes(t.id)
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                            : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTopicIds.includes(t.id)}
                          onChange={() => handleToggleTopic(t.id)}
                          className="rounded text-zinc-900"
                        />
                        <span className="line-clamp-1">{t.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {sourceType === "notes" && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Select Notes ({selectedNoteIds.length} selected)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {notes.map((n) => (
                  <label
                    key={n.id}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center space-x-2 cursor-pointer transition-colors ${
                      selectedNoteIds.includes(n.id)
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                        : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedNoteIds.includes(n.id)}
                      onChange={() => handleToggleNoteMulti(n.id)}
                      className="rounded text-zinc-900"
                    />
                    <span className="line-clamp-1">{n.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {sourceType === "collection" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Select Collection
                </label>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      📁 {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center space-x-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSubcollections}
                  onChange={(e) => setIncludeSubcollections(e.target.checked)}
                  className="rounded text-zinc-900"
                />
                <span>Include notes from nested subcollections</span>
              </label>
            </div>
          )}

          {sourceType === "flashcard_deck" && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Select Flashcard Deck Source
              </label>
              <select
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
              >
                {flashcardDecks.map((d) => (
                  <option key={d.id} value={d.id}>
                    🎴 {d.title} ({d.cardCount} cards)
                  </option>
                ))}
              </select>
            </div>
          )}

          {sourceType === "weakness" && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs space-y-2 border border-amber-200 dark:border-amber-900/50">
              <div className="flex items-center space-x-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Targeted Weak Topics Retest</span>
              </div>
              <p>
                Questions will be automatically generated exclusively from topics where your recent accuracy was under 60%.
              </p>
            </div>
          )}

          {/* Test Parameters Grid */}
          {sourceType !== "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Questions Count
                </label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                >
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions (Standard Batch)</option>
                  <option value={20}>20 Questions (2 Batches)</option>
                  <option value={30}>30 Questions (3 Batches)</option>
                  <option value={50}>50 Questions (5 Batches)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Complexity)}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Advanced">Advanced</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Time Limit (Minutes)
                </label>
                <select
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                >
                  <option value={5}>5 Minutes</option>
                  <option value={10}>10 Minutes</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>
            </div>
          )}

          {/* Batched Generation Status indicator */}
          {isGenerating && batchProgress && (
            <div className="p-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-semibold flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating questions batch {batchProgress.current} of {batchProgress.total}...</span>
              </div>
              <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
            </div>
          )}

          {/* Generate & Preview Action Button */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
            <button
              type="button"
              onClick={handleGenerateQuestions}
              disabled={isGenerating}
              className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs shadow-md flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 fill-current" />}
              <span>
                {sourceType === "custom"
                  ? "Open Manual Question Builder"
                  : isGenerating
                  ? "Generating Questions..."
                  : "Generate & Preview Assessment"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: SAVED TESTS */}
      {activeTab === "saved" && (
        <div className="space-y-4">
          {savedTests.length === 0 ? (
            <EmptyState icon={FileCheck} message="No saved tests yet. Generate a test to save it!" />
          ) : (
            <motion.div variants={staggerContainer()} initial="hidden" animate="show" className="grid grid-cols-1 gap-3">
              {savedTests.map((test) => (
                <motion.div
                  key={test.id}
                  variants={fadeInUp}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
                        {test.config.difficulty}
                      </span>
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {test.noteTitle}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {test.questions.length} Questions • {test.config.timeLimitMinutes} mins limit • Created {new Date(test.createdAt).toLocaleDateString()}
                    </p>
                    {test.lastPercentage !== undefined && (
                      <p
                        className={`text-[11px] font-semibold ${
                          test.lastPercentage >= 70
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        Last Score: {test.lastScore} / {test.questions.length} ({test.lastPercentage}%) • {test.attemptsCount || 1} attempts
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => onStartTest(test.config, test.questions)}
                      className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{test.lastPercentage !== undefined ? "Retake Test" : "Start Test"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedTest(test)}
                      className="p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
                      title="Delete Test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* TAB 3: WEAK TOPICS INTELLIGENCE DASHBOARD */}
      {activeTab === "weakness" && (
        <WeakTopicsDashboard
          onStartRetest={handleStartRetestWeak}
          onOpenFlashcardDeck={onOpenFlashcardDeck}
          onOpenNoteStudio={onOpenNoteStudio}
        />
      )}

      {/* TAB 4: ATTEMPT HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {attemptHistory.length === 0 ? (
            <EmptyState icon={History} message="No test attempts completed yet. Take an assessment to view score trends!" />
          ) : (
            <motion.div variants={staggerContainer()} initial="hidden" animate="show" className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {attemptHistory.map((att) => (
                <motion.div
                  key={att.id}
                  variants={fadeInUp}
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {att.subject}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        • {new Date(att.completedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Score: <strong className="text-zinc-900 dark:text-zinc-100">{att.score} / {att.total}</strong> ({att.percentage}%)</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.round(att.timeSpentSeconds / 60)} mins</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        att.percentage >= 70
                          ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                          : "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {att.percentage}% Accuracy
                    </span>
                    {onViewAttemptResults && (
                      <button
                        type="button"
                        onClick={() => onViewAttemptResults(att)}
                        className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1 transition-colors"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteTestAttempt(att.id)}
                      className="p-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
                      title="Delete Attempt Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Delete Saved Test Modal */}
      <ConfirmModal
        isOpen={Boolean(testToDelete)}
        title="Delete Practice Test?"
        message={`Are you sure you want to delete "${testToDelete?.noteTitle}"? This test and all associated question data and attempt records inside it will be permanently deleted.`}
        confirmText="Delete Test"
        onConfirm={confirmDeleteSavedTest}
        onClose={() => setTestToDelete(null)}
      />

      {/* Delete Test Attempt Record Modal */}
      <ConfirmModal
        isOpen={Boolean(attemptToDeleteId)}
        title="Delete Test Attempt?"
        message="Are you sure you want to delete this test attempt record?"
        confirmText="Delete Record"
        onConfirm={confirmDeleteTestAttempt}
        onClose={() => setAttemptToDeleteId(null)}
      />
    </motion.div>
  );
};
