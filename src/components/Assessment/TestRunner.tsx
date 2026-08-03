import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Question, TestConfig, TestAttempt } from "../../types";
import { saveTestAttempt } from "../../lib/storage";
import { Clock, ShieldAlert, Bookmark, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";
import { fadeInUp, staggerContainer } from "../../lib/motion";
import { Modal } from "../Modal";

interface TestRunnerProps {
  config: TestConfig;
  questions: Question[];
  onCompleteTest: (attempt: TestAttempt) => void;
  onCancel: () => void;
}

export const TestRunner: React.FC<TestRunnerProps> = ({
  config,
  questions,
  onCompleteTest,
  onCancel,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    (config.timeLimitMinutes || 15) * 60
  );
  const [focusViolations, setFocusViolations] = useState<number>(0);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);

  const startTimeRef = useRef<number>(Date.now());

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitFinalTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Assessment Integrity monitoring (Tab Switch / Blur)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setFocusViolations((prev) => prev + 1);
      }
    };

    const handleBlur = () => {
      setFocusViolations((prev) => prev + 1);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const currentQuestion = questions[currentIndex];

  const handleSelectAnswer = (answer: string) => {
    if (!currentQuestion) return;
    setUserAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
  };

  const handleToggleMarkReview = () => {
    if (!currentQuestion) return;
    if (markedForReview.includes(currentQuestion.id)) {
      setMarkedForReview(markedForReview.filter((id) => id !== currentQuestion.id));
    } else {
      setMarkedForReview([...markedForReview, currentQuestion.id]);
    }
  };

  const handleSubmitFinalTest = () => {
    const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    let score = 0;
    const topicScores: Record<string, { correct: number; total: number; title: string }> = {};

    questions.forEach((q) => {
      const topId = q.topicId || "top_general";
      if (!topicScores[topId]) {
        topicScores[topId] = { correct: 0, total: 0, title: q.topicTitle || "General" };
      }
      topicScores[topId].total += 1;

      const userAns = (userAnswers[q.id] || "").trim().toLowerCase();
      const correctAns = (q.correctAnswer || "").trim().toLowerCase();

      // Flexible check for MCQ option prefix or string equality
      if (userAns && (userAns === correctAns || correctAns.startsWith(userAns) || userAns.startsWith(correctAns))) {
        score += 1;
        topicScores[topId].correct += 1;
      }
    });

    const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

    const weakTopicIds: string[] = [];
    const weakTopicTitles: string[] = [];

    Object.entries(topicScores).forEach(([tId, info]) => {
      const acc = info.total > 0 ? info.correct / info.total : 0;
      if (acc < 0.6) {
        weakTopicIds.push(tId);
        weakTopicTitles.push(info.title);
      }
    });

    const attempt: TestAttempt = {
      id: `attempt_${Date.now()}`,
      testConfigId: config.id,
      subject: config.subject,
      questions,
      userAnswers,
      markedForReview,
      timeSpentSeconds,
      focusViolations,
      score,
      total: questions.length,
      percentage,
      topicScores,
      weakTopicIds,
      weakTopicTitles,
      completedAt: new Date().toISOString(),
    };

    saveTestAttempt(attempt);
    onCompleteTest(attempt);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(userAnswers).length;
  const unansweredCount = questions.length - answeredCount;
  const markedCount = markedForReview.length;

  // Timer Warning Levels
  const isCritical = secondsRemaining <= 30;
  const isStrongWarning = secondsRemaining <= 120 && secondsRemaining > 30;
  const isWarning = secondsRemaining <= 600 && secondsRemaining > 120;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Integrity Notice Banner */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-3"
      >
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-zinc-800 dark:text-zinc-200 shrink-0" />
          <span>
            <strong>Assessment Integrity Mode:</strong> This test records tab switches or window blurs to measure focus.
          </span>
        </div>
        {focusViolations > 0 && (
          <span className="px-2.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
            Violations: {focusViolations}
          </span>
        )}
      </motion.div>

      {/* Timer Warning Banner if <= 10 mins */}
      <AnimatePresence>
        {(isWarning || isStrongWarning || isCritical) && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            exit="exit"
            className={`p-3 rounded-xl text-xs font-bold flex items-center space-x-2 ${
              isCritical
                ? "bg-red-600 text-white animate-pulse"
                : isStrongWarning
                ? "bg-amber-600 text-white"
                : "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {isCritical
                ? "CRITICAL TIME WARNING! Less than 30 seconds remaining!"
                : isStrongWarning
                ? "TIME WARNING! Less than 2 minutes remaining!"
                : "Notice: Less than 10 minutes remaining."}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Controls */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            {config.subject} • Assessment Mode
          </span>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
            Question {currentIndex + 1} of {questions.length}
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          {/* Countdown Timer */}
          <div
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 shadow-xs ${
              isCritical || isStrongWarning ? "bg-red-600 text-white" : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTime(secondsRemaining)}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs shadow-sm transition-colors"
          >
            Submit Test
          </button>
        </div>
      </motion.div>

      {/* QUESTION NAVIGATOR GRID */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-2"
      >
        <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
          <span>Question Navigator</span>
          <div className="flex items-center space-x-3 text-[10px]">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-zinc-900 dark:bg-zinc-100 inline-block"></span>
              <span>Answered (✓)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-zinc-200 dark:bg-zinc-700 inline-block"></span>
              <span>Unanswered (—)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block"></span>
              <span>Marked (⚑)</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
          {questions.map((q, idx) => {
            const isAnswered = !!userAnswers[q.id];
            const isMarked = markedForReview.includes(q.id);
            const isCurrent = idx === currentIndex;

            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
                  isCurrent
                    ? "ring-2 ring-zinc-900 dark:ring-zinc-100 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : isAnswered
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 opacity-90"
                    : isMarked
                    ? "bg-amber-500 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200"
                }`}
              >
                <span>{idx + 1}</span>
                <span>
                  {isMarked ? "⚑" : isAnswered ? "✓" : "—"}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Main Question Card */}
      {currentQuestion && (
        <motion.div
          key={currentQuestion.id || currentIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <span className="text-xs font-semibold text-zinc-500">
              Topic: {currentQuestion.topicTitle}
            </span>
            <button
              type="button"
              onClick={handleToggleMarkReview}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors ${
                markedForReview.includes(currentQuestion.id)
                  ? "bg-amber-500 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{markedForReview.includes(currentQuestion.id) ? "Marked for Review ⚑" : "Mark for Review"}</span>
            </button>
          </div>

          {/* Question Text */}
          <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-relaxed">
            {currentQuestion.question}
          </h3>

          {/* Answer Options */}
          {currentQuestion.type === "mcq" && currentQuestion.options ? (
            <motion.div variants={staggerContainer(0.04)} initial="hidden" animate="show" className="space-y-2.5">
              {currentQuestion.options.map((opt, idx) => (
                <motion.button
                  key={`opt_${currentQuestion.id}_${idx}`}
                  variants={fadeInUp}
                  type="button"
                  onClick={() => handleSelectAnswer(opt)}
                  className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                    userAnswers[currentQuestion.id] === opt
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span>{opt}</span>
                  {userAnswers[currentQuestion.id] === opt && <CheckCircle2 className="w-4 h-4" />}
                </motion.button>
              ))}
            </motion.div>
          ) : currentQuestion.type === "true_false" ? (
            <div className="grid grid-cols-2 gap-3">
              {["True", "False"].map((opt) => (
                <button
                  key={`tf_${currentQuestion.id}_${opt}`}
                  type="button"
                  onClick={() => handleSelectAnswer(opt)}
                  className={`p-4 rounded-xl border text-sm font-bold transition-all ${
                    userAnswers[currentQuestion.id] === opt
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Type Your Answer
              </label>
              <input
                type="text"
                value={userAnswers[currentQuestion.id] || ""}
                onChange={(e) => handleSelectAnswer(e.target.value)}
                placeholder="Enter answer..."
                className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
              />
            </div>
          )}

          {/* Bottom Nav Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 flex items-center space-x-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-30 flex items-center space-x-1.5 transition-colors"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Submission Confirmation Modal */}
      <Modal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} panelClassName="max-w-md">
        <div className="p-6 sm:p-8 space-y-5">
          <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            Confirm Test Submission
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
              <span className="text-zinc-500 block uppercase text-[10px] font-bold">Total Questions</span>
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{questions.length}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
              <span className="text-emerald-700 dark:text-emerald-400 block uppercase text-[10px] font-bold">Answered</span>
              <span className="font-bold text-sm text-emerald-900 dark:text-emerald-300">{answeredCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
              <span className="text-red-700 dark:text-red-400 block uppercase text-[10px] font-bold">Unanswered</span>
              <span className="font-bold text-sm text-red-900 dark:text-red-300">{unansweredCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <span className="text-amber-700 dark:text-amber-400 block uppercase text-[10px] font-bold">Marked for Review</span>
              <span className="font-bold text-sm text-amber-900 dark:text-amber-300">{markedCount}</span>
            </div>
          </div>

          {unansweredCount > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
              Notice: You still have {unansweredCount} unanswered questions remaining.
            </p>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Continue Test
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSubmitModalOpen(false);
                handleSubmitFinalTest();
              }}
              className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
            >
              Confirm & Submit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
