import React, { useState } from "react";
import { WeakTopicStat, NoteDocument, FlashcardDeck } from "../../types";
import { getWeakTopicStats, saveRevisionResource, getCollections } from "../../lib/storage";
import { generateRevisionPlan, generateFlashcards } from "../../lib/aiService";
import { AlertTriangle, Sparkles, Layers, Play, TrendingUp, BookOpen, CheckCircle2, RotateCcw, FileText } from "lucide-react";

interface WeakTopicsDashboardProps {
  onStartRetest: (subject: string, topicTitles: string[]) => void;
  onOpenFlashcardDeck?: (deck: FlashcardDeck) => void;
  onOpenNoteStudio?: (note: NoteDocument) => void;
}

export const WeakTopicsDashboard: React.FC<WeakTopicsDashboardProps> = ({
  onStartRetest,
  onOpenFlashcardDeck,
  onOpenNoteStudio,
}) => {
  const weakStats = getWeakTopicStats();
  const [selectedTopic, setSelectedTopic] = useState<WeakTopicStat | null>(null);
  const [generatingRevisionFor, setGeneratingRevisionFor] = useState<string | null>(null);
  const [generatingCardsFor, setGeneratingCardsFor] = useState<string | null>(null);
  const [revisionModalData, setRevisionModalData] = useState<any | null>(null);

  const weakTopicsOnly = weakStats.filter((s) => s.currentAccuracy < 60);
  const reviewTopics = weakStats.filter((s) => s.currentAccuracy >= 60 && s.currentAccuracy < 80);
  const masteredTopics = weakStats.filter((s) => s.currentAccuracy >= 80);

  const handleGenerateRevision = async (stat: WeakTopicStat) => {
    setGeneratingRevisionFor(stat.topicId);
    try {
      const plan = await generateRevisionPlan(stat.subject, [stat.topicTitle]);
      const resource = {
        topicTitle: stat.topicTitle,
        subject: stat.subject,
        ...plan,
      };
      saveRevisionResource(resource);
      setRevisionModalData(resource);
    } catch (err: any) {
      alert("Failed to generate revision guide: " + err.message);
    } finally {
      setGeneratingRevisionFor(null);
    }
  };

  const handleGenerateCards = async (stat: WeakTopicStat) => {
    setGeneratingCardsFor(stat.topicId);
    try {
      const cards = await generateFlashcards({
        topic: `${stat.subject}: ${stat.topicTitle}`,
        count: 10,
        difficulty: "Medium",
        focus: "Addressing weak concepts and knowledge gaps from recent test failures",
      });

      // Save as new flashcard deck in storage
      const deckId = `deck_weak_${Date.now()}`;
      const newDeck: FlashcardDeck = {
        id: deckId,
        ownerId: "user_local_1",
        title: `Targeted Review: ${stat.topicTitle}`,
        description: `AI Flashcards addressing weak areas in ${stat.subject}`,
        subject: stat.subject,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cardCount: cards.length,
      };

      const { saveFlashcardDeck, saveFlashcard } = await import("../../lib/storage");
      saveFlashcardDeck(newDeck);

      cards.forEach((c, index) => {
        saveFlashcard({
          id: `fc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          deckId: newDeck.id,
          front: c.front,
          back: c.back,
          explanation: c.explanation,
          example: c.example,
          hint: c.hint,
          orderIndex: index,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      alert(`Created targeted flashcard deck "${newDeck.title}" with ${cards.length} cards!`);
      if (onOpenFlashcardDeck) {
        onOpenFlashcardDeck(newDeck);
      }
    } catch (err: any) {
      alert("Failed to generate weak topic flashcards: " + err.message);
    } finally {
      setGeneratingCardsFor(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-zinc-500 block">Weak Topics (&lt;60%)</span>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{weakTopicsOnly.length}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-zinc-500 block">Needs Review (60-79%)</span>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{reviewTopics.length}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-zinc-500 block">Mastered (80%+)</span>
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{masteredTopics.length}</span>
          </div>
        </div>
      </div>

      {/* Main Weak Topics List */}
      {weakStats.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-xs space-y-2 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl p-8">
          <CheckCircle2 className="w-10 h-10 mx-auto text-zinc-400" />
          <p className="font-medium text-zinc-700 dark:text-zinc-300">No weak topics recorded yet!</p>
          <p className="font-light text-zinc-500">Take practice assessments to automatically track topic strengths and weaknesses over time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <span>Learning Intelligence & Weakness Matrix</span>
          </h3>

          <div className="space-y-3">
            {weakStats.map((stat) => {
              const isWeak = stat.currentAccuracy < 60;
              const isReview = stat.currentAccuracy >= 60 && stat.currentAccuracy < 80;

              return (
                <div
                  key={stat.topicId}
                  className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                        {stat.subject}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isWeak
                            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                            : isReview
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                            : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        }`}
                      >
                        {stat.currentAccuracy}% Accuracy • {stat.status}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {stat.topicTitle}
                    </h4>

                    {/* Historical Attempt Trend */}
                    {stat.history.length > 0 && (
                      <div className="flex items-center space-x-2 text-[11px] text-zinc-500 pt-0.5">
                        <span className="font-medium">Attempt Trend:</span>
                        <div className="flex items-center space-x-1">
                          {stat.history.map((h, idx) => (
                            <React.Fragment key={idx}>
                              <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{h.accuracy}%</span>
                              {idx < stat.history.length - 1 && <span>→</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions for this weak topic */}
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerateRevision(stat)}
                      disabled={generatingRevisionFor === stat.topicId}
                      className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center space-x-1 disabled:opacity-50"
                      title="Generate 5-minute targeted revision resource"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                      <span>{generatingRevisionFor === stat.topicId ? "Generating..." : "Revision Guide"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleGenerateCards(stat)}
                      disabled={generatingCardsFor === stat.topicId}
                      className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-semibold flex items-center space-x-1 disabled:opacity-50"
                      title="Generate flashcard deck targeting this topic"
                    >
                      <Layers className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                      <span>{generatingCardsFor === stat.topicId ? "Generating..." : "Generate Cards"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onStartRetest(stat.subject, [stat.topicTitle])}
                      className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold flex items-center space-x-1 shadow-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retest Topic</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revision Modal Guide */}
      {revisionModalData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-zinc-800 dark:text-zinc-200" />
                <h3 className="font-bold text-lg">5-Minute Targeted Revision: {revisionModalData.topicTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setRevisionModalData(null)}
                className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Close ✕
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 space-y-1">
                <span className="font-bold text-zinc-900 dark:text-zinc-100 block uppercase text-[10px]">Core Concept Summary:</span>
                <p>{revisionModalData.summary5Min}</p>
              </div>

              {revisionModalData.keyConcepts && revisionModalData.keyConcepts.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase text-[10px] block">Crucial Points:</span>
                  <ul className="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
                    {revisionModalData.keyConcepts.map((kc: string, i: number) => (
                      <li key={i}>{kc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {revisionModalData.examples && revisionModalData.examples.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase text-[10px] block">Concrete Examples:</span>
                  <ul className="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
                    {revisionModalData.examples.map((ex: string, i: number) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}

              {revisionModalData.practiceQuestions && revisionModalData.practiceQuestions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 uppercase text-[10px] block">Quick Self-Check Q&A:</span>
                  <div className="space-y-2">
                    {revisionModalData.practiceQuestions.map((pq: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-1">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">Q: {pq.question}</p>
                        <p className="text-zinc-600 dark:text-zinc-400">A: {pq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setRevisionModalData(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs"
              >
                Done Reviewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
