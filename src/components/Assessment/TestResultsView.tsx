import React, { useState } from "react";
import { motion } from "motion/react";
import { TestAttempt, FlashcardDeck } from "../../types";
import { generateRevisionPlan, generateFlashcards } from "../../lib/aiService";
import { saveRevisionResource, saveFlashcardDeck, saveFlashcard } from "../../lib/storage";
import { Award, CheckCircle2, XCircle, Sparkles, Layers, TrendingUp, RotateCcw, Loader2 } from "lucide-react";
import { fadeInUp, staggerContainer } from "../../lib/motion";

interface TestResultsViewProps {
  attempt: TestAttempt;
  onRetake: () => void;
  onClose: () => void;
  onOpenFlashcardDeck?: (deck: FlashcardDeck) => void;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
  attempt,
  onRetake,
  onClose,
  onOpenFlashcardDeck,
}) => {
  const [revisionPlan, setRevisionPlan] = useState<any>(attempt.revisionPlan || null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState<boolean>(false);
  const [questionFilter, setQuestionFilter] = useState<"all" | "correct" | "incorrect">("all");

  const handleGenerateRevision = async () => {
    if ((attempt.weakTopicTitles || []).length === 0) {
      alert("Great job! You scored well on all topics. No weak topics identified.");
      return;
    }

    setIsGeneratingPlan(true);
    try {
      const plan = await generateRevisionPlan(attempt.subject, attempt.weakTopicTitles);
      setRevisionPlan(plan);
      attempt.revisionPlan = plan;

      saveRevisionResource({
        topicTitle: attempt.weakTopicTitles.join(", "),
        subject: attempt.subject,
        ...plan,
      });
    } catch (err: any) {
      alert("Failed to generate revision plan: " + err.message);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateWeakCards = async () => {
    if ((attempt.weakTopicTitles || []).length === 0) {
      alert("No weak topics identified in this assessment.");
      return;
    }

    setIsGeneratingCards(true);
    try {
      const cards = await generateFlashcards({
        topic: `${attempt.subject}: ${attempt.weakTopicTitles.join(", ")}`,
        count: 10,
        difficulty: "Medium",
        focus: "Specific knowledge gaps and incorrect concepts from recent test",
      });

      const newDeck: FlashcardDeck = {
        id: `deck_weak_${Date.now()}`,
        ownerId: "user_local_1",
        title: `Weak Topic Flashcards: ${attempt.subject}`,
        description: `Generated from test failure analysis in ${attempt.weakTopicTitles.join(", ")}`,
        subject: attempt.subject,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cardCount: cards.length,
      };

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

      alert(`Created ${cards.length} targeted flashcards in deck "${newDeck.title}"!`);
      if (onOpenFlashcardDeck) {
        onOpenFlashcardDeck(newDeck);
      }
    } catch (err: any) {
      alert("Failed to generate flashcards: " + err.message);
    } finally {
      setIsGeneratingCards(false);
    }
  };

  // Compute question correctness
  const questionDetails = (attempt.questions || []).map((q) => {
    const userAns = (attempt.userAnswers[q.id] || "").trim().toLowerCase();
    const correctAns = (q.correctAnswer || "").trim().toLowerCase();
    const isCorrect =
      !!userAns && (userAns === correctAns || correctAns.startsWith(userAns) || userAns.startsWith(correctAns));
    return {
      question: q,
      userAnswer: attempt.userAnswers[q.id] || "No answer provided",
      isCorrect,
    };
  });

  const filteredQuestions = questionDetails.filter((item) => {
    if (questionFilter === "correct") return item.isCorrect;
    if (questionFilter === "incorrect") return !item.isCorrect;
    return true;
  });

  const correctCount = questionDetails.filter((item) => item.isCorrect).length;
  const incorrectCount = questionDetails.length - correctCount;

  const scoreTier =
    attempt.percentage >= 80 ? "great" : attempt.percentage >= 60 ? "okay" : "weak";
  const scoreRing =
    scoreTier === "great"
      ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-900"
      : scoreTier === "okay"
      ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-900"
      : "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-300 dark:border-red-900";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Retest Improvement Banner (if retest) */}
      {attempt.improvementPercentagePoints !== undefined && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="p-4 rounded-2xl bg-emerald-600 text-white flex items-center justify-between gap-3 shadow-md"
        >
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-6 h-6 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Retest Learning Loop Completed!</h4>
              <p className="text-xs opacity-90">
                Your performance improved by <strong>+{attempt.improvementPercentagePoints}% points</strong> compared to your initial test!
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Top Card: Score Summary */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm text-center space-y-4"
      >
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 ${scoreRing}`}>
          <Award className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Assessment Results • {attempt.subject}
          </span>
          <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
            Score: {attempt.score} / {attempt.total} ({attempt.percentage}%)
          </h1>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs">
          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <span className="text-zinc-500 block text-[10px] uppercase font-bold">Accuracy</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{attempt.percentage}%</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <span className="text-zinc-500 block text-[10px] uppercase font-bold">Time Spent</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{Math.round(attempt.timeSpentSeconds / 60)} mins</span>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <span className="text-zinc-500 block text-[10px] uppercase font-bold">Focus Violations</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{attempt.focusViolations}</span>
          </div>
        </div>
      </motion.div>

      {/* Topic Breakdown & Targeted Actions */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Topic Performance Breakdown
          </h3>
          {(attempt.weakTopicTitles || []).length > 0 && (
            <div className="flex items-center space-x-2 flex-wrap">
              <button
                type="button"
                onClick={handleGenerateRevision}
                disabled={isGeneratingPlan}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center space-x-1 disabled:opacity-50 transition-colors"
              >
                {isGeneratingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isGeneratingPlan ? "Generating..." : "AI Revision Plan"}</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateWeakCards}
                disabled={isGeneratingCards}
                className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold flex items-center space-x-1 disabled:opacity-50 transition-colors"
              >
                {isGeneratingCards ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                <span>{isGeneratingCards ? "Generating..." : "Weak Flashcards"}</span>
              </button>
            </div>
          )}
        </div>

        <motion.div variants={staggerContainer()} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(attempt.topicScores || {}).map(([tId, info]: [string, { correct: number; total: number; title: string }]) => {
            const acc = info.total > 0 ? Math.round((info.correct / info.total) * 100) : 0;
            const isWeak = acc < 60;

            return (
              <motion.div
                key={tId}
                variants={fadeInUp}
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  isWeak
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50"
                    : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50"
                }`}
              >
                <div>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100 block line-clamp-1">
                    {info.title}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {info.correct} of {info.total} correct ({acc}%)
                  </span>
                </div>

                <span
                  className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-bold uppercase ${
                    isWeak
                      ? "bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {isWeak ? "Needs Review" : "Mastered ✓"}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Targeted AI Revision Plan Display */}
      {revisionPlan && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-2xl p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center space-x-2 border-b border-zinc-700 dark:border-zinc-300 pb-3">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-base font-bold">
              Targeted AI 5-Minute Revision Plan
            </h3>
          </div>

          <p className="text-xs opacity-90 leading-relaxed">
            {revisionPlan.summary5Min}
          </p>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider opacity-80">Key Concepts to Revisit:</h4>
            <ul className="list-disc pl-5 text-xs opacity-90 space-y-1">
              {revisionPlan.keyConcepts?.map((kc: string, i: number) => (
                <li key={i}>{kc}</li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}

      {/* Detailed Question Review */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Detailed Question & Solution Review
            </h3>
            <p className="text-xs text-zinc-500">
              Inspect your answers and read the explanatory solutions for each question.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setQuestionFilter("all")}
              className={`px-3 py-1 rounded-lg transition-all ${
                questionFilter === "all"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "text-zinc-500"
              }`}
            >
              All ({questionDetails.length})
            </button>
            <button
              type="button"
              onClick={() => setQuestionFilter("correct")}
              className={`px-3 py-1 rounded-lg transition-all ${
                questionFilter === "correct"
                  ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-zinc-500"
              }`}
            >
              Correct ({correctCount})
            </button>
            <button
              type="button"
              onClick={() => setQuestionFilter("incorrect")}
              className={`px-3 py-1 rounded-lg transition-all ${
                questionFilter === "incorrect"
                  ? "bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 shadow-xs"
                  : "text-zinc-500"
              }`}
            >
              Incorrect ({incorrectCount})
            </button>
          </div>
        </div>

        {/* Question Cards List */}
        <motion.div variants={staggerContainer(0.04)} initial="hidden" animate="show" className="space-y-4">
          {filteredQuestions.map((item, idx) => (
            <motion.div
              key={item.question.id || idx}
              variants={fadeInUp}
              className={`p-5 rounded-xl border space-y-3 text-xs ${
                item.isCorrect
                  ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/10"
                  : "border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Question {idx + 1} • {item.question.topicTitle}
                  </span>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {item.question.question}
                  </h4>
                </div>

                <span
                  className={`shrink-0 px-2.5 py-1 rounded-full font-bold text-[10px] uppercase flex items-center space-x-1 text-white ${
                    item.isCorrect ? "bg-emerald-600" : "bg-red-600"
                  }`}
                >
                  {item.isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span>{item.isCorrect ? "Correct" : "Incorrect"}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">Your Answer:</span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {item.userAnswer}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">Correct Answer:</span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    {item.question.correctAnswer}
                  </p>
                </div>
              </div>

              {item.question.explanation && (
                <div className="p-3.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                    Explanation & Solution Logic:
                  </span>
                  <p className="leading-relaxed">{item.question.explanation}</p>
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Back to Assessment Center
        </button>

        <button
          type="button"
          onClick={onRetake}
          className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Retake Assessment</span>
        </button>
      </div>
    </div>
  );
};
