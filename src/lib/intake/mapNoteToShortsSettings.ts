import { NoteDocument } from "../../types";
import {
  mapDepthToTreeDepth,
  mapComplexityToDifficulty,
  mapNoteLanguageToShortsLanguage,
  ShortsSettings,
} from "./mapToShortsSettings";

// One-time prefill only — nothing is persisted back to the note or the resulting learning tree.
// Uses the note's own generation settings where they exist; `instructions` is the only field on
// NoteDocument that's actually optional among the ones read here, so it's the only one that needs
// a fallback — synthesized from the note's title and topic list instead.
export function mapNoteToShortsSettings(note: NoteDocument): ShortsSettings {
  const fallbackTopics = note.roadmap.slice(0, 3).map((t) => t.title);
  const topicDescription =
    note.instructions?.trim() ||
    (fallbackTopics.length > 0 ? `Based on note "${note.title}": ${fallbackTopics.join(", ")}` : `Based on note "${note.title}"`);

  return {
    mainTopic: note.subject,
    topicDescription,
    depth: mapDepthToTreeDepth(note.depth),
    language: mapNoteLanguageToShortsLanguage(note.language),
    difficulty: mapComplexityToDifficulty(note.complexity),
  };
}
