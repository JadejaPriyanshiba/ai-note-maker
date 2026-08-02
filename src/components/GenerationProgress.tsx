import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { NoteDocument, RoadmapTopic, NoteSection } from "../types";
import { generateTopicNotes } from "../lib/aiService";
import { saveNote } from "../lib/storage";
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight, RefreshCw, SkipForward, ShieldCheck, FastForward } from "lucide-react";
import { fadeInUp, staggerContainer } from "../lib/motion";

interface GenerationProgressProps {
  note: NoteDocument;
  batchSize: number;
  onComplete: (updatedNote: NoteDocument) => void;
  onCancel: () => void;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  note: initialNote,
  batchSize = 1,
  onComplete,
  onCancel,
}) => {
  const [note, setNote] = useState<NoteDocument>(initialNote);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeTopicIndex, setActiveTopicIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedTopicIndex, setFailedTopicIndex] = useState<number | null>(null);
  
  const isCancelledRef = useRef<boolean>(false);

  // Auto start generation if pending
  useEffect(() => {
    startOrResumeGeneration();
    return () => {
      isCancelledRef.current = true;
    };
  }, []);

  const startOrResumeGeneration = async () => {
    isCancelledRef.current = false;
    setIsGenerating(true);
    setErrorMessage(null);
    setFailedTopicIndex(null);

    const pendingTopics = note.roadmap || [];
    let currentNoteState = { ...note, sections: note.sections || [] };

    for (let i = 0; i < pendingTopics.length; i++) {
      if (isCancelledRef.current) break;

      const topic = pendingTopics[i];

      // Skip already completed or skipped topics
      if (topic.status === "completed" || topic.status === "skipped") continue;

      setActiveTopicIndex(i);

      // Pacing delay between sequential requests to prevent hitting rate limits
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Mark topic as generating
      const updatedRoadmap = (currentNoteState.roadmap || []).map((t, idx) =>
        idx === i ? { ...t, status: "generating" as const } : t
      );
      currentNoteState = { ...currentNoteState, roadmap: updatedRoadmap, generationStatus: "in_progress" };
      setNote(currentNoteState);

      try {
        // AI Request for 1 Topic with auto client retry
        let notesResult;
        let lastError: any = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            notesResult = await generateTopicNotes({
              subject: currentNoteState.subject,
              topicTitle: topic.title,
              topicDescription: topic.description,
              learnerLevel: currentNoteState.learnerLevel,
              complexity: currentNoteState.complexity,
              depth: currentNoteState.depth,
              language: currentNoteState.language,
              instructions: currentNoteState.instructions,
            });
            if (notesResult && Array.isArray(notesResult.blocks) && notesResult.blocks.length > 0) {
              lastError = null;
              break;
            }
          } catch (e: any) {
            lastError = e;
            if (attempt === 0 && !isCancelledRef.current) {
              console.warn(`[Auto-Retry] First attempt failed for topic "${topic.title}", retrying in 2.5s...`);
              await new Promise((resolve) => setTimeout(resolve, 2500));
            } else {
              throw e;
            }
          }
        }

        if (lastError) throw lastError;

        if (isCancelledRef.current) break;

        // Double check we got valid content blocks
        if (!notesResult || !Array.isArray(notesResult.blocks) || notesResult.blocks.length === 0) {
          throw new Error(`AI generated an empty response for topic "${topic.title}".`);
        }

        // Construct NoteSection
        const newSection: NoteSection = {
          id: `sec_${Date.now()}_${i}`,
          topicId: topic.id,
          title: topic.title,
          summary: notesResult.summary,
          blocks: (notesResult.blocks || []).map((b, bIdx) => ({
            ...b,
            id: `b_${Date.now()}_${bIdx}`,
          })),
        };

        // Update topic as completed and save incrementally!
        const completedRoadmap = (currentNoteState.roadmap || []).map((t, idx) =>
          idx === i ? { ...t, status: "completed" as const, errorMessage: undefined } : t
        );

        // Check if section already exists (replace or append)
        const currentSections = currentNoteState.sections || [];
        const secIdx = currentSections.findIndex((s) => s.topicId === topic.id);
        const updatedSections = [...currentSections];
        if (secIdx >= 0) {
          updatedSections[secIdx] = newSection;
        } else {
          updatedSections.push(newSection);
        }

        currentNoteState = {
          ...currentNoteState,
          roadmap: completedRoadmap,
          sections: updatedSections,
          updatedAt: new Date().toISOString(),
        };

        // CRITICAL: Save each successfully generated topic immediately!
        saveNote(currentNoteState);
        setNote(currentNoteState);

      } catch (err: any) {
        console.error(`Failed generating topic "${topic.title}":`, err);

        const failedRoadmap = (currentNoteState.roadmap || []).map((t, idx) =>
          idx === i ? { ...t, status: "failed" as const, errorMessage: err.message || "Generation error" } : t
        );

        currentNoteState = {
          ...currentNoteState,
          roadmap: failedRoadmap,
          generationStatus: "failed",
        };

        saveNote(currentNoteState);
        setNote(currentNoteState);
        setErrorMessage(`Generation stopped on Topic ${i + 1} ("${topic.title}"): ${err.message || "API error"}`);
        setFailedTopicIndex(i);
        setIsGenerating(false);
        return;
      }
    }

    if (!isCancelledRef.current) {
      const allDone = (currentNoteState.roadmap || []).every(
        (t) => t.status === "completed" || t.status === "skipped"
      );
      currentNoteState.generationStatus = allDone ? "completed" : "idle";
      saveNote(currentNoteState);
      setNote(currentNoteState);
      setIsGenerating(false);
    }
  };

  const retryTopic = (index: number) => {
    const resetRoadmap = (note.roadmap || []).map((t, idx) =>
      idx === index ? { ...t, status: "pending" as const, errorMessage: undefined } : t
    );
    const updated = { ...note, roadmap: resetRoadmap };
    setNote(updated);
    saveNote(updated);
    setTimeout(() => {
      startOrResumeGeneration();
    }, 100);
  };

  const skipTopic = (index: number) => {
    const updatedRoadmap = (note.roadmap || []).map((t, idx) =>
      idx === index ? { ...t, status: "skipped" as const, errorMessage: undefined } : t
    );
    const updated = { ...note, roadmap: updatedRoadmap };
    setNote(updated);
    saveNote(updated);
    setErrorMessage(null);
    setFailedTopicIndex(null);

    setTimeout(() => {
      startOrResumeGeneration();
    }, 100);
  };

  const skipAllFailed = () => {
    const updatedRoadmap = (note.roadmap || []).map((t) =>
      t.status === "failed" ? { ...t, status: "skipped" as const, errorMessage: undefined } : t
    );
    const updated = { ...note, roadmap: updatedRoadmap };
    setNote(updated);
    saveNote(updated);
    setErrorMessage(null);
    setFailedTopicIndex(null);

    setTimeout(() => {
      startOrResumeGeneration();
    }, 100);
  };

  const completedCount = (note.roadmap || []).filter((t) => t.status === "completed").length;
  const skippedCount = (note.roadmap || []).filter((t) => t.status === "skipped").length;
  const totalCount = (note.roadmap || []).length;
  const processedCount = completedCount + skippedCount;
  const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;
  const isAllFinished = processedCount === totalCount;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-lg max-w-4xl mx-auto my-6 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
              {isAllFinished ? "Generation Complete" : "Generating Note"}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-light">
              {completedCount} Saved {skippedCount > 0 && `(${skippedCount} Skipped)`} / {totalCount} Topics
            </span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            {note.title}
          </h2>
        </div>

        {/* Action Button */}
        <div>
          {isAllFinished || completedCount > 0 ? (
            <button
              type="button"
              onClick={() => onComplete(note)}
              className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs shadow-md flex items-center space-x-2 transition-all"
            >
              <span>Open Note Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Pause & View Saved Notes
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <span>Overall Progress ({processedCount} of {totalCount} Topics)</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-200 dark:border-zinc-700">
          <div
            className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Error Alert Box with Immediate Action Options */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 space-y-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs space-y-1">
              <p className="font-semibold text-sm">{errorMessage}</p>
              <p className="text-red-700 dark:text-red-300 font-light">
                This topic failed to generate. Successfully generated topics have been saved safely. Choose an action below:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-200 dark:border-red-900/40">
            {failedTopicIndex !== null && (
              <>
                <button
                  type="button"
                  onClick={() => retryTopic(failedTopicIndex)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Topic {failedTopicIndex + 1}</span>
                </button>

                <button
                  type="button"
                  onClick={() => skipTopic(failedTopicIndex)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-200 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-xs"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Skip This Topic</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={skipAllFailed}
              className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-medium flex items-center space-x-1.5 transition-colors"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Skip All Failed & Continue</span>
            </button>
          </div>
        </div>
      )}

      {/* Topic Status Cards */}
      <motion.div
        variants={staggerContainer(0.04)}
        initial="hidden"
        animate="show"
        className="space-y-3 max-h-[360px] overflow-y-auto pr-2"
      >
        {(note.roadmap || []).map((topic, index) => (
          <motion.div
            key={topic.id}
            layout
            variants={fadeInUp}
            transition={{ layout: { duration: 0.2, ease: "easeOut" } }}
            className={`p-3.5 rounded-2xl border flex items-center justify-between transition-colors ${
              topic.status === "completed"
                ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-700"
                : topic.status === "generating"
                ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600 ring-1 ring-zinc-400"
                : topic.status === "failed"
                ? "bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
                : topic.status === "skipped"
                ? "bg-zinc-100/70 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 opacity-75"
                : "bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-center space-x-3">
              {topic.status === "completed" && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              )}
              {topic.status === "generating" && (
                <Loader2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100 animate-spin shrink-0" />
              )}
              {topic.status === "failed" && (
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              )}
              {topic.status === "skipped" && (
                <SkipForward className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
              )}
              {topic.status === "pending" && (
                <div className="w-5 h-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600 shrink-0" />
              )}

              <div>
                <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
                  <span>Topic {index + 1}: {topic.title}</span>
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light line-clamp-1">
                  {topic.description}
                </p>
                {topic.errorMessage && topic.status === "failed" && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-0.5">
                    Error: {topic.errorMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Status label / Controls */}
            <div className="shrink-0 ml-3 flex items-center space-x-2">
              {topic.status === "completed" && (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900">
                  Saved ✓
                </span>
              )}
              {topic.status === "generating" && (
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse">
                  Generating...
                </span>
              )}
              {topic.status === "failed" && (
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => retryTopic(index)}
                    className="px-2.5 py-1 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white text-xs font-medium flex items-center space-x-1 transition-colors shadow-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => skipTopic(index)}
                    className="px-2.5 py-1 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-medium flex items-center space-x-1 transition-colors"
                  >
                    <SkipForward className="w-3 h-3" />
                    <span>Skip</span>
                  </button>
                </div>
              )}
              {topic.status === "skipped" && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800">
                    Skipped
                  </span>
                  <button
                    type="button"
                    onClick={() => retryTopic(index)}
                    className="px-2 py-0.5 rounded text-xs text-zinc-700 dark:text-zinc-300 hover:underline font-medium"
                  >
                    Generate
                  </button>
                </div>
              )}
              {topic.status === "pending" && (
                <span className="text-xs font-light text-zinc-400 dark:text-zinc-500">
                  Queued
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Incremental Protection Notice */}
      <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 font-light">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-zinc-800 dark:text-zinc-200" />
          <span>Incremental Auto-Save: Completed topics are immediately stored. Failed topics can be retried or skipped anytime.</span>
        </div>
      </div>
    </div>
  );
};
