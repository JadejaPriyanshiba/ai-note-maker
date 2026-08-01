import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { NotesListView } from "./components/NotesListView";
import { RoadmapEditor } from "./components/RoadmapEditor";
import { GenerationProgress } from "./components/GenerationProgress";
import { NoteStudio } from "./components/NoteStudio/NoteStudio";
import { AudioLearningView } from "./components/AudioPlayer/AudioLearningView";
import { TestGenerator } from "./components/Assessment/TestGenerator";
import { TestRunner } from "./components/Assessment/TestRunner";
import { TestResultsView } from "./components/Assessment/TestResultsView";
import { TeachBackView } from "./components/Assessment/TeachBackView";
import { CommunityView } from "./components/Community/CommunityView";
import { SettingsView } from "./components/Settings/SettingsView";
import { CollectionsView } from "./components/Collections/CollectionsView";
import { FlashcardHubView } from "./components/Flashcards/FlashcardHubView";
import { FlashcardEditorView } from "./components/Flashcards/FlashcardEditorView";
import { FlashcardStudyView } from "./components/Flashcards/FlashcardStudyView";
import { AIFlashcardGeneratorModal } from "./components/Flashcards/AIFlashcardGeneratorModal";
import { AuthModal } from "./components/Auth/AuthModal";
import { DataMigrationModal } from "./components/Auth/DataMigrationModal";
import { useAuth } from "./lib/AuthContext";
import { ShortsSetupView } from "./components/ShortsLearning/ShortsSetupView";
import { LearningMapView } from "./components/ShortsLearning/LearningMapView";
import { ShortsFeedView } from "./components/ShortsLearning/ShortsFeedView";
import { RevisionFeedView } from "./components/ShortsLearning/RevisionFeedView";

import {
  NoteDocument,
  RoadmapTopic,
  LearnerLevel,
  Complexity,
  Depth,
  NoteLanguage,
  TestConfig,
  Question,
  TestAttempt,
  SavedTest,
  FlashcardDeck,
  Flashcard,
  LearningTree,
  LearningSession,
  LearningSessionFilter,
  SavedLearningResource,
} from "./types";
import {
  saveNote,
  getSavedNotes,
  saveSavedTest,
  getSavedTestsList,
  saveTestAttempt,
  getFlashcards,
  getDueFlashcards,
  saveFlashcardDeck,
  syncAllCloudDataToLocal,
  fetchPublicCommunityCloudData,
  getActiveLearningSession,
  saveLearningSession,
} from "./lib/storage";
import { generateBatchedTestQuestions } from "./lib/aiService";

export default function App() {
  const { user, setSyncing } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("app_theme");
    if (saved === "dark" || saved === "light") return saved;
    return "light";
  });
  const [activeView, setActiveView] = useState<
    | "home"
    | "collections"
    | "notes_list"
    | "roadmap_editor"
    | "generation_progress"
    | "note_studio"
    | "audio_learning"
    | "flashcards"
    | "flashcard_editor"
    | "flashcard_study"
    | "test_generator"
    | "test_runner"
    | "test_results"
    | "teach_back"
    | "community"
    | "settings"
    | "shorts_setup"
    | "shorts_map"
    | "shorts_feed"
    | "shorts_revision"
  >("home");

  const [activeNote, setActiveNote] = useState<NoteDocument | null>(null);
  const [isNoteReadOnly, setIsNoteReadOnly] = useState<boolean>(false);
  const [batchSize, setBatchSize] = useState<number>(1);

  // Shorts Learning state
  const [activeLearningTree, setActiveLearningTree] = useState<LearningTree | null>(null);
  const [activeLearningSession, setActiveLearningSession] = useState<LearningSession | null>(null);
  const [revisionResources, setRevisionResources] = useState<SavedLearningResource[]>([]);

  // Fetch public community data on mount
  useEffect(() => {
    fetchPublicCommunityCloudData();
  }, []);

  // Modals state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);

  // Flashcards active state
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [studyCards, setStudyCards] = useState<Flashcard[]>([]);
  const [studyDeckTitle, setStudyDeckTitle] = useState<string>("");
  const [isAIFlashcardModalOpen, setIsAIFlashcardModalOpen] = useState(false);
  const [aiGenPreselectedNote, setAiGenPreselectedNote] = useState<NoteDocument | null>(null);
  const [aiGenPreselectedColId, setAiGenPreselectedColId] = useState<string | null>(null);

  // Roadmap generation state
  const [roadmapDraft, setRoadmapDraft] = useState<{
    subject: string;
    learnerLevel: LearnerLevel;
    complexity: Complexity;
    depth: Depth;
    language: NoteLanguage;
    instructions: string;
    topics: { title: string; description: string; estimatedMinutes?: number }[];
  } | null>(null);

  // Test state
  const [testConfig, setTestConfig] = useState<TestConfig | null>(null);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [activeAttempt, setActiveAttempt] = useState<TestAttempt | null>(null);

  useEffect(() => {
    localStorage.setItem("app_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Sync Cloud Data on User Auth change
  useEffect(() => {
    if (user) {
      setSyncing(true);
      syncAllCloudDataToLocal(user.uid).finally(() => setSyncing(false));

      // Check if user has local data to migrate
      const migratedKey = `ainotemaker_migrated_${user.uid}`;
      const hasAlreadyMigrated = localStorage.getItem(migratedKey);
      const localNotes = getSavedNotes();

      if (!hasAlreadyMigrated && localNotes.length > 0) {
        setIsMigrationModalOpen(true);
      }
    }
  }, [user]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Step 1: Start Roadmap draft from Home
  const handleStartRoadmap = (
    subject: string,
    learnerLevel: LearnerLevel,
    complexity: Complexity,
    depth: Depth,
    language: NoteLanguage,
    instructions: string,
    initialTopics: { title: string; description: string; estimatedMinutes?: number }[]
  ) => {
    setRoadmapDraft({
      subject,
      learnerLevel,
      complexity,
      depth,
      language,
      instructions,
      topics: initialTopics,
    });
    setActiveView("roadmap_editor");
  };

  // Step 2: Approve Roadmap -> Create NoteDocument -> Move to GenerationProgress
  const handleApproveRoadmap = (
    approvedTopics: RoadmapTopic[],
    selectedBatchSize: number = 1
  ) => {
    if (!roadmapDraft) return;

    const newNote: NoteDocument = {
      id: `note_${Date.now()}`,
      title: `${roadmapDraft.subject} Comprehensive Study Note`,
      subject: roadmapDraft.subject,
      learnerLevel: roadmapDraft.learnerLevel,
      complexity: roadmapDraft.complexity,
      depth: roadmapDraft.depth,
      language: roadmapDraft.language,
      instructions: roadmapDraft.instructions,
      roadmap: approvedTopics.map((t, idx) => ({
        id: t.id || `topic_${idx + 1}`,
        title: t.title,
        description: t.description,
        estimatedMinutes: t.estimatedMinutes || 10,
        status: "pending",
      })),
      sections: [],
      versions: [],
      authorId: user?.uid || "user_local",
      authorName: user?.displayName || user?.email?.split("@")[0] || "Student",
      generationStatus: "idle",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveNote(newNote);
    setActiveNote(newNote);
    setBatchSize(selectedBatchSize);
    setActiveView("generation_progress");
  };

  // Step 3: Complete or Pause Generation -> Open NoteStudio
  const handleCompleteGeneration = (updatedNote: NoteDocument) => {
    setActiveNote(updatedNote);
    setIsNoteReadOnly(false);
    setActiveView("note_studio");
  };

  // Start Assessment Flow
  const handleStartTest = (config: TestConfig, questions: Question[]) => {
    const note = activeNote || getSavedNotes().find((n) => n.id === config.noteId);
    const savedTestObj: SavedTest = {
      id: config.id,
      noteId: config.noteId,
      noteTitle: note?.title || config.subject,
      subject: config.subject,
      createdAt: new Date().toISOString(),
      config,
      questions,
    };
    saveSavedTest(savedTestObj);

    setTestConfig(config);
    setTestQuestions(questions);
    setActiveView("test_runner");
  };

  const handleCompleteTest = (attempt: TestAttempt) => {
    saveTestAttempt(attempt);

    const savedTests = getSavedTestsList();
    const targetTest = savedTests.find((t) => t.id === attempt.testConfigId);
    if (targetTest) {
      targetTest.lastScore = attempt.score;
      targetTest.lastPercentage = attempt.percentage;
      targetTest.attemptsCount = (targetTest.attemptsCount || 0) + 1;
      saveSavedTest(targetTest);
    }

    setActiveAttempt(attempt);
    setActiveView("test_results");
  };

  // Flashcard Helpers
  const handleStudyDeck = (deck: FlashcardDeck) => {
    const cards = getFlashcards(deck.id);
    setActiveDeck(deck);
    setStudyCards(cards);
    setStudyDeckTitle(deck.title);
    setActiveView("flashcard_study");
  };

  const handleStudyCollectionFlashcards = (collectionId: string) => {
    const dueOrAll = getDueFlashcards(collectionId, true);
    setStudyCards(dueOrAll);
    setStudyDeckTitle(`Collection Study Deck`);
    setActiveView("flashcard_study");
  };

  const handleCreateNewDeckInCollection = (collectionId: string | null) => {
    const newDeck: FlashcardDeck = {
      id: `deck_${Date.now()}`,
      ownerId: user?.uid || "user_local_1",
      collectionId: collectionId,
      title: "New Custom Flashcard Deck",
      description: "Custom study cards",
      subject: "General",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cardCount: 0,
    };
    saveFlashcardDeck(newDeck);
    setActiveDeck(newDeck);
    setActiveView("flashcard_editor");
  };

  // Shorts Learning Handlers
  const handleLearningTreeGenerated = (tree: LearningTree) => {
    setActiveLearningTree(tree);
    setActiveView("shorts_map");
  };

  const handleStartLearningSession = (
    tree: LearningTree,
    timeLimitMinutes: number,
    filters: LearningSessionFilter
  ) => {
    const existing = getActiveLearningSession(tree.id);
    if (existing) {
      saveLearningSession({ ...existing, endedAt: new Date().toISOString() });
    }
    const session: LearningSession = {
      id: `ls_${Date.now()}`,
      userId: "",
      treeId: tree.id,
      topicTitle: tree.title,
      subject: tree.subject,
      timeLimitMinutes,
      startedAt: new Date().toISOString(),
      currentNodeId: "",
      visitedNodeIds: [],
      skippedNodeIds: [],
      completedNodeIds: [],
      savedResourceIds: [],
      filters,
    };
    saveLearningSession(session);
    setActiveLearningTree(tree);
    setActiveLearningSession(session);
    setActiveView("shorts_feed");
  };

  const handleResumeLearningSession = (tree: LearningTree, session: LearningSession) => {
    setActiveLearningTree(tree);
    setActiveLearningSession(session);
    setActiveView("shorts_feed");
  };

  const handleStartRevision = (resources: SavedLearningResource[]) => {
    setRevisionResources(resources);
    setActiveView("shorts_revision");
  };

  const handleTestMeFromShorts = async (topics: { id: string; title: string }[]) => {
    if (!activeLearningTree || topics.length === 0) return;
    try {
      const questions = await generateBatchedTestQuestions({
        subject: activeLearningTree.subject,
        topics,
        questionCount: Math.min(10, Math.max(5, topics.length * 3)),
        difficulty: "Medium",
        questionTypes: ["mcq", "true_false", "fill_blank"],
      });
      const config: TestConfig = {
        id: `test_${Date.now()}`,
        subject: activeLearningTree.subject,
        sourceType: "custom",
        selectedTopicIds: topics.map((t) => t.id),
        questionCount: questions.length,
        difficulty: "Medium",
        questionTypes: ["mcq", "true_false", "fill_blank"],
        timeLimitMinutes: 15,
      };
      handleStartTest(config, questions);
    } catch (err: any) {
      alert(err.message || "Failed to generate a test from your Shorts Learning session. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeView}
        onSelectTab={(tab) => {
          if (tab === "home") setActiveView("home");
          else if (tab === "collections") setActiveView("collections");
          else if (tab === "my_notes") setActiveView("notes_list");
          else if (tab === "flashcards") setActiveView("flashcards");
          else if (tab === "community") setActiveView("community");
          else if (tab === "teach_back") setActiveView("teach_back");
          else if (tab === "settings") setActiveView("settings");
          else if (tab === "shorts_learning") setActiveView(activeLearningTree ? "shorts_map" : "shorts_setup");
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-16">
        {activeView === "home" && (
          <HomeView
            onStartRoadmap={handleStartRoadmap}
            onOpenNoteStudio={(note) => {
              setActiveNote(note);
              setActiveView("note_studio");
            }}
            onOpenCommunity={() => setActiveView("community")}
            onOpenTests={() => setActiveView("test_generator")}
          />
        )}

        {activeView === "collections" && (
          <CollectionsView
            onOpenNoteStudio={(note) => {
              setActiveNote(note);
              setIsNoteReadOnly(false);
              setActiveView("note_studio");
            }}
            onOpenFlashcardDeck={(deck) => {
              setActiveDeck(deck);
              setActiveView("flashcard_editor");
            }}
            onStudyFlashcardDeck={handleStudyDeck}
            onStudyCollectionFlashcards={handleStudyCollectionFlashcards}
            onOpenTest={(test) => {
              setTestConfig(test.config);
              setTestQuestions(test.questions);
              setActiveView("test_runner");
            }}
            onCreateNewNoteInCollection={(colId) => {
              setAiGenPreselectedColId(colId);
              setActiveView("home");
            }}
            onCreateNewDeckInCollection={handleCreateNewDeckInCollection}
            onCreateNewTestInCollection={() => {
              setActiveView("test_generator");
            }}
          />
        )}

        {activeView === "notes_list" && (
          <NotesListView
            onOpenNoteStudio={(note) => {
              setActiveNote(note);
              setIsNoteReadOnly(false);
              setActiveView("note_studio");
            }}
            onOpenTest={(note) => {
              setActiveNote(note);
              setActiveView("test_generator");
            }}
            onOpenAudio={(note) => {
              setActiveNote(note);
              setActiveView("audio_learning");
            }}
            onCreateNew={() => setActiveView("home")}
          />
        )}

        {activeView === "flashcards" && (
          <FlashcardHubView
            onOpenDeckEditor={(deck) => {
              setActiveDeck(deck);
              setActiveView("flashcard_editor");
            }}
            onStudyDeck={handleStudyDeck}
            onOpenAIGenerator={() => {
              setAiGenPreselectedNote(activeNote);
              setIsAIFlashcardModalOpen(true);
            }}
            onCreateNewDeck={() => handleCreateNewDeckInCollection(null)}
            onStudyDueCards={(cards) => {
              setStudyCards(cards);
              setStudyDeckTitle("Due Spaced Repetition Cards");
              setActiveView("flashcard_study");
            }}
          />
        )}

        {activeView === "flashcard_editor" && activeDeck && (
          <FlashcardEditorView
            deck={activeDeck}
            onBack={() => setActiveView("flashcards")}
            onStudyDeck={handleStudyDeck}
            onOpenAIGenerator={() => {
              setAiGenPreselectedNote(null);
              setIsAIFlashcardModalOpen(true);
            }}
          />
        )}

        {activeView === "flashcard_study" && (
          <FlashcardStudyView
            deckTitle={studyDeckTitle}
            cards={studyCards}
            onBack={() => setActiveView("flashcards")}
          />
        )}

        {activeView === "roadmap_editor" && roadmapDraft && (
          <div className="py-8">
            <RoadmapEditor
              subject={roadmapDraft.subject}
              learnerLevel={roadmapDraft.learnerLevel}
              complexity={roadmapDraft.complexity}
              depth={roadmapDraft.depth}
              language={roadmapDraft.language}
              instructions={roadmapDraft.instructions}
              initialTopics={roadmapDraft.topics}
              onStartGeneration={handleApproveRoadmap}
              onCancel={() => setActiveView("home")}
            />
          </div>
        )}

        {activeView === "generation_progress" && activeNote && (
          <div className="py-8">
            <GenerationProgress
              note={activeNote}
              batchSize={batchSize}
              onComplete={handleCompleteGeneration}
              onCancel={() => setActiveView("note_studio")}
            />
          </div>
        )}

        {activeView === "note_studio" && activeNote && (
          <NoteStudio
            note={activeNote}
            readOnly={isNoteReadOnly}
            onBack={() => setActiveView("notes_list")}
            onOpenAudio={() => setActiveView("audio_learning")}
            onOpenTest={() => setActiveView("test_generator")}
            onNoteRemixed={(remixed) => {
              setActiveNote(remixed);
              setIsNoteReadOnly(false);
            }}
          />
        )}

        {activeView === "audio_learning" && activeNote && (
          <AudioLearningView
            note={activeNote}
            onBack={() => setActiveView("note_studio")}
          />
        )}

        {activeView === "test_generator" && (
          <div className="py-8">
            <TestGenerator
              notes={getSavedNotes()}
              preselectedNote={activeNote || undefined}
              onStartTest={handleStartTest}
              onViewAttemptResults={(attempt) => {
                setActiveAttempt(attempt);
                setActiveView("test_results");
              }}
            />
          </div>
        )}

        {activeView === "test_runner" && testConfig && (
          <div className="py-8">
            <TestRunner
              config={testConfig}
              questions={testQuestions}
              onCompleteTest={handleCompleteTest}
              onCancel={() => setActiveView("test_generator")}
            />
          </div>
        )}

        {activeView === "test_results" && activeAttempt && (
          <div className="py-8">
            <TestResultsView
              attempt={activeAttempt}
              onRetake={() => setActiveView("test_generator")}
              onClose={() => setActiveView("home")}
            />
          </div>
        )}

        {activeView === "teach_back" && (
          <TeachBackView notes={getSavedNotes()} />
        )}

        {activeView === "community" && (
          <CommunityView
            onOpenNoteStudio={(note, readOnly = false) => {
              setActiveNote(note);
              setIsNoteReadOnly(!!readOnly);
              setActiveView("note_studio");
            }}
            onOpenFlashcardDeck={(deck) => {
              setActiveDeck(deck);
              setActiveView("flashcard_editor");
            }}
            onOpenCollection={() => {
              setActiveView("collections");
            }}
            onTakeTest={(test) => {
              setTestConfig(test.config);
              setTestQuestions(test.questions);
              setActiveView("test_runner");
            }}
          />
        )}

        {activeView === "settings" && <SettingsView />}

        {activeView === "shorts_setup" && (
          <ShortsSetupView onGenerated={handleLearningTreeGenerated} />
        )}

        {activeView === "shorts_map" && activeLearningTree && (
          <LearningMapView
            tree={activeLearningTree}
            onTreeChange={setActiveLearningTree}
            onStartSession={handleStartLearningSession}
            onResumeSession={handleResumeLearningSession}
            onBack={() => setActiveView("shorts_setup")}
            onTreeDeleted={() => {
              setActiveLearningTree(null);
              setActiveLearningSession(null);
              setActiveView("shorts_setup");
            }}
            onStartRevision={handleStartRevision}
          />
        )}

        {activeView === "shorts_feed" && activeLearningTree && activeLearningSession && (
          <ShortsFeedView
            tree={activeLearningTree}
            session={activeLearningSession}
            onSessionChange={setActiveLearningSession}
            onExit={() => setActiveView("shorts_map")}
            onTestMe={handleTestMeFromShorts}
          />
        )}

        {activeView === "shorts_revision" && (
          <RevisionFeedView
            resources={revisionResources}
            title={activeLearningTree?.title || "Saved Videos"}
            onExit={() => setActiveView(activeLearningTree ? "shorts_map" : "shorts_setup")}
            onTestMe={handleTestMeFromShorts}
          />
        )}
      </main>

      {/* Global Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <DataMigrationModal
        isOpen={isMigrationModalOpen}
        onClose={() => setIsMigrationModalOpen(false)}
        onSuccess={() => {
          if (user) {
            syncAllCloudDataToLocal(user.uid);
          }
        }}
      />

      <AIFlashcardGeneratorModal
        isOpen={isAIFlashcardModalOpen}
        onClose={() => setIsAIFlashcardModalOpen(false)}
        preselectedNote={aiGenPreselectedNote}
        preselectedCollectionId={aiGenPreselectedColId}
        onDeckCreated={(newDeck) => {
          setActiveDeck(newDeck);
          setActiveView("flashcard_editor");
        }}
      />
    </div>
  );
}
