export type LearnerLevel = 
  | 'School'
  | 'Diploma'
  | 'Undergraduate'
  | 'Postgraduate'
  | 'Professional'
  | 'General learner';

export type Complexity = 'Beginner' | 'Easy' | 'Medium' | 'Advanced' | 'Expert';

export type Depth = 'Quick revision' | 'Standard notes' | 'Detailed notes' | 'Exam preparation';

export type NoteLanguage = 'English' | 'Hindi' | 'Gujarati' | 'Spanish' | 'French' | 'German' | 'Other';

export interface RoadmapTopic {
  id: string;
  title: string;
  description: string;
  estimatedMinutes?: number;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'skipped';
  errorMessage?: string;
}

export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'checklist'
  | 'quote'
  | 'callout'
  | 'code'
  | 'table'
  | 'student_tag'
  | 'image_gallery';

export interface NoteBlockImage {
  url: string;
  thumbnailUrl?: string;
  title?: string;
  sourceUrl?: string; // page the image was found on, for attribution/click-through
}

export type StudentTagType = 'important' | 'remember' | 'doubt' | 'example' | 'exam_point';

export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  level?: 1 | 2 | 3; // for headings
  items?: string[]; // for lists
  checkedItems?: boolean[]; // for checklists
  tagType?: StudentTagType;
  tableData?: string[][]; // for tables
  language?: string; // for code blocks
  images?: NoteBlockImage[]; // for image_gallery — reference images/diagrams for the topic
}

export interface NoteSection {
  id: string;
  topicId: string;
  title: string;
  summary?: string;
  blocks: NoteBlock[];
  userAnnotations?: string[];
}

export interface NoteVersion {
  id: string;
  title: string;
  timestamp: string;
  createdBy: 'ai' | 'user';
  sections: NoteSection[];
}

export interface Collection {
  id: string;
  ownerId: string;
  parentCollectionId: string | null;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  explanation?: string;
  example?: string;
  hint?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  timesSeen?: number;
  timesCorrect?: number;
  difficultyRating?: 'again' | 'hard' | 'good' | 'easy';
  lastStudiedAt?: string;
  nextReviewAt?: string;
  intervalDays?: number;
  easeFactor?: number;
}

export interface FlashcardDeck {
  id: string;
  ownerId: string;
  collectionId?: string | null;
  title: string;
  description?: string;
  subject: string;
  topic?: string;
  language?: NoteLanguage;
  createdAt: string;
  updatedAt: string;
  sourceNoteId?: string;
  sourceSectionId?: string;
  cardCount?: number;
}

export interface NoteDocument {
  id: string;
  title: string;
  subject: string;
  learnerLevel: LearnerLevel;
  complexity: Complexity;
  depth: Depth;
  language: NoteLanguage;
  instructions?: string;
  roadmap: RoadmapTopic[];
  sections: NoteSection[];
  versions: NoteVersion[];
  createdAt: string;
  updatedAt: string;
  authorId: string;
  authorName: string;
  batchSize?: number; // default 1
  isCommunityPublished?: boolean;
  communityId?: string;
  remixFromId?: string;
  remixAuthor?: string;
  generationStatus: 'idle' | 'in_progress' | 'completed' | 'failed';
  favorite?: boolean;
  collectionId?: string | null;
}

export type QuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'one_word';

export interface Question {
  id: string;
  topicId: string;
  topicTitle: string;
  type: QuestionType;
  question: string;
  options?: string[]; // for mcq
  correctAnswer: string; // for mcq (A/B/C/D), true_false (True/False), fill_blank, one_word
  explanation: string;
  sourceNoteId?: string;
  difficulty?: Complexity;
  orderIndex?: number;
}

export type TestSourceType = 'note' | 'notes' | 'collection' | 'flashcard_deck' | 'topic' | 'custom' | 'weakness_retest';

export interface TestConfig {
  id: string;
  title?: string;
  subject: string;
  sourceType?: TestSourceType;
  noteId?: string;
  noteIds?: string[];
  collectionId?: string | null;
  includeSubcollections?: boolean;
  deckId?: string;
  selectedTopicIds: string[];
  questionCount: number;
  difficulty: Complexity;
  questionTypes: QuestionType[];
  timeLimitMinutes: number;
  randomizeQuestions?: boolean;
  randomizeOptions?: boolean;
  showExplanations?: boolean;
}

export interface SavedTest {
  id: string;
  title?: string;
  noteId?: string;
  collectionId?: string | null;
  deckId?: string;
  noteTitle: string;
  subject: string;
  createdAt: string;
  updatedAt?: string;
  config: TestConfig;
  questions: Question[];
  lastScore?: number;
  lastPercentage?: number;
  attemptsCount?: number;
  status?: 'draft' | 'ready';
}

export interface TestAttempt {
  id: string;
  testConfigId: string;
  savedTestId?: string;
  subject: string;
  noteTitle?: string;
  questions: Question[];
  userAnswers: Record<string, string>;
  markedForReview: string[];
  timeSpentSeconds: number;
  focusViolations: number;
  score: number;
  total: number;
  percentage: number;
  topicScores: Record<string, { correct: number; total: number; title: string }>;
  weakTopicIds: string[];
  weakTopicTitles: string[];
  completedAt: string;
  revisionPlan?: RevisionPlan;
  previousAttemptId?: string;
  originalAttemptId?: string;
  improvementPercentagePoints?: number;
}

export interface RevisionPlan {
  id?: string;
  ownerId?: string;
  topicTitle: string;
  subject?: string;
  summary5Min: string;
  keyConcepts: string[];
  commonMistakes?: string[];
  examples: string[];
  examExplanation?: string;
  practiceQuestions: { question: string; answer: string }[];
  createdAt?: string;
}

export interface WeakTopicStat {
  topicId: string;
  topicTitle: string;
  subject: string;
  attemptsCount: number;
  totalQuestions: number;
  totalCorrect: number;
  currentAccuracy: number; // percentage
  status: 'weak' | 'needs_review' | 'improving' | 'mastered';
  history: { attemptId: string; date: string; accuracy: number }[];
  lastTestedAt: string;
}

export interface TeachBackEvaluation {
  id: string;
  ownerId?: string;
  topicTitle: string;
  userExplanation: string;
  understandingPercent: number;
  understoodPoints: string[];
  missingPoints: string[];
  incorrectPoints: string[];
  studyRecommendation: string;
  createdAt: string;
}

export interface PodcastTurn {
  speaker: string;
  text: string;
}

export interface PodcastEpisode {
  id: string;
  ownerId?: string;
  noteId: string;
  noteTitle: string;
  dialogue: PodcastTurn[];
  createdAt: string;
  updatedAt: string;
}

export type CommunityResourceType = 'note' | 'flashcard_deck' | 'collection';

export interface CommunityNote {
  id: string;
  noteId?: string;
  resourceType?: CommunityResourceType;
  title: string;
  subject: string;
  mainTopic: string;
  description: string;
  language: NoteLanguage;
  difficulty: Complexity;
  authorName: string;
  authorId: string;
  createdAt: string;
  remixCount: number;
  likesCount: number;
  userLiked?: boolean;
  sourceType: 'My own notes' | 'Public domain' | 'Open educational resource' | 'Permission granted' | 'Reference material';
  sourceNotice?: string;
  validationStatus: 'approved' | 'pending' | 'needs_review';
  lineage?: { id: string; title: string; authorName: string; date?: string }[];
  reported?: boolean;
  reportReason?: string;
  content?: NoteDocument;
  deckContent?: {
    deck: FlashcardDeck;
    cards: Flashcard[];
  };
  collectionContent?: {
    collection: Collection;
    notes: NoteDocument[];
    decks: { deck: FlashcardDeck; cards: Flashcard[] }[];
  };
}

export interface AISettings {
  mode: 'default' | 'byok';
  userApiKey?: string;
  aiRequestsCount: number;
}

export interface PodcastScript {
  id: string;
  noteTitle: string;
  topicTitle: string;
  dialogue: { speaker: 'Alex (Host)' | 'Sam (Expert)'; text: string }[];
}

export type TopicHubResourceType = 'note' | 'flashcard_deck' | 'test';

export interface TopicHubResource {
  id: string;
  topicHubId: string;
  resourceType: TopicHubResourceType;
  resourceId: string;
  displayOrder: number;
  title: string;
  description?: string;
  isFeatured?: boolean;
  createdAt: string;
  // Snapshotted contents for viewing or studying:
  noteContent?: NoteDocument;
  deckContent?: {
    deck: FlashcardDeck;
    cards: Flashcard[];
  };
  testContent?: SavedTest;
}

export interface CommunityTopicHub {
  id: string;
  title: string;
  slug?: string;
  description: string;
  subject: string;
  topic?: string;
  subtopic?: string;
  language: NoteLanguage;
  difficulty: Complexity;
  coverImage?: string;
  creatorId: string;
  creatorName: string;
  status: 'published' | 'draft' | 'archived' | 'pending';
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
  savesCount: number;
  remixesCount: number;
  learningPath?: {
    stepIndex: number;
    title: string;
    description?: string;
    resourceType: TopicHubResourceType;
    resourceId: string;
  }[];
  // Lineage & Versioning
  originalHubId?: string;
  parentHubId?: string;
  rootHubId?: string;
  remixAuthor?: string;
  lineage?: { id: string; title: string; authorName: string; date?: string }[];
  version?: number;
  // Resources array
  resources: TopicHubResource[];
  stats?: {
    notesCount: number;
    decksCount: number;
    testsCount: number;
    estimatedStudyMinutes?: number;
  };
  userSaved?: boolean;
}

export interface SavedTopicHubRef {
  id: string;
  userId: string;
  topicHubId: string;
  savedAt: string;
  topicHubData?: CommunityTopicHub;
}

// ==========================================
// SHORTS LEARNING TYPES
// ==========================================

export type LearningContentProvider = 'youtube' | 'instagram' | 'pinterest' | 'other';

export interface LearningContent {
  id: string;
  provider: LearningContentProvider;
  providerContentId: string; // e.g., YouTube video ID
  title: string;
  description: string;
  thumbnailUrl: string;
  channelName: string;
  duration: string; // e.g., "04:12" or "10:30"
  durationSeconds: number; // e.g., 252 or 630
  publishedAt?: string;
  url: string;
  matchedKeyword: string;
  topicId?: string;
  language?: string;
  contentType?: string;
}

export interface LearningNode {
  id: string;
  treeId?: string;
  parentId?: string | null;
  title: string;
  description: string;
  keywords: string[];
  depth: number;
  order: number;
  skipped?: boolean; // permanently skipped
  skippedForSession?: boolean; // skipped for current session
  createdAt?: string;
  updatedAt?: string;
  children?: LearningNode[];
}

export interface LearningTree {
  id: string;
  userId: string;
  rootTopicId: string;
  title: string;
  subject: string;
  depth: number;
  nodes: LearningNode[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningSessionFilter {
  language: 'English' | 'Hindi' | 'Gujarati' | 'Hinglish' | 'Any';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Mixed';
  duration: '< 1 min' | '1–3 min' | '3–5 min' | '5–10 min' | 'Any';
  content:
    | 'Explanation'
    | 'Tutorial'
    | 'Visual'
    | 'Example'
    | 'Revision'
    | 'Exam preparation'
    | 'Project/application'
    | 'Any';
  freshness: 'Any' | 'Last 7 days' | 'Last 30 days' | 'Last year' | 'Custom';
  // 'short' = only short-form videos (<= shortsMaxDurationSeconds); 'long' = only regular-length
  // videos (excludes short-form); 'hybrid' = mix of both, no restriction. Defaults to 'long'.
  contentFormat?: 'short' | 'long' | 'hybrid';
  shortsMaxDurationSeconds?: number; // cutoff used to classify "short-form"; default 60
}

export interface LearningSession {
  id: string;
  userId: string;
  treeId: string;
  topicTitle: string;
  subject: string;
  timeLimitMinutes: number; // 5, 10, 15, 20, 30, 45, 60, or custom
  startedAt: string;
  endedAt?: string;
  currentNodeId: string;
  visitedNodeIds: string[];
  skippedNodeIds: string[]; // skipped during this session
  completedNodeIds: string[];
  savedResourceIds: string[];
  filters: LearningSessionFilter;
}

export interface SavedLearningResource {
  id: string;
  userId: string;
  topicId: string; // subject/topic
  learningNodeId: string;
  learningNodeTitle: string;
  provider: LearningContentProvider;
  providerContentId: string;
  url: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  duration: string;
  metadata?: any;
  savedAt: string;
  userNotes?: string;
  timestampNotes?: { time: string; note: string }[];
}

// ==========================================
// KNOWLEDGE INTAKE PIPELINE
// ==========================================

export type KnowledgeSourceType = 'pdf' | 'web' | 'youtube' | 'text';

// A user-saved reference to a source they fed into the Knowledge Intake wizard, so it can be
// reused in a future intake session without re-uploading/re-fetching. Only the compressed brief
// is persisted — never the raw extracted text — to stay well under Firestore's 1MB document
// limit and because the brief is what generation actually consumes.
export interface KnowledgeSource {
  id: string;
  ownerId?: string;
  sourceType: KnowledgeSourceType;
  title: string;
  originUrl?: string; // for 'web' / 'youtube'
  fileName?: string; // for 'pdf'
  brief: string; // AI-generated summary of the source (generated once, at save time)
  keyPoints?: string[]; // short key-point bullets from the same summary call
  wordCount: number; // of the original extracted text, before summarization
  contentHash: string; // hash of normalized extracted text, for de-dup on re-import
  createdAt: string;
  updatedAt: string;
}

// The output of the single intake-brief LLM call — subject/level/etc, the compressed generation
// brief, and the topic list it implies — saved on its own so a user who doesn't want to proceed
// to a full roadmap/note yet still keeps what they already paid tokens to generate. Resuming one
// re-enters the wizard's result step directly, with no new AI call.
export interface IntakeSummary {
  id: string;
  ownerId?: string;
  subject: string;
  mainTopic?: string;
  learnerLevel: LearnerLevel;
  complexity: Complexity;
  depth: Depth;
  language: NoteLanguage;
  summary: string; // the compressed brief (IntakeBrief.instructions)
  topics: { title: string; description: string; estimatedMinutes?: number }[];
  confidence: number;
  sourceTitles: string[]; // titles of the sources that contributed, for context only
  prompt?: string; // the user's original natural-language request, if any
  createdAt: string;
  updatedAt: string;
}

