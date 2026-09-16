import React, { useEffect, useState } from "react";
import { Sparkles, X, Loader2, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";
import { Modal } from "../Modal";
import { generateIntakeBrief, IntakeBrief } from "../../lib/aiService";
import { dedupeSources } from "../../lib/intake/normalize";
import { assembleContext } from "../../lib/intake/assemble";
import { useSourceIntake } from "../../lib/intake/useSourceIntake";
import { SourceCollectorPanel } from "../Intake/SourceCollectorPanel";
import { mapBriefToShortsSettings, ShortsSettings } from "../../lib/intake/mapToShortsSettings";

interface ShortsIntakeWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: ShortsSettings) => void;
}

// Shorts Hub's equivalent of IntakeWizard — same source-collection UI (shared via
// useSourceIntake/SourceCollectorPanel, including the same saved-sources library), same
// generateIntakeBrief AI call, but instead of starting a note roadmap it maps the resulting brief
// onto ShortsSetupView's plain topic/depth/language/difficulty fields for the user to review.
export const ShortsIntakeWizard: React.FC<ShortsIntakeWizardProps> = ({ isOpen, onClose, onApply }) => {
  const intake = useSourceIntake();
  const [step, setStep] = useState<"input" | "clarify" | "result">("input");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<IntakeBrief | null>(null);
  const [answers, setAnswers] = useState<string[]>(["", ""]);

  useEffect(() => {
    if (isOpen) {
      intake.loadSavedSources();
    } else {
      setStep("input");
      intake.reset();
      setError(null);
      setBrief(null);
      setAnswers(["", ""]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function runAnalysis(priorQuestions?: string[], priorAnswers?: string[]) {
    setError(null);
    setIsAnalyzing(true);
    try {
      const extracted = dedupeSources(intake.readySources.map((s) => s.extracted!));
      const assembled = assembleContext(extracted, intake.prompt);
      const result = await generateIntakeBrief({
        prompt: intake.prompt.trim(),
        sources: assembled.sources,
        priorQuestions,
        priorAnswers,
      });
      setBrief(result);
      if (!priorQuestions && result.confidence < 70 && result.clarifyingQuestions.length > 0) {
        setStep("clarify");
      } else {
        setStep("result");
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze your request. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleClarifyContinue() {
    if (!brief) return;
    runAnalysis(brief.clarifyingQuestions, answers);
  }

  function handleContinueToSetup() {
    if (!brief) return;
    onApply(mapBriefToShortsSettings(brief));
    onClose();
  }

  const canAnalyze = !intake.isBusy && !isAnalyzing && (intake.prompt.trim().length > 0 || intake.readySources.length > 0);
  const settingsPreview = brief ? mapBriefToShortsSettings(brief) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} panelClassName="max-w-2xl">
      <div className="p-6 sm:p-7 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-white dark:text-zinc-900" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">Import from your materials</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Drop in PDFs / links, or describe what you want — we'll set up your learning tree topic for you.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {(error || intake.saveError) && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error || intake.saveError}</span>
          </div>
        )}

        {step === "input" && (
          <div className="space-y-4">
            <SourceCollectorPanel
              intake={intake}
              promptPlaceholder='e.g. "Build me a learning tree from these lecture slides, focused on exam-relevant subtopics"'
            />

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runAnalysis()}
                disabled={!canAnalyze}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing…
                  </>
                ) : (
                  <>
                    Analyze <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "clarify" && brief && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              A couple of quick questions will help us get this right — skip any you're not sure about.
            </p>
            {brief.clarifyingQuestions.map((q, idx) => (
              <div key={idx} className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{q}</label>
                <input
                  type="text"
                  value={answers[idx] || ""}
                  onChange={(e) => setAnswers((prev) => { const next = [...prev]; next[idx] = e.target.value; return next; })}
                  className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white outline-none"
                />
              </div>
            ))}
            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep("input")} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={handleClarifyContinue}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold shadow-md disabled:opacity-40 transition-all"
              >
                {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Continue <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        )}

        {step === "result" && brief && settingsPreview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  brief.confidence >= 70
                    ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
                    : "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
                }`}
              >
                {brief.confidence}% confidence
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {[
                ["Topic", settingsPreview.mainTopic],
                ["Tree Depth", `${settingsPreview.depth} levels`],
                ["Language", settingsPreview.language],
                ["Difficulty", settingsPreview.difficulty],
              ].map(([label, value]) => (
                <div key={label} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <p className="font-semibold text-zinc-400">{label}</p>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{value}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-28 overflow-y-auto">
              <p className="text-[11px] font-semibold text-zinc-400 mb-1">Additional context</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{settingsPreview.topicDescription}</p>
            </div>

            <p className="text-[11px] text-zinc-400">
              You'll be able to review and edit all of this before generating your learning tree.
            </p>

            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep("input")} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Start over
              </button>
              <button
                type="button"
                onClick={handleContinueToSetup}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold shadow-md transition-all"
              >
                Continue to Setup <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
