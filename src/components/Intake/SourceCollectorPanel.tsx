import React, { useMemo } from "react";
import {
  FileText,
  Link2,
  Youtube,
  AlignLeft,
  Loader2,
  Bookmark,
  BookmarkCheck,
  Trash2,
  ChevronDown,
  Code2,
} from "lucide-react";
import { KnowledgeSourceType } from "../../types";
import { chunkSource } from "../../lib/intake/chunk";
import { ExtractedSource } from "../../lib/intake/types";
import { UseSourceIntakeResult } from "../../lib/intake/useSourceIntake";

const sourceIcon: Record<KnowledgeSourceType, React.ElementType> = {
  pdf: FileText,
  web: Link2,
  youtube: Youtube,
  text: AlignLeft,
};

// Technical/debug view — shows exactly what the deterministic pipeline (chunk.ts) produces for
// this source, with no AI involved. Purely for inspection, nothing here is interactive/editable.
const RawChunksView: React.FC<{ source: ExtractedSource }> = ({ source }) => {
  const chunks = useMemo(() => chunkSource(source), [source]);
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-zinc-400 font-mono">
        {source.wordCount.toLocaleString()} words • {chunks.length} chunk{chunks.length === 1 ? "" : "s"} • hash {source.contentHash}
      </p>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {chunks.map((c) => (
          <div key={c.id} className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              {c.heading || "(no heading)"} · {c.wordCount}w
            </p>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-2 font-mono">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

interface SourceCollectorPanelProps {
  intake: UseSourceIntakeResult;
  promptPlaceholder?: string;
  promptRows?: number;
}

// The "describe your request + attach materials" panel shared by the notes intake wizard and the
// Shorts Hub intake wizard — everything here is generic (not tied to what the caller does with the
// result), so it stays in one place instead of being duplicated per wizard.
export const SourceCollectorPanel: React.FC<SourceCollectorPanelProps> = ({
  intake,
  promptPlaceholder = 'e.g. "I need exam-ready notes on the attached lecture slides, focused on the practical parts"',
  promptRows = 3,
}) => {
  const {
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
    fileInputRef,
    readySources,
    confidencePreview,
    handleFiles,
    handleAddUrl,
    handleAddPastedText,
    toggleSavedSource,
    removeSource,
    saveSourceForLater,
    deleteSavedSource,
  } = intake;

  return (
    <div className="space-y-4">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={promptPlaceholder}
        rows={promptRows}
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
            <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
              {savedSources.map((s) => {
                const included = sources.some((w) => w.savedAs === s.id);
                const Icon = sourceIcon[s.sourceType];
                const isExpanded = expandedSavedSourceId === s.id;
                return (
                  <div
                    key={s.id}
                    className={`rounded-lg border overflow-hidden ${
                      included
                        ? "bg-zinc-900 dark:bg-white border-zinc-900 dark:border-white"
                        : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSavedSource(s)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors ${
                        included
                          ? "text-white dark:text-zinc-900"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1 font-medium">{s.title}</span>
                      {included && <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedSavedSourceId(isExpanded ? null : s.id);
                        }}
                        className="p-0.5 rounded shrink-0"
                        title="View saved summary"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => deleteSavedSource(s.id, e)}
                        className={`p-0.5 rounded shrink-0 ${included ? "hover:text-red-300" : "hover:text-red-600 dark:hover:text-red-400"}`}
                        title="Delete this saved source"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    </button>
                    {isExpanded && (
                      <div
                        className={`px-2.5 pb-2.5 pt-1 space-y-1.5 border-t ${
                          included ? "border-white/20 dark:border-zinc-900/20" : "border-zinc-100 dark:border-zinc-800"
                        }`}
                      >
                        <p className={`text-[11px] leading-relaxed ${included ? "text-white/90 dark:text-zinc-900/90" : "text-zinc-600 dark:text-zinc-400"}`}>
                          {s.brief}
                        </p>
                        {s.keyPoints && s.keyPoints.length > 0 && (
                          <ul className="space-y-1">
                            {s.keyPoints.map((kp, idx) => (
                              <li
                                key={idx}
                                className={`flex items-start gap-1.5 text-[10px] ${included ? "text-white/80 dark:text-zinc-900/80" : "text-zinc-500 dark:text-zinc-500"}`}
                              >
                                <span className="w-1 h-1 rounded-full bg-current shrink-0 mt-1.5" />
                                <span>{kp}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className={`text-[10px] ${included ? "text-white/60 dark:text-zinc-900/60" : "text-zinc-400"}`}>
                          {s.wordCount.toLocaleString()} words • saved {new Date(s.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
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
            const isExpanded = expandedSourceId === s.id;
            return (
              <div
                key={s.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden"
              >
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{s.title}</p>
                    {s.status === "error" && <p className="text-[11px] text-red-600 dark:text-red-400">{s.errorMessage}</p>}
                    {s.status === "ready" && s.extracted && (
                      <p className="text-[11px] text-zinc-400">{s.extracted.wordCount.toLocaleString()} words</p>
                    )}
                  </div>
                  {s.status === "extracting" && <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin shrink-0" />}
                  {s.status === "ready" && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedSourceId(isExpanded ? null : s.id);
                        setExpandedSourceTab("summary");
                      }}
                      title="View summary / raw chunks"
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  {s.status === "ready" && !s.savedAs && (
                    <button
                      type="button"
                      onClick={() => saveSourceForLater(s)}
                      disabled={s.isSaving}
                      title="Save this source — generates an AI summary you can read later"
                      className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-50 transition-colors"
                    >
                      {s.isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
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

                {isExpanded && s.extracted && (
                  <div className="px-3 pb-3 pt-1 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setExpandedSourceTab("summary")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          expandedSourceTab === "summary"
                            ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                            : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                      >
                        Summary
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedSourceTab("raw")}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          expandedSourceTab === "raw"
                            ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
                            : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        }`}
                        title="Technical view: how the deterministic pipeline chunked this source"
                      >
                        <Code2 className="w-3 h-3" /> Raw
                      </button>
                    </div>

                    {expandedSourceTab === "summary" ? (
                      s.summary ? (
                        <div className="space-y-1.5">
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{s.summary}</p>
                          {s.keyPoints && s.keyPoints.length > 0 && (
                            <ul className="space-y-1">
                              {s.keyPoints.map((kp, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                                  <span className="w-1 h-1 rounded-full bg-zinc-400 shrink-0 mt-1.5" />
                                  <span>{kp}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400 italic">
                          No AI summary yet — click the bookmark icon to save this source and generate one.
                        </p>
                      )
                    ) : (
                      <RawChunksView source={s.extracted} />
                    )}
                  </div>
                )}
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
    </div>
  );
};
