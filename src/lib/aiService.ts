import { getAISettings, incrementAIRequestCount } from "./storage";
import { LearnerLevel, Complexity, Depth, NoteLanguage, QuestionType, Question, PodcastTurn } from "../types";
import { AssembledSource } from "./intake/assemble";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const settings = getAISettings();
  if (settings.mode === "byok" && settings.userApiKey?.trim()) {
    headers["x-user-api-key"] = settings.userApiKey.trim();
  }
  return headers;
}

export async function testApiKey(userApiKey?: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch("/api/ai/test-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userApiKey }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

export async function generateRoadmap(params: {
  subject: string;
  mainTopic?: string;
  learnerLevel: LearnerLevel;
  complexity: Complexity;
  depth: Depth;
  language: NoteLanguage;
  instructions?: string;
}) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/roadmap", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to generate study roadmap");
  }
  return data.roadmap as { title: string; description: string; estimatedMinutes?: number }[];
}

export interface IntakeBrief {
  subject: string;
  mainTopic?: string;
  learnerLevel: LearnerLevel;
  complexity: Complexity;
  depth: Depth;
  language: NoteLanguage;
  instructions: string;
  topics: { title: string; description: string; estimatedMinutes?: number }[];
  confidence: number;
  clarifyingQuestions: string[];
}

// The single LLM call in the Knowledge Intake pipeline. Everything upstream (extraction,
// chunking, BM25 retrieval, confidence scoring) is deterministic and already done client-side by
// the time this is called — `sources` here is already the token-budgeted, retrieval-filtered
// context, not raw source dumps.
export async function generateIntakeBrief(params: {
  prompt: string;
  sources: AssembledSource[];
  learnerLevel?: LearnerLevel;
  complexity?: Complexity;
  depth?: Depth;
  language?: NoteLanguage;
  priorQuestions?: string[];
  priorAnswers?: string[];
}) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/intake-brief", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to analyze your request and sources");
  }
  return data.brief as IntakeBrief;
}

export async function suggestTopics(subject: string, existingTopics: string[]) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/suggest-topics", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject, existingTopics }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to suggest topics");
  }
  return data.suggestedTopics as { title: string; description: string; estimatedMinutes?: number }[];
}

export async function generateTopicNotes(params: {
  subject: string;
  topicTitle: string;
  topicDescription?: string;
  learnerLevel: LearnerLevel;
  complexity: Complexity;
  depth: Depth;
  language: NoteLanguage;
  instructions?: string;
}) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/topic-notes", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || `Failed to generate notes for "${params.topicTitle}"`);
  }
  if (!data.notes || !Array.isArray(data.notes.blocks) || data.notes.blocks.length === 0) {
    throw new Error(`AI generated empty content for "${params.topicTitle}". You can retry or skip this topic.`);
  }
  return data.notes as { summary: string; blocks: any[] };
}

export async function selectionAction(params: {
  action: string;
  selectedText: string;
  contextTopic?: string;
  language?: string;
  userPrompt?: string;
}) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/selection-action", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "AI action failed");
  }
  return data.result as string;
}

export async function generateTestQuestions(params: {
  subject: string;
  topics: { id: string; title: string }[];
  questionCount: number;
  difficulty: Complexity;
  questionTypes: QuestionType[];
  contentContext?: string;
}) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/generate-test", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to generate test questions");
  }
  return data.questions as Question[];
}

export async function generateBatchedTestQuestions(
  params: {
    subject: string;
    topics: { id: string; title: string }[];
    questionCount: number;
    difficulty: Complexity;
    questionTypes: QuestionType[];
    contentContext?: string;
  },
  onBatchProgress?: (batchIndex: number, totalBatches: number, newQuestions: Question[]) => void
): Promise<Question[]> {
  const BATCH_SIZE = 10;
  const totalCount = params.questionCount || 10;
  const numBatches = Math.ceil(totalCount / BATCH_SIZE);
  const allQuestions: Question[] = [];

  for (let batch = 0; batch < numBatches; batch++) {
    const currentBatchCount = Math.min(BATCH_SIZE, totalCount - batch * BATCH_SIZE);

    const batchQuestions = await generateTestQuestions({
      subject: params.subject,
      topics: params.topics,
      questionCount: currentBatchCount,
      difficulty: params.difficulty,
      questionTypes: params.questionTypes,
      contentContext: params.contentContext,
    });

    const mapped = (batchQuestions || []).map((q, idx) => ({
      ...q,
      id: q.id || `q_${Date.now()}_b${batch}_${idx}`,
      orderIndex: batch * BATCH_SIZE + idx,
    }));

    allQuestions.push(...mapped);

    if (onBatchProgress) {
      onBatchProgress(batch + 1, numBatches, mapped);
    }
  }

  return allQuestions;
}

export async function generateRevisionPlan(subject: string, weakTopics: string[]) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/revision-plan", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject, weakTopics }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to generate revision plan");
  }
  return data.revisionPlan;
}

export async function evaluateTeachBack(topicTitle: string, userExplanation: string) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/teach-back", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ topicTitle, userExplanation }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Teach-back evaluation failed");
  }
  return data.evaluation;
}

export async function generatePodcastScript(noteTitle: string, topicTitle: string, textContent: string) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/podcast-script", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ noteTitle, topicTitle, textContent }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Podcast script generation failed");
  }
  return data.dialogue as PodcastTurn[];
}

export async function generateFlashcards(params: {
  topic: string;
  content?: string;
  count?: number;
  difficulty?: string;
  focus?: string;
  language?: string;
}) {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/generate-flashcards", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Flashcard generation failed");
  }
  return data.cards as {
    front: string;
    back: string;
    explanation?: string;
    example?: string;
    hint?: string;
  }[];
}
