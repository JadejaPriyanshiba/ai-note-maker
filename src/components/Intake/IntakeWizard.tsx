import React, { useEffect, useState } from "react";
import {
  Sparkles,
  X,
  Loader2,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  ArrowRight,
  Trash2,
  ArrowLeft,
  ChevronDown,
  History,
  Settings2,
} from "lucide-react";
import { Modal } from "../Modal";
import { LearnerLevel, Complexity, Depth, NoteLanguage, IntakeSummary, NoteGenerationPreset } from "../../types";
import { generateIntakeBrief, IntakeBrief } from "../../lib/aiService";
import { dedupeSources } from "../../lib/intake/normalize";
import { assembleContext } from "../../lib/intake/assemble";
import { useSourceIntake, nextLocalId } from "../../lib/intake/useSourceIntake";
import {
  getIntakeSummaries,
  saveIntakeSummary,
  deleteIntakeSummary,
  getNoteGenerationPresets,
  saveNoteGenerationPreset,
  deleteNoteGenerationPreset,
} from "../../lib/storage";
import { SourceCollectorPanel } from "./SourceCollectorPanel";
import { PresetPicker } from "../PresetPicker";

const LEARNER_LEVELS: LearnerLevel[] = ["School", "Diploma", "Undergraduate", "Postgraduate", "Professional", "General learner"];
const COMPLEXITIES: Complexity[] = ["Beginner", "Easy", "Medium", "Advanced", "Expert"];
const DEPTHS: Depth[] = ["Quick revision", "Standard notes", "Detailed notes", "Exam preparation"];
const LANGUAGES: NoteLanguage[] = ["English", "Hindi", "Gujarati", "Spanish", "French", "German", "Other"];

interface IntakeWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onStartRoadmap: (
    subject: string,
    learnerLevel: LearnerLevel,
    complexity: Complexity,
    depth: Depth,
    language: NoteLanguage,
    instructions: string,
    initialTopics: { title: string; description: string; estimatedMinutes?: number }[]
  ) => void;
  // Deep-link support so callers (e.g. HomeView's "Saved Resources" section) can open straight
  // into a specific saved item instead of always landing on the blank input step.
  initialSummaryToResume?: IntakeSummary | null;
  initialExpandSaved?: boolean;
}

export const IntakeWizard: React.FC<IntakeWizardProps> = ({
  isOpen,
  onClose,
  onStartRoadmap,
  initialSummaryToResume,
  initialExpandSaved,
}) => {
  const intake = useSourceIntake();
  const [step, setStep] = useState<"input" | "clarify" | "result">("input");
  const [savedSummaries, setSavedSummaries] = useState<IntakeSummary[]>([]);
  const [showSavedSummaries, setShowSavedSummaries] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<IntakeBrief | null>(null);
  const [answers, setAnswers] = useState<string[]>(["", ""]);
  const [summarySaved, setSummarySaved] = useState(false);

  // Optional constraints on the intake-brief call — left unset ("Auto") lets the AI infer them as
  // it always has. generateIntakeBrief already accepts all four server-side as "Preferred X" hints
  // (server.ts), they just weren't wired up client-side until now.
  const [showSettings, setShowSettings] = useState(false);
  const [learnerLevel, setLearnerLevel] = useState<LearnerLevel | "">("");
  const [complexity, setComplexity] = useState<Complexity | "">("");
  const [depthOverride, setDepthOverride] = useState<Depth | "">("");
  const [languageOverride, setLanguageOverride] = useState<NoteLanguage | "">("");
  const [instructions, setInstructions] = useState("");
  const [presets, setPresets] = useState<NoteGenerationPreset[]>([]);

  useEffect(() => {
    if (isOpen) {
      intake.loadSavedSources();
      setSavedSummaries(getIntakeSummaries());
      setPresets(getNoteGenerationPresets());
      if (initialSummaryToResume) {
        resumeSavedSummary(initialSummaryToResume);
      }
      if (initialExpandSaved) {
        intake.setShowSaved(true);
      }
    } else {
      // Reset for next open — the wizard is intentionally ephemeral by default.
      setStep("input");
      intake.reset();
      setShowSavedSummaries(false);
      setError(null);
      setBrief(null);
      setAnswers(["", ""]);
      setSummarySaved(false);
      setShowSettings(false);
      setLearnerLevel("");
      setComplexity("");
      setDepthOverride("");
      setLanguageOverride("");
      setInstructions("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function loadNotePreset(preset: NoteGenerationPreset) {
    setLearnerLevel(preset.learnerLevel);
    setComplexity(preset.complexity);
    setDepthOverride(preset.depth);
    setLanguageOverride(preset.language);
    setInstructions(preset.instructions || "");
    setShowSettings(true);
  }

  function saveNotePreset(name: string) {
    const saved = saveNoteGenerationPreset({
      id: nextLocalId("npreset"),
      name,
      learnerLevel: learnerLevel || "Undergraduate",
      complexity: complexity || "Medium",
      depth: depthOverride || "Standard notes",
      language: languageOverride || "English",
      instructions: instructions.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setPresets((prev) => [saved, ...prev]);
  }

  function deleteNotePreset(id: string) {
    deleteNoteGenerationPreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  async function runAnalysis(priorQuestions?: string[], priorAnswers?: string[]) {
    setError(null);
    setIsAnalyzing(true);
    try {
      const extracted = dedupeSources(intake.readySources.map((s) => s.extracted!));
      const combinedPrompt = [intake.prompt.trim(), instructions.trim() ? `Style preferences: ${instructions.trim()}` : ""]
        .filter(Boolean)
        .join("\n\n");
      const assembled = assembleContext(extracted, combinedPrompt);
      const result = await generateIntakeBrief({
        prompt: combinedPrompt,
        sources: assembled.sources,
        learnerLevel: learnerLevel || undefined,
        complexity: complexity || undefined,
        depth: depthOverride || undefined,
        language: languageOverride || undefined,
        priorQuestions,
        priorAnswers,
      });
      setBrief(result);
      setSummarySaved(false);
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

  function handleContinueToRoadmap() {
    if (!brief) return;
    onStartRoadmap(
      brief.subject,
      brief.learnerLevel,
      brief.complexity,
      brief.depth,
      brief.language,
      brief.instructions,
      brief.topics
    );
    onClose();
  }

  // Saves the generated brief on its own — the intake-brief call already spent tokens producing
  // it, so a user who doesn't want to commit to a full roadmap yet still gets to keep it, and can
  // resume straight into this same result screen later with no new AI call.
  function handleSaveSummary() {
    if (!brief) return;
    const saved = saveIntakeSummary({
      id: nextLocalId("isum"),
      subject: brief.subject,
      mainTopic: brief.mainTopic,
      learnerLevel: brief.learnerLevel,
      complexity: brief.complexity,
      depth: brief.depth,
      language: brief.language,
      summary: brief.instructions,
      topics: brief.topics,
      confidence: brief.confidence,
      sourceTitles: intake.readySources.map((s) => s.title),
      prompt: intake.prompt.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSavedSummaries((prev) => [saved, ...prev]);
    setSummarySaved(true);
  }

  function resumeSavedSummary(s: IntakeSummary) {
    setBrief({
      subject: s.subject,
      mainTopic: s.mainTopic,
      learnerLevel: s.learnerLevel,
      complexity: s.complexity,
      depth: s.depth,
      language: s.language,
      instructions: s.summary,
      topics: s.topics,
      confidence: s.confidence,
      clarifyingQuestions: [],
    });
    setSummarySaved(true);
    setError(null);
    setStep("result");
  }

  function handleDeleteSummary(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteIntakeSummary(id);
    setSavedSummaries((prev) => prev.filter((s) => s.id !== id));
  }

  const canAnalyze = !intake.isBusy && !isAnalyzing && (intake.prompt.trim().length > 0 || intake.readySources.length > 0);

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
                Describe what you want, or drop in PDFs / links — we'll figure out the rest.
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
            {savedSummaries.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSavedSummaries((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Your saved summaries ({savedSummaries.length})</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSavedSummaries ? "rotate-180" : ""}`} />
                </button>
                {showSavedSummaries && (
                  <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                    {savedSummaries.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => resumeSavedSummary(s)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{s.subject}</p>
                          <p className="text-[11px] text-zinc-400">
                            {s.topics.length} topics • {s.confidence}% confidence • {new Date(s.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleDeleteSummary(s.id, e)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <SourceCollectorPanel intake={intake} />

            <div>
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Generation settings (optional)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSettings ? "rotate-180" : ""}`} />
              </button>
              {showSettings && (
                <div className="mt-2 space-y-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="space-y-1">
                      <label className="block font-semibold text-zinc-600 dark:text-zinc-400">Learner Level</label>
                      <select
                        value={learnerLevel}
                        onChange={(e) => setLearnerLevel(e.target.value as LearnerLevel | "")}
                        className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                      >
                        <option value="">Auto</option>
                        {LEARNER_LEVELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block font-semibold text-zinc-600 dark:text-zinc-400">Complexity</label>
                      <select
                        value={complexity}
                        onChange={(e) => setComplexity(e.target.value as Complexity | "")}
                        className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                      >
                        <option value="">Auto</option>
                        {COMPLEXITIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block font-semibold text-zinc-600 dark:text-zinc-400">Depth</label>
                      <select
                        value={depthOverride}
                        onChange={(e) => setDepthOverride(e.target.value as Depth | "")}
                        className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                      >
                        <option value="">Auto</option>
                        {DEPTHS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block font-semibold text-zinc-600 dark:text-zinc-400">Language</label>
                      <select
                        value={languageOverride}
                        onChange={(e) => setLanguageOverride(e.target.value as NoteLanguage | "")}
                        className="w-full p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                      >
                        <option value="">Auto</option>
                        {LANGUAGES.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Instructions (optional)</label>
                    <input
                      type="text"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. Use simple analogies, avoid jargon, focus on exam-relevant points..."
                      className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
                    />
                  </div>

                  <PresetPicker
                    label="Notes"
                    presets={presets}
                    onLoad={loadNotePreset}
                    onSaveNew={saveNotePreset}
                    onDelete={deleteNotePreset}
                  />
                </div>
              )}
            </div>

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

        {step === "result" && brief && (
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
              <span className="text-xs text-zinc-400">{brief.topics.length} topics planned</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {[
                ["Subject", brief.subject],
                ["Level", brief.learnerLevel],
                ["Complexity", brief.complexity],
                ["Depth", brief.depth],
              ].map(([label, value]) => (
                <div key={label} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <p className="font-semibold text-zinc-400">{label}</p>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{value}</p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-h-28 overflow-y-auto">
              <p className="text-[11px] font-semibold text-zinc-400 mb-1">Generation brief</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{brief.instructions}</p>
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto">
              {brief.topics.map((t, idx) => (
                <div key={idx} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-xs">
                  <span className="font-bold text-zinc-300 dark:text-zinc-600 shrink-0">{idx + 1}.</span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{t.title}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-1">
              <button type="button" onClick={() => setStep("input")} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Start over
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSummary}
                  disabled={summarySaved}
                  title="Save this summary without generating a full note — no new AI call to resume it later"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-default transition-colors"
                >
                  {summarySaved ? (
                    <>
                      <BookmarkCheck className="w-3.5 h-3.5 text-emerald-500" /> Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5" /> Save Summary
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleContinueToRoadmap}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold shadow-md transition-all"
                >
                  Continue to Roadmap <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
