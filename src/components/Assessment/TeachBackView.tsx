import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { NoteDocument, TeachBackEvaluation } from "../../types";
import { evaluateTeachBack } from "../../lib/aiService";
import { saveTeachBackEvaluation } from "../../lib/storage";
import { Brain, Sparkles, CheckCircle2, AlertTriangle, XCircle, Send, Loader2 } from "lucide-react";
import { fadeInUp, staggerContainer, scaleIn } from "../../lib/motion";
import { EmptyState } from "../EmptyState";

interface TeachBackViewProps {
  notes: NoteDocument[];
}

export const TeachBackView: React.FC<TeachBackViewProps> = ({ notes }) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || "");
  const activeNote = notes.find((n) => n.id === selectedNoteId) || notes[0];

  const [selectedTopicTitle, setSelectedTopicTitle] = useState<string>(
    activeNote?.roadmap?.[0]?.title || "Core Concepts"
  );

  const [userExplanation, setUserExplanation] = useState<string>("");
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [currentEval, setCurrentEval] = useState<TeachBackEvaluation | null>(null);

  const handleEvaluate = async () => {
    if (!userExplanation.trim()) {
      alert("Please write your explanation first.");
      return;
    }

    setIsEvaluating(true);
    try {
      const result = await evaluateTeachBack(selectedTopicTitle, userExplanation);
      const evalObj: TeachBackEvaluation = {
        id: `tb_${Date.now()}`,
        topicTitle: selectedTopicTitle,
        userExplanation,
        understandingPercent: result.understandingPercent || 80,
        understoodPoints: result.understoodPoints || [],
        missingPoints: result.missingPoints || [],
        incorrectPoints: result.incorrectPoints || [],
        studyRecommendation: result.studyRecommendation || "Keep reviewing core definitions.",
        createdAt: new Date().toISOString(),
      };

      saveTeachBackEvaluation(evalObj);
      setCurrentEval(evalObj);
    } catch (err: any) {
      alert("Evaluation failed: " + err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  const scoreColor =
    currentEval && currentEval.understandingPercent >= 80
      ? "bg-emerald-600"
      : currentEval && currentEval.understandingPercent >= 60
      ? "bg-amber-600"
      : "bg-red-600";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Hero */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-3">
          <Brain className="w-3.5 h-3.5" />
          <span>Active Recall &amp; Self-Teaching</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          Teach-Back Learning Mode
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl leading-relaxed">
          Explain a topic in your own words — the AI grades your understanding and pinpoints exactly what you missed or got wrong.
        </p>
      </motion.div>

      {notes.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No study notes yet"
          message="Generate a study note first, then come back here to test your understanding of it."
        />
      ) : (
        <>
          {/* Select Note & Topic */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs"
          >
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Select Study Subject
              </label>
              <select
                value={selectedNoteId}
                onChange={(e) => {
                  setSelectedNoteId(e.target.value);
                  const found = notes.find((n) => n.id === e.target.value);
                  if (found && found.roadmap?.[0]) {
                    setSelectedTopicTitle(found.roadmap[0].title);
                  }
                }}
                className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
              >
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title} ({n.subject})
                  </option>
                ))}
              </select>
            </div>

            {activeNote && (
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Select Specific Topic
                </label>
                <select
                  value={selectedTopicTitle}
                  onChange={(e) => setSelectedTopicTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                >
                  {(activeNote.roadmap || []).map((t) => (
                    <option key={t.id} value={t.title}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </motion.div>

          {/* Input Text Box */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs"
          >
            <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Explain "{selectedTopicTitle}" in your own words:
            </label>
            <textarea
              value={userExplanation}
              onChange={(e) => setUserExplanation(e.target.value)}
              placeholder="Imagine you are teaching this concept to a classmate. Explain what it is, why it works, and a real-world example..."
              rows={5}
              className="w-full p-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-900 dark:text-zinc-100 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={isEvaluating || !userExplanation.trim()}
                className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs shadow-sm flex items-center space-x-2 disabled:opacity-50 transition-all"
              >
                {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isEvaluating ? "Evaluating Understanding..." : "Check My Understanding"}</span>
              </button>
            </div>
          </motion.div>

          {/* AI Evaluation Output */}
          <AnimatePresence>
            {currentEval && (
              <motion.div
                key={currentEval.id}
                variants={scaleIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Evaluation for "{currentEval.topicTitle}"
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold text-white ${scoreColor}`}>
                    Understanding: {currentEval.understandingPercent}%
                  </span>
                </div>

                <motion.div
                  variants={staggerContainer()}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
                >
                  {/* What was understood */}
                  <motion.div
                    variants={fadeInUp}
                    className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 space-y-2"
                  >
                    <span className="font-bold text-emerald-800 dark:text-emerald-300 block flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Understood Correctly</span>
                    </span>
                    {currentEval.understoodPoints.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1 text-emerald-900 dark:text-emerald-200">
                        {currentEval.understoodPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-emerald-700 dark:text-emerald-400/80 italic">Nothing flagged as solid yet.</p>
                    )}
                  </motion.div>

                  {/* Missing points */}
                  <motion.div
                    variants={fadeInUp}
                    className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2"
                  >
                    <span className="font-bold text-amber-800 dark:text-amber-300 block flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Missing Key Points</span>
                    </span>
                    {currentEval.missingPoints.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1 text-amber-900 dark:text-amber-200">
                        {currentEval.missingPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-amber-700 dark:text-amber-400/80 italic">Nothing missing — nice work.</p>
                    )}
                  </motion.div>

                  {/* Incorrect points, when the AI flagged any */}
                  {currentEval.incorrectPoints.length > 0 && (
                    <motion.div
                      variants={fadeInUp}
                      className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-2 sm:col-span-2"
                    >
                      <span className="font-bold text-red-800 dark:text-red-300 block flex items-center space-x-1.5">
                        <XCircle className="w-4 h-4" />
                        <span>Incorrect / Needs Correction</span>
                      </span>
                      <ul className="list-disc pl-5 space-y-1 text-red-900 dark:text-red-200">
                        {currentEval.incorrectPoints.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </motion.div>

                <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 space-y-1 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block uppercase text-[10px] text-zinc-500">Study Recommendation</span>
                    <p className="leading-relaxed">{currentEval.studyRecommendation}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};
