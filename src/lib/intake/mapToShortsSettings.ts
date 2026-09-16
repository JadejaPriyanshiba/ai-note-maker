import { Complexity, Depth, NoteLanguage } from "../../types";
import { IntakeBrief } from "../aiService";

// Shorts Hub only offers these four languages in its picker today; anything else falls back to
// English for the dropdown while the AI still sees the real request/instructions text.
const SHORTS_LANGUAGES = ["English", "Hindi", "Gujarati", "Hinglish"];

export function mapDepthToTreeDepth(depth: Depth): number {
  switch (depth) {
    case "Quick revision":
      return 2;
    case "Exam preparation":
      return 4;
    case "Standard notes":
    case "Detailed notes":
    default:
      return 3;
  }
}

export function mapComplexityToDifficulty(complexity: Complexity): string {
  switch (complexity) {
    case "Beginner":
    case "Easy":
      return "Beginner";
    case "Medium":
      return "Intermediate";
    case "Advanced":
    case "Expert":
      return "Advanced";
    default:
      return "Mixed";
  }
}

export function mapNoteLanguageToShortsLanguage(language: NoteLanguage | string): string {
  return SHORTS_LANGUAGES.includes(language) ? language : "English";
}

export interface ShortsSettings {
  mainTopic: string;
  topicDescription: string;
  depth: number;
  language: string;
  difficulty: string;
}

export function mapBriefToShortsSettings(brief: IntakeBrief): ShortsSettings {
  return {
    mainTopic: brief.subject,
    topicDescription: brief.instructions,
    depth: mapDepthToTreeDepth(brief.depth),
    language: mapNoteLanguageToShortsLanguage(brief.language),
    difficulty: mapComplexityToDifficulty(brief.complexity),
  };
}
