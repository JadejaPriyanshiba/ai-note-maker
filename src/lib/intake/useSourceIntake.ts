import React, { useMemo, useRef, useState } from "react";
import { KnowledgeSource, KnowledgeSourceType } from "../../types";
import { fetchUrlSource } from "./api";
import { extractPdfText } from "./pdfExtractor";
import { buildExtractedSource, dedupeSources, countWords } from "./normalize";
import { chunkSources } from "./chunk";
import { computeConfidence } from "./confidence";
import { ExtractedSource } from "./types";
import { summarizeSource } from "../aiService";
import { getKnowledgeSources, saveKnowledgeSource, deleteKnowledgeSource } from "../storage";

export interface WizardSource {
  id: string;
  sourceType: KnowledgeSourceType;
  title: string;
  status: "extracting" | "ready" | "error";
  errorMessage?: string;
  extracted?: ExtractedSource;
  savedAs?: string; // KnowledgeSource id, if this came from (or was saved to) the saved-sources library
  summary?: string; // set once saved — the AI-generated per-resource summary
  keyPoints?: string[];
  isSaving?: boolean; // true while the save-time summarize call is in flight
}

let localIdCounter = 0;
export function nextLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}_${Date.now()}_${localIdCounter}`;
}

// Everything needed to let a user describe a request in free text and attach PDFs / links / pasted
// text / saved-library sources toward it, plus a live deterministic confidence estimate — shared
// between the notes intake wizard and the Shorts Hub intake wizard so the fiddly bits (PDF
// extraction, URL fetch, dedupe, saved-source save/delete) exist in exactly one place.
export function useSourceIntake() {
  const [prompt, setPrompt] = useState("");
  const [sources, setSources] = useState<WizardSource[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [savedSources, setSavedSources] = useState<KnowledgeSource[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [expandedSourceTab, setExpandedSourceTab] = useState<"summary" | "raw">("summary");
  const [expandedSavedSourceId, setExpandedSavedSourceId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const readySources = sources.filter((s) => s.status === "ready" && s.extracted);
  const isBusy = sources.some((s) => s.status === "extracting");

  // Live, purely deterministic coverage estimate — helps the user judge "do I need more source
  // material" before spending an AI call, without calling the model at all.
  const confidencePreview = useMemo(() => {
    const extracted = readySources.map((s) => s.extracted!);
    const chunks = chunkSources(dedupeSources(extracted));
    return computeConfidence(prompt, chunks);
  }, [readySources, prompt]);

  function loadSavedSources() {
    setSavedSources(getKnowledgeSources());
  }

  function reset() {
    setPrompt("");
    setSources([]);
    setUrlInput("");
    setPasteText("");
    setShowPaste(false);
    setExpandedSourceId(null);
    setExpandedSourceTab("summary");
    setExpandedSavedSourceId(null);
    setSaveError(null);
  }

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

  // Generates a real per-resource AI summary — only at the moment of saving, never automatically
  // when a source is added, so this additive AI call stays bounded to deliberate user intent. On
  // a summarization failure, still saves (with a short raw excerpt as a fallback) rather than
  // losing the source entirely — only the summary/excerpt is persisted, never the full raw text,
  // to stay well under Firestore's document size limit.
  async function saveSourceForLater(wizardSource: WizardSource) {
    if (!wizardSource.extracted || wizardSource.savedAs || wizardSource.isSaving) return;
    upsertSource({ ...wizardSource, isSaving: true });

    let summary: string;
    let keyPoints: string[] = [];
    try {
      const result = await summarizeSource({
        title: wizardSource.title,
        text: wizardSource.extracted.text,
        sourceType: wizardSource.sourceType,
      });
      summary = result.summary;
      keyPoints = result.keyPoints;
    } catch (err: any) {
      summary =
        wizardSource.extracted.text.length > 500
          ? wizardSource.extracted.text.slice(0, 500) + "…"
          : wizardSource.extracted.text;
      setSaveError(`Couldn't generate an AI summary for "${wizardSource.title}" (saved with a raw excerpt instead): ${err.message || "unknown error"}`);
    }

    const saved = saveKnowledgeSource({
      id: nextLocalId("ksrc"),
      sourceType: wizardSource.sourceType,
      title: wizardSource.title,
      originUrl: wizardSource.extracted.originUrl,
      fileName: wizardSource.extracted.fileName,
      brief: summary,
      keyPoints,
      wordCount: wizardSource.extracted.wordCount,
      contentHash: wizardSource.extracted.contentHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setSavedSources((prev) => [saved, ...prev]);
    upsertSource({ ...wizardSource, savedAs: saved.id, summary, keyPoints, isSaving: false });
  }

  function deleteSavedSource(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteKnowledgeSource(id);
    setSavedSources((prev) => prev.filter((s) => s.id !== id));
    setSources((prev) => prev.map((s) => (s.savedAs === id ? { ...s, savedAs: undefined } : s)));
    if (expandedSavedSourceId === id) setExpandedSavedSourceId(null);
  }

  return {
    prompt,
    setPrompt,
    sources,
    urlInput,
    setUrlInput,
    pasteText,
    setPasteText,
    showPaste,
    setShowPaste,
    savedSources,
    showSaved,
    setShowSaved,
    expandedSourceId,
    setExpandedSourceId,
    expandedSourceTab,
    setExpandedSourceTab,
    expandedSavedSourceId,
    setExpandedSavedSourceId,
    saveError,
    fileInputRef,
    readySources,
    isBusy,
    confidencePreview,
    loadSavedSources,
    reset,
    handleFiles,
    handleAddUrl,
    handleAddPastedText,
    toggleSavedSource,
    removeSource,
    saveSourceForLater,
    deleteSavedSource,
  };
}

export type UseSourceIntakeResult = ReturnType<typeof useSourceIntake>;
