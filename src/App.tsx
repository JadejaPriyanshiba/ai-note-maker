import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, MotionConfig } from "motion/react";
import { viewTransition } from "./lib/motion";
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
import { GenerationStatusToast } from "./components/GenerationStatusToast";
import { useAuth } from "./lib/AuthContext";
import { useGeneration } from "./lib/GenerationContext";
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
  getFlashcardDecks,
  getTestAttempts,
  getLearningTree,
  getCommunityNotes,
  getSavedLearningResources,
} from "./lib/storage";
import { generateBatchedTestQuestions } from "./lib/aiService";
import { AppView, RouteParams, buildPath, useRouter } from "./lib/router";

export default function App() {
  const { user, loading: authLoading, syncing, setSyncing } = useAuth();
  const { activeGeneration } = useGeneration();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("app_theme");
    if (saved === "dark" || saved === "light") return saved;
    return "light";
  });
  // The URL is the source of truth for which view is mounted — `activeView` is derived
  // from it rather than held in its own state, so back/forward and deep links work.
  const { route, navigate } = useRouter();
  const activeView = route.view;
  const go = navigate;
  // Full path, so moving between two notes re-runs the entrance transition and scroll reset
  // the same way moving between two different views does.
  const routeKey = buildPath(route.view, route.params);

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

  // Land at the top of the new view on every navigation — otherwise the entrance transition
  // below can play off-screen if the user was scrolled down in the previous view.
  const isFirstRender = useRef(true);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [routeKey]);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  // Cards under study come from the URL rather than from state handed over at navigation
  // time, so /flashcards/<id>/study, /flashcards/study/collection/<id> and
  // /flashcards/study/due all survive a reload or a shared link.
  const studySelection = useMemo(() => {
    if (activeView !== "flashcard_study") return null;
    if (route.params.deckId) {
      const deck = getFlashcardDecks().find((d) => d.id === route.params.deckId);
      return { cards: getFlashcards(route.params.deckId), title: deck?.title || "Study Deck" };
    }
    if (route.params.collectionId) {
      return { cards: getDueFlashcards(route.params.collectionId, true), title: "Collection Study Deck" };
    }
    return { cards: getDueFlashcards(), title: "Due Spaced Repetition Cards" };
  }, [activeView, route.params.deckId, route.params.collectionId]);

  // Deep links, reloads and back/forward can land on a URL naming an entity this component
  // isn't holding yet (e.g. straight onto /notes/note_123). Rehydrate it from storage, and
  // fall back to the closest list view when the id no longer resolves.
  useEffect(() => {
    const { view, params } = route;

    // Cloud data lands asynchronously after sign-in, so an id that looks missing right now
    // may simply not have synced yet — hold the view blank rather than bouncing the user
    // off a deep link to a note that is about to exist.
    const dataSettled = !authLoading && !syncing;
    const missing = (fallbackView: AppView, fallbackParams: RouteParams = {}) => {
      if (dataSettled) go(fallbackView, fallbackParams, { replace: true });
    };

    if (view === "note_studio" || view === "audio_learning" || view === "generation_progress") {
      if (!params.noteId) return void missing("notes_list");
      if (activeNote?.id === params.noteId) return;
      const local = getSavedNotes().find((n) => n.id === params.noteId);
      // Community notes are read-only copies that never enter the local notes list.
      const shared = getCommunityNotes().find(
        (c) => c.content?.id === params.noteId || c.noteId === params.noteId
      )?.content;
      const note = local || shared || null;
      if (!note) return void missing("notes_list");
      setActiveNote(note);
      setIsNoteReadOnly(!local);
      return;
    }

    if (view === "flashcard_editor") {
      if (activeDeck?.id === params.deckId) return;
      const deck = getFlashcardDecks().find((d) => d.id === params.deckId);
      if (!deck) return void missing("flashcards");
      setActiveDeck(deck);
      return;
    }

    if (view === "flashcard_study") {
      // An empty deck is a valid state (the study view has its own empty message); only a
      // deckId that no longer exists is a dead link.
      if (params.deckId && !getFlashcardDecks().some((d) => d.id === params.deckId)) {
        missing("flashcards");
      }
      return;
    }

    if (view === "test_runner") {
      if (testConfig?.id === params.testId) return;
      const saved = getSavedTestsList().find((t) => t.id === params.testId);
      if (!saved) return void missing("test_generator");
      setTestConfig(saved.config);
      setTestQuestions(saved.questions);
      return;
    }

    if (view === "test_results") {
      if (activeAttempt?.id === params.attemptId) return;
      const attempt = getTestAttempts().find((a) => a.id === params.attemptId);
      if (!attempt) return void missing("test_generator");
      setActiveAttempt(attempt);
      return;
    }

    if (view === "shorts_map" || view === "shorts_feed" || view === "shorts_revision") {
      if (!params.treeId) {
        // /shorts/revision without a tree is only reachable by hand — nothing to review.
        if (view !== "shorts_revision" || revisionResources.length === 0) {
          missing("shorts_setup");
        }
        return;
      }
      const tree = activeLearningTree?.id === params.treeId ? activeLearningTree : getLearningTree(params.treeId);
      if (!tree) return void missing("shorts_setup");
      if (activeLearningTree?.id !== tree.id) setActiveLearningTree(tree);

      if (view === "shorts_feed" && activeLearningSession?.treeId !== tree.id) {
        // Only an unfinished session can be resumed from a bare URL; otherwise send the
        // user back to the map to pick filters and a time limit for a new one.
        const session = getActiveLearningSession(tree.id);
        if (!session) return void missing("shorts_map", { treeId: tree.id });
        setActiveLearningSession(session);
      }

      if (view === "shorts_revision" && revisionResources.length === 0) {
        const treeNodeIds = new Set(tree.nodes.map((n) => n.id));
        const saved = getSavedLearningResources()
          .filter((r) => treeNodeIds.has(r.learningNodeId))
          .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        if (saved.length === 0) return void missing("shorts_map", { treeId: tree.id });
        setRevisionResources(saved);
      }
      return;
    }

    // The roadmap draft only lives in memory — a reload of /create/roadmap has nothing to show.
    if (view === "roadmap_editor" && !roadmapDraft) go("home", {}, { replace: true });
  }, [route, activeNote, activeDeck, testConfig, activeAttempt, activeLearningTree, activeLearningSession, roadmapDraft, revisionResources.length, authLoading, syncing]);

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
    go("roadmap_editor");
  };

  // Only one background generation job runs at a time — starting a second would silently stall
  // behind the first (see GenerationContext's loopActiveRef guard). Used before starting a fresh
  // roadmap and before resuming an interrupted note.
  const guardCanStartGeneration = (): boolean => {
    if (activeGeneration?.isGenerating) {
      alert(
        `"${activeGeneration.note.title}" is still generating. Wait for it to finish (or check its progress from the status bar in the corner) before starting another one.`
      );
      return false;
    }
    return true;
  };

  // Resume a note that was left with pending/failed topics — e.g. generation was interrupted by
  // a full page reload or closed tab, so GenerationContext has no memory of it anymore. Reads the
  // per-topic status already persisted on the note itself to pick up right where it left off.
  const handleContinueGeneration = (note: NoteDocument) => {
    if (!guardCanStartGeneration()) return;
    setActiveNote(note);
    setBatchSize(1);
    go("generation_progress", { noteId: note.id });
  };

  // Step 2: Approve Roadmap -> Create NoteDocument -> Move to GenerationProgress
  const handleApproveRoadmap = (
    approvedTopics: RoadmapTopic[],
    selectedBatchSize: number = 1
  ) => {
    if (!roadmapDraft) return;
    if (!guardCanStartGeneration()) return;

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
    go("generation_progress", { noteId: newNote.id });
  };

  // Step 3: Complete or Pause Generation -> Open NoteStudio
  const handleCompleteGeneration = (updatedNote: NoteDocument) => {
    setActiveNote(updatedNote);
    setIsNoteReadOnly(false);
    go("note_studio", { noteId: updatedNote.id });
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
    go("test_runner", { testId: config.id });
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
    go("test_results", { attemptId: attempt.id });
  };

  // Flashcard Helpers — the cards under study are derived from the URL (see `studySelection`),
  // so these only set the surrounding deck context and navigate.
  const handleStudyDeck = (deck: FlashcardDeck) => {
    setActiveDeck(deck);
    go("flashcard_study", { deckId: deck.id });
  };

  const handleStudyCollectionFlashcards = (collectionId: string) => {
    go("flashcard_study", { collectionId });
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
    go("flashcard_editor", { deckId: newDeck.id });
  };

  // Shorts Learning Handlers
  const handleLearningTreeGenerated = (tree: LearningTree) => {
    setActiveLearningTree(tree);
    go("shorts_map", { treeId: tree.id });
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
    go("shorts_feed", { treeId: tree.id });
  };

  const handleResumeLearningSession = (tree: LearningTree, session: LearningSession) => {
    setActiveLearningTree(tree);
    setActiveLearningSession(session);
    go("shorts_feed", { treeId: tree.id });
  };

  const handleStartRevision = (resources: SavedLearningResource[]) => {
    setRevisionResources(resources);
    go("shorts_revision", activeLearningTree ? { treeId: activeLearningTree.id } : {});
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
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeView}
        onSelectTab={(tab) => {
          if (tab === "home") go("home");
          else if (tab === "collections") go("collections");
          else if (tab === "my_notes") go("notes_list");
          else if (tab === "flashcards") go("flashcards");
          else if (tab === "community") go("community");
          else if (tab === "teach_back") go("teach_back");
          else if (tab === "settings") go("settings");
          else if (tab === "shorts_learning")
            activeLearningTree ? go("shorts_map", { treeId: activeLearningTree.id }) : go("shorts_setup");
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-16">
      <motion.div
        key={routeKey}
        initial={isFirstRender.current ? false : "initial"}
        animate="animate"
        variants={viewTransition}
      >
        {activeView === "home" && (
          <HomeView
            onStartRoadmap={handleStartRoadmap}
            onOpenNoteStudio={(note) => {
              setActiveNote(note);
              go("note_studio", { noteId: note.id });
            }}
            onOpenCommunity={() => go("community")}
            onOpenTests={() => go("test_generator")}
            onContinueGeneration={handleContinueGeneration}
          />
        )}

        {activeView === "collections" && (
          <CollectionsView
            onOpenNoteStudio={(note) => {
              setActiveNote(note);
              setIsNoteReadOnly(false);
              go("note_studio", { noteId: note.id });
            }}
            onOpenFlashcardDeck={(deck) => {
              setActiveDeck(deck);
              go("flashcard_editor", { deckId: deck.id });
            }}
            onStudyFlashcardDeck={handleStudyDeck}
            onStudyCollectionFlashcards={handleStudyCollectionFlashcards}
            onOpenTest={(test) => {
              setTestConfig(test.config);
              setTestQuestions(test.questions);
              go("test_runner", { testId: test.id });
            }}
            onCreateNewNoteInCollection={(colId) => {
              setAiGenPreselectedColId(colId);
              go("home");
            }}
            onCreateNewDeckInCollection={handleCreateNewDeckInCollection}
            onCreateNewTestInCollection={() => {
              go("test_generator");
            }}
          />
        )}

        {activeView === "notes_list" && (
          <NotesListView
            onOpenNoteStudio={(note) => {
              setActiveNote(note);
              setIsNoteReadOnly(false);
              go("note_studio", { noteId: note.id });
            }}
            onOpenTest={(note) => {
              setActiveNote(note);
              go("test_generator");
            }}
            onOpenAudio={(note) => {
              setActiveNote(note);
              go("audio_learning", { noteId: note.id });
            }}
            onCreateNew={() => go("home")}
            onContinueGeneration={handleContinueGeneration}
          />
        )}

        {activeView === "flashcards" && (
          <FlashcardHubView
            onOpenDeckEditor={(deck) => {
              setActiveDeck(deck);
              go("flashcard_editor", { deckId: deck.id });
            }}
            onStudyDeck={handleStudyDeck}
            onOpenAIGenerator={() => {
              setAiGenPreselectedNote(activeNote);
              setIsAIFlashcardModalOpen(true);
            }}
            onCreateNewDeck={() => handleCreateNewDeckInCollection(null)}
            onStudyDueCards={() => go("flashcard_study")}
          />
        )}

        {activeView === "flashcard_editor" && activeDeck && (
          <FlashcardEditorView
            deck={activeDeck}
            onBack={() => go("flashcards")}
            onStudyDeck={handleStudyDeck}
            onOpenAIGenerator={() => {
              setAiGenPreselectedNote(null);
              setIsAIFlashcardModalOpen(true);
            }}
          />
        )}

        {activeView === "flashcard_study" && (
          <FlashcardStudyView
            deckTitle={studySelection?.title || "Study Deck"}
            cards={studySelection?.cards || []}
            onBack={() => go("flashcards")}
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
              onCancel={() => go("home")}
            />
          </div>
        )}

        {activeView === "generation_progress" && activeNote && (
          <div className="py-8">
            <GenerationProgress
              note={activeNote}
              batchSize={batchSize}
              onComplete={handleCompleteGeneration}
              onCancel={() => go("note_studio", { noteId: activeNote.id })}
            />
          </div>
        )}

        {activeView === "note_studio" && activeNote && (
          <NoteStudio
            note={activeNote}
            readOnly={isNoteReadOnly}
            onBack={() => go("notes_list")}
            onOpenAudio={() => go("audio_learning", { noteId: activeNote.id })}
            onOpenTest={() => go("test_generator")}
            onNoteRemixed={(remixed) => {
              setActiveNote(remixed);
              setIsNoteReadOnly(false);
              go("note_studio", { noteId: remixed.id }, { replace: true });
            }}
          />
        )}

        {activeView === "audio_learning" && activeNote && (
          <AudioLearningView
            note={activeNote}
            onBack={() => go("note_studio", { noteId: activeNote.id })}
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
                go("test_results", { attemptId: attempt.id });
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
              onCancel={() => go("test_generator")}
            />
          </div>
        )}

        {activeView === "test_results" && activeAttempt && (
          <div className="py-8">
            <TestResultsView
              attempt={activeAttempt}
              onRetake={() => go("test_generator")}
              onClose={() => go("home")}
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
              go("note_studio", { noteId: note.id });
            }}
            onOpenFlashcardDeck={(deck) => {
              setActiveDeck(deck);
              go("flashcard_editor", { deckId: deck.id });
            }}
            onOpenCollection={() => {
              go("collections");
            }}
            onTakeTest={(test) => {
              setTestConfig(test.config);
              setTestQuestions(test.questions);
              go("test_runner", { testId: test.id });
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
            onBack={() => go("shorts_setup")}
            onTreeDeleted={() => {
              setActiveLearningTree(null);
              setActiveLearningSession(null);
              go("shorts_setup");
            }}
            onStartRevision={handleStartRevision}
          />
        )}

        {activeView === "shorts_feed" && activeLearningTree && activeLearningSession && (
          <ShortsFeedView
            tree={activeLearningTree}
            session={activeLearningSession}
            onSessionChange={setActiveLearningSession}
            onExit={() => go("shorts_map", { treeId: activeLearningTree.id })}
            onTestMe={handleTestMeFromShorts}
          />
        )}

        {activeView === "shorts_revision" && (
          <RevisionFeedView
            resources={revisionResources}
            title={activeLearningTree?.title || "Saved Videos"}
            onExit={() =>
              activeLearningTree ? go("shorts_map", { treeId: activeLearningTree.id }) : go("shorts_setup")
            }
            onTestMe={handleTestMeFromShorts}
          />
        )}
      </motion.div>
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
          go("flashcard_editor", { deckId: newDeck.id });
        }}
      />

      {/* Background note-generation status — visible from any view, see GenerationContext */}
      <GenerationStatusToast
        onOpenNote={(note) => {
          const allDone = (note.roadmap || []).every((t) => t.status === "completed" || t.status === "skipped");
          setActiveNote(note);
          setIsNoteReadOnly(false);
          go(allDone ? "note_studio" : "generation_progress", { noteId: note.id });
        }}
      />
    </div>
    </MotionConfig>
  );
}
