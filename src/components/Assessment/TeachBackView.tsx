import React, { useState } from "react";
import { NoteDocument, TeachBackEvaluation } from "../../types";
import { evaluateTeachBack } from "../../lib/aiService";
import { saveTeachBackEvaluation, getTeachBackEvaluations } from "../../lib/storage";
import { Brain, Sparkles, CheckCircle2, AlertTriangle, Send } from "lucide-react";

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          Active Recall & Self-Teaching
        </span>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 flex items-center space-x-2">
          <Brain className="w-6 h-6" />
          <span>Teach-Back Learning Mode</span>
        </h1>
        <p className="text-xs text-zinc-500">
          Explain a topic in your own words to evaluate comprehension and pinpoint missing concepts.
        </p>
      </div>

      {/* Select Note & Topic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {notes.length > 0 && (
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
              className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-medium"
            >
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title} ({n.subject})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeNote && (
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Select Specific Topic
            </label>
            <select
              value={selectedTopicTitle}
              onChange={(e) => setSelectedTopicTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 font-medium"
            >
              {(activeNote.roadmap || []).map((t) => (
                <option key={t.id} value={t.title}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Input Text Box */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
        <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
          Explain "{selectedTopicTitle}" in your own words:
        </label>
        <textarea
          value={userExplanation}
          onChange={(e) => setUserExplanation(e.target.value)}
          placeholder="Imagine you are teaching this concept to a classmate. Explain what it is, why it works, and a real-world example..."
          rows={5}
          className="w-full p-3.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-900 dark:text-zinc-100 text-xs leading-relaxed focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleEvaluate}
            disabled={isEvaluating || !userExplanation.trim()}
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs shadow-sm flex items-center space-x-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isEvaluating ? "Evaluating Understanding..." : "Check My Understanding"}</span>
          </button>
        </div>
      </div>

      {/* AI Evaluation Output */}
      {currentEval && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Evaluation for "{currentEval.topicTitle}"
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              Understanding: {currentEval.understandingPercent}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* What was understood */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 block flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Understood Correctly:</span>
              </span>
              <ul className="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
                {currentEval.understoodPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            {/* Missing points */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 block flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Missing Key Points:</span>
              </span>
              <ul className="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
                {currentEval.missingPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 space-y-1">
            <span className="font-bold block uppercase text-[10px] text-zinc-500">Study Recommendation:</span>
            <p className="leading-relaxed">{currentEval.studyRecommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
};
