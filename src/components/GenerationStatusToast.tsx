import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useGeneration } from "../lib/GenerationContext";
import { NoteDocument } from "../types";
import { Loader2, CheckCircle2, AlertTriangle, X, ArrowRight, PlayCircle } from "lucide-react";

interface GenerationStatusToastProps {
  onOpenNote: (note: NoteDocument) => void;
}

// Floating bottom-left indicator for the background note-generation job owned by
// GenerationContext. Visible from anywhere in the app — Home, Notes list, another note's
// Studio — so navigating away from the generation screen never leaves the user wondering
// whether it's still running or stuck, and always gives a way back to finish it.
export const GenerationStatusToast: React.FC<GenerationStatusToastProps> = ({ onOpenNote }) => {
  const { activeGeneration, startGeneration } = useGeneration();
  const [dismissedNoteId, setDismissedNoteId] = useState<string | null>(null);

  if (!activeGeneration) return null;
  const { note, isGenerating, errorMessage } = activeGeneration;

  const completedCount = (note.roadmap || []).filter((t) => t.status === "completed").length;
  const skippedCount = (note.roadmap || []).filter((t) => t.status === "skipped").length;
  const totalCount = (note.roadmap || []).length;
  const processedCount = completedCount + skippedCount;
  const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;
  const isAllFinished = totalCount > 0 && processedCount === totalCount;
  const hasPendingWork = !isAllFinished;

  // Dismissing hides the toast, but generation keeps running regardless — a failure that needs
  // a user decision (retry/skip) always resurfaces it even if this exact note was dismissed.
  if (dismissedNoteId === note.id && !errorMessage) return null;

  const currentTopic = (note.roadmap || []).find((t) => t.status === "generating");

  return (
    <AnimatePresence>
      <motion.div
        key={note.id}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed bottom-4 left-4 z-40 w-[calc(100vw-2rem)] max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 space-y-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isGenerating ? (
              <Loader2 className="w-4 h-4 text-zinc-700 dark:text-zinc-300 animate-spin shrink-0" />
            ) : errorMessage ? (
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {isGenerating
                  ? "Generating notes…"
                  : errorMessage
                  ? "Generation paused"
                  : isAllFinished
                  ? "Notes generated"
                  : "Generation idle"}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{note.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissedNoteId(note.id)}
            className="shrink-0 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Dismiss (generation keeps running in the background)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {isGenerating && currentTopic && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
            Working on: <span className="font-medium text-zinc-700 dark:text-zinc-300">{currentTopic.title}</span>
          </p>
        )}

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <span>{processedCount}/{totalCount} topics</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300">{progressPercent}%</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${errorMessage ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenNote(note)}
            className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>{isAllFinished ? "Open Note" : "View Progress"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          {!isGenerating && hasPendingWork && !errorMessage && (
            <button
              type="button"
              onClick={() => startGeneration(note, activeGeneration.batchSize)}
              className="shrink-0 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              title="Continue generating remaining topics"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Continue</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
