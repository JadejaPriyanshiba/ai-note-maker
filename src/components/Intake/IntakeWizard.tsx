import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  FileText,
  Link2,
  Youtube,
  AlignLeft,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  BookmarkCheck,
  ArrowRight,
  Trash2,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { Modal } from "../Modal";
import { LearnerLevel, Complexity, Depth, NoteLanguage, KnowledgeSource, KnowledgeSourceType } from "../../types";
import { generateIntakeBrief, IntakeBrief } from "../../lib/aiService";
import { fetchUrlSource } from "../../lib/intake/api";
import { extractPdfText } from "../../lib/intake/pdfExtractor";
import { buildExtractedSource, dedupeSources, countWords } from "../../lib/intake/normalize";
import { chunkSources } from "../../lib/intake/chunk";
import { assembleContext } from "../../lib/intake/assemble";
import { computeConfidence } from "../../lib/intake/confidence";
import { ExtractedSource } from "../../lib/intake/types";
import { getKnowledgeSources, saveKnowledgeSource } from "../../lib/storage";

interface WizardSource {
  id: string;
  sourceType: KnowledgeSourceType;
  title: string;
  status: "extracting" | "ready" | "error";
  errorMessage?: string;
  extracted?: ExtractedSource;
  savedAs?: string; // KnowledgeSource id, if this came from (or was saved to) the saved-sources library
}

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
}

const sourceIcon: Record<KnowledgeSourceType, React.ElementType> = {
  pdf: FileText,
  web: Link2,
  youtube: Youtube,
  text: AlignLeft,
};

let localIdCounter = 0;
function nextLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}_${Date.now()}_${localIdCounter}`;
}

export const IntakeWizard: React.FC<IntakeWizardProps> = ({ isOpen, onClose, onStartRoadmap }) => {
  const [step, setStep] = useState<"input" | "clarify" | "result">("input");
  const [prompt, setPrompt] = useState("");
  const [sources, setSources] = useState<WizardSource[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [savedSources, setSavedSources] = useState<KnowledgeSource[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<IntakeBrief | null>(null);
  const [answers, setAnswers] = useState<string[]>(["", ""]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSavedSources(getKnowledgeSources());
    } else {
      // Reset for next open — the wizard is intentionally ephemeral by default.
      setStep("input");
      setPrompt("");
      setSources([]);
      setUrlInput("");
      setPasteText("");
      setShowPaste(false);
      setError(null);
      setBrief(null);
      setAnswers(["", ""]);
    }
  }, [isOpen]);

  const readySources = sources.filter((s) => s.status === "ready" && s.extracted);
  const isBusy = sources.some((s) => s.status === "extracting");

  // Live, purely deterministic coverage estimate — helps the user judge "do I need more source
  // material" before spending an AI call, without calling the model at all.
  const confidencePreview = useMemo(() => {
    const extracted = readySources.map((s) => s.extracted!);
    const chunks = chunkSources(dedupeSources(extracted));
    return computeConfidence(prompt, chunks);
  }, [readySources, prompt]);

  function upsertSource(update: WizardSource) {
    setSources((prev) => {
      const idx = prev.findIndex((s) => s.id === update.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = update;
        return next;
      }
      return [...prev, update];
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) continue;
      const id = nextLocalId("pdf");
      upsertSource({ id, sourceType: "pdf", title: file.name, status: "extracting" });
      try {
        const { text } = await extractPdfText(file);
        if (countWords(text) < 20) {
          throw new Error("No extractable text found (this may be a scanned/image-only PDF).");
        }
        const extracted = buildExtractedSource(id, "pdf", file.name, text, { fileName: file.name });
        upsertSource({ id, sourceType: "pdf", title: file.name, status: "ready", extracted });
      } catch (err: any) {
        upsertSource({ id, sourceType: "pdf", title: file.name, status: "error", errorMessage: err.message || "Failed to read this PDF." });
      }
    }
  }

  async function handleAddUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setUrlInput("");
    const id = nextLocalId("url");
    upsertSource({ id, sourceType: "web", title: url, status: "extracting" });
    try {
      const result = await fetchUrlSource(url);
      const extracted = buildExtractedSource(id, result.sourceType, result.title, result.text, { originUrl: result.originUrl });
      upsertSource({ id, sourceType: result.sourceType, title: result.title, status: "ready", extracted });
    } catch (err: any) {
      upsertSource({ id, sourceType: "web", title: url, status: "error", errorMessage: err.message || "Failed to fetch this URL." });
    }
  }

  function handleAddPastedText() {
    const text = pasteText.trim();
    if (!text) return;
    const id = nextLocalId("text");
    const title = `Pasted text (${countWords(text)} words)`;
    const extracted = buildExtractedSource(id, "text", title, text);
    upsertSource({ id, sourceType: "text", title, status: "ready", extracted });
    setPasteText("");
    setShowPaste(false);
  }

  function toggleSavedSource(source: KnowledgeSource) {
    const existing = sources.find((s) => s.savedAs === source.id);
    if (existing) {
      setSources((prev) => prev.filter((s) => s.id !== existing.id));
      return;
    }
    const id = nextLocalId("saved");
    const extracted = buildExtractedSource(id, source.sourceType, source.title, source.brief, {
      originUrl: source.originUrl,
      fileName: source.fileName,
    });
    upsertSource({ id, sourceType: source.sourceType, title: source.title, status: "ready", extracted, savedAs: source.id });
  }

  function removeSource(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  async function saveSourceForLater(wizardSource: WizardSource) {
    if (!wizardSource.extracted || wizardSource.savedAs) return;
    // Only the compressed brief is persisted — never the raw extracted text — to stay well
    // under Firestore's document size limit and because the brief is what future intake
    // sessions actually consume.
    const brief = wizardSource.extracted.text.length > 1200
      ? wizardSource.extracted.text.slice(0, 1200) + "…"
      : wizardSource.extracted.text;
    const saved = saveKnowledgeSource({
      id: nextLocalId("ksrc"),
      sourceType: wizardSource.sourceType,
      title: wizardSource.title,
      originUrl: wizardSource.extracted.originUrl,
      fileName: wizardSource.extracted.fileName,
      brief,
      wordCount: wizardSource.extracted.wordCount,
      contentHash: wizardSource.extracted.contentHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSavedSources((prev) => [saved, ...prev]);
    upsertSource({ ...wizardSource, savedAs: saved.id });
  }

  async function runAnalysis(priorQuestions?: string[], priorAnswers?: string[]) {
    setError(null);
    setIsAnalyzing(true);
    try {
      const extracted = dedupeSources(readySources.map((s) => s.extracted!));
      const assembled = assembleContext(extracted, prompt);
      const result = await generateIntakeBrief({
        prompt: prompt.trim(),
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

  const canAnalyze = !isBusy && !isAnalyzing && (prompt.trim().length > 0 || readySources.length > 0);

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

        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === "input" && (
          <div className="space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "I need exam-ready notes on the attached lecture slides, focused on the practical parts"'
              rows={3}
              className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 resize-none"
            />

            <div className="flex flex-wrap gap-2">
              <input ref={fileInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Add PDFs
              </button>
              <button
                type="button"
                onClick={() => setShowPaste((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <AlignLeft className="w-3.5 h-3.5" /> Paste text
              </button>
            </div>

            {showPaste && (
              <div className="flex gap-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste any text content here..."
                  rows={3}
                  className="flex-1 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white outline-none resize-none"
                />
                <button
                  type="button"
                  onClick={handleAddPastedText}
                  disabled={!pasteText.trim()}
                  className="shrink-0 px-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950">
                <Link2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddUrl())}
                  placeholder="Paste a web article or YouTube URL..."
                  className="w-full bg-transparent py-2.5 text-xs font-medium text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAddUrl}
                disabled={!urlInput.trim()}
                className="shrink-0 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                Add link
              </button>
            </div>

            {savedSources.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowSaved((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Your saved sources ({savedSources.length})</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSaved ? "rotate-180" : ""}`} />
                </button>
                {showSaved && (
                  <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                    {savedSources.map((s) => {
                      const included = sources.some((w) => w.savedAs === s.id);
                      const Icon = sourceIcon[s.sourceType];
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSavedSource(s)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors border ${
                            included
                              ? "bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white text-white dark:text-zinc-900"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate flex-1 font-medium">{s.title}</span>
                          {included && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {sources.length > 0 && (
              <div className="space-y-1.5">
                {sources.map((s) => {
                  const Icon = sourceIcon[s.sourceType];
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    >
                      <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{s.title}</p>
                        {s.status === "error" && <p className="text-[11px] text-red-600 dark:text-red-400">{s.errorMessage}</p>}
                        {s.status === "ready" && s.extracted && (
                          <p className="text-[11px] text-zinc-400">{s.extracted.wordCount.toLocaleString()} words</p>
                        )}
                      </div>
                      {s.status === "extracting" && <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin shrink-0" />}
                      {s.status === "ready" && !s.savedAs && (
                        <button
                          type="button"
                          onClick={() => saveSourceForLater(s)}
                          title="Save this source for future imports"
                          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {s.savedAs && (
                        <span title="Saved to your library">
                          <BookmarkCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeSource(s.id)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {(prompt.trim() || readySources.length > 0) && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  <span>Estimated coverage</span>
                  <span>{confidencePreview.score}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] ${
                      confidencePreview.score >= 70 ? "bg-emerald-500" : confidencePreview.score >= 40 ? "bg-amber-500" : "bg-red-400"
                    }`}
                    style={{ width: `${confidencePreview.score}%` }}
                  />
                </div>
              </div>
            )}

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
              <button
                type="button"
                onClick={handleContinueToRoadmap}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold shadow-md transition-all"
              >
                Continue to Roadmap <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
