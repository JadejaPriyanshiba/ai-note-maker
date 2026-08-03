import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { NoteDocument, NoteSection } from "../types";
import { generateTopicNotes } from "./aiService";
import { saveNote } from "./storage";

export interface GenerationState {
  note: NoteDocument;
  batchSize: number;
  isGenerating: boolean;
  errorMessage: string | null;
  failedTopicIndex: number | null;
}

interface GenerationContextType {
  activeGeneration: GenerationState | null;
  startGeneration: (note: NoteDocument, batchSize: number) => void;
  retryTopic: (index: number) => void;
  skipTopic: (index: number) => void;
  skipAllFailed: () => void;
}

const GenerationContext = createContext<GenerationContextType>({
  activeGeneration: null,
  startGeneration: () => {},
  retryTopic: () => {},
  skipTopic: () => {},
  skipAllFailed: () => {},
});

// Owns the topic-by-topic note generation loop at the app root (see main.tsx), so it keeps
// running in the background across view navigation instead of being torn down whenever the
// GenerationProgress screen unmounts. GenerationProgress and the global status toast both just
// read/drive this shared state.
export const GenerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeGeneration, setActiveGeneration] = useState<GenerationState | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const loopActiveRef = useRef<boolean>(false);

  const runLoop = useCallback(async (startNote: NoteDocument, batchSize: number) => {
    loopActiveRef.current = true;
    isCancelledRef.current = false;

    let currentNoteState = { ...startNote, sections: startNote.sections || [] };
    const pendingTopics = currentNoteState.roadmap || [];

    setActiveGeneration({ note: currentNoteState, batchSize, isGenerating: true, errorMessage: null, failedTopicIndex: null });

    for (let i = 0; i < pendingTopics.length; i++) {
      if (isCancelledRef.current) break;

      const topic = pendingTopics[i];
      if (topic.status === "completed" || topic.status === "skipped") continue;

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const generatingRoadmap = (currentNoteState.roadmap || []).map((t, idx) =>
        idx === i ? { ...t, status: "generating" as const } : t
      );
      currentNoteState = { ...currentNoteState, roadmap: generatingRoadmap, generationStatus: "in_progress" };
      setActiveGeneration((prev) => (prev ? { ...prev, note: currentNoteState } : prev));

      try {
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

        if (!notesResult || !Array.isArray(notesResult.blocks) || notesResult.blocks.length === 0) {
          throw new Error(`AI generated an empty response for topic "${topic.title}".`);
        }

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

        const completedRoadmap = (currentNoteState.roadmap || []).map((t, idx) =>
          idx === i ? { ...t, status: "completed" as const, errorMessage: undefined } : t
        );

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

        // Incremental auto-save — safe even if the user navigates away mid-loop.
        saveNote(currentNoteState);
        setActiveGeneration((prev) => (prev ? { ...prev, note: currentNoteState } : prev));
      } catch (err: any) {
        console.error(`Failed generating topic "${topic.title}":`, err);

        const failedRoadmap = (currentNoteState.roadmap || []).map((t, idx) =>
          idx === i ? { ...t, status: "failed" as const, errorMessage: err.message || "Generation error" } : t
        );

        currentNoteState = { ...currentNoteState, roadmap: failedRoadmap, generationStatus: "failed" };
        saveNote(currentNoteState);
        setActiveGeneration({
          note: currentNoteState,
          batchSize,
          isGenerating: false,
          errorMessage: `Generation stopped on Topic ${i + 1} ("${topic.title}"): ${err.message || "API error"}`,
          failedTopicIndex: i,
        });
        loopActiveRef.current = false;
        return;
      }
    }

    loopActiveRef.current = false;

    if (!isCancelledRef.current) {
      const allDone = (currentNoteState.roadmap || []).every(
        (t) => t.status === "completed" || t.status === "skipped"
      );
      currentNoteState.generationStatus = allDone ? "completed" : "idle";
      saveNote(currentNoteState);
      setActiveGeneration({ note: currentNoteState, batchSize, isGenerating: false, errorMessage: null, failedTopicIndex: null });
    }
  }, []);

  const startGeneration = useCallback(
    (note: NoteDocument, batchSize: number) => {
      // Already actively generating (this note or another) — never run two loops at once.
      if (loopActiveRef.current) return;
      runLoop(note, batchSize);
    },
    [runLoop]
  );

  const retryTopic = useCallback(
    (index: number) => {
      setActiveGeneration((prev) => {
        if (!prev) return prev;
        const resetRoadmap = (prev.note.roadmap || []).map((t, idx) =>
          idx === index ? { ...t, status: "pending" as const, errorMessage: undefined } : t
        );
        const updated = { ...prev.note, roadmap: resetRoadmap };
        saveNote(updated);
        setTimeout(() => runLoop(updated, prev.batchSize), 100);
        return { ...prev, note: updated, errorMessage: null, failedTopicIndex: null };
      });
    },
    [runLoop]
  );

  const skipTopic = useCallback(
    (index: number) => {
      setActiveGeneration((prev) => {
        if (!prev) return prev;
        const updatedRoadmap = (prev.note.roadmap || []).map((t, idx) =>
          idx === index ? { ...t, status: "skipped" as const, errorMessage: undefined } : t
        );
        const updated = { ...prev.note, roadmap: updatedRoadmap };
        saveNote(updated);
        setTimeout(() => runLoop(updated, prev.batchSize), 100);
        return { ...prev, note: updated, errorMessage: null, failedTopicIndex: null };
      });
    },
    [runLoop]
  );

  const skipAllFailed = useCallback(() => {
    setActiveGeneration((prev) => {
      if (!prev) return prev;
      const updatedRoadmap = (prev.note.roadmap || []).map((t) =>
        t.status === "failed" ? { ...t, status: "skipped" as const, errorMessage: undefined } : t
      );
      const updated = { ...prev.note, roadmap: updatedRoadmap };
      saveNote(updated);
      setTimeout(() => runLoop(updated, prev.batchSize), 100);
      return { ...prev, note: updated, errorMessage: null, failedTopicIndex: null };
    });
  }, [runLoop]);

  return (
    <GenerationContext.Provider value={{ activeGeneration, startGeneration, retryTopic, skipTopic, skipAllFailed }}>
      {children}
    </GenerationContext.Provider>
  );
};

export const useGeneration = () => useContext(GenerationContext);
