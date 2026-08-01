import {
  NoteDocument,
  CommunityNote,
  TestAttempt,
  AISettings,
  TeachBackEvaluation,
  SavedTest,
  Collection,
  FlashcardDeck,
  Flashcard,
  Complexity,
  CommunityTopicHub,
  TopicHubResource,
  SavedTopicHubRef,
  LearningTree,
  LearningSession,
  SavedLearningResource,
  RevisionPlan,
} from "../types";
import { auth } from "./firebase";
import {
  saveNoteToCloud,
  deleteNoteFromCloud,
  saveCollectionToCloud,
  deleteCollectionFromCloud,
  saveDeckToCloud,
  deleteDeckFromCloud,
  saveCardToCloud,
  deleteCardFromCloud,
  saveTestToCloud,
  deleteTestFromCloud,
  saveAttemptToCloud,
  deleteAttemptFromCloud,
  saveUserSettingsToCloud,
  publishCommunityNoteToCloud,
  unpublishCommunityNoteFromCloud,
  likeCommunityResourceInCloud,
  reportCommunityResourceToCloud,
  fetchUserNotesFromCloud,
  fetchUserCollectionsFromCloud,
  fetchUserDecksFromCloud,
  fetchUserCardsFromCloud,
  fetchUserTestsFromCloud,
  fetchUserAttemptsFromCloud,
  fetchUserSettingsFromCloud,
  fetchCommunityNotesFromCloud,
  fetchCommunityTopicHubsFromCloud,
  publishTopicHubToCloud,
  unpublishTopicHubFromCloud,
  saveTopicHubToUserSavedInCloud,
  unsaveTopicHubFromUserInCloud,
  fetchUserSavedTopicHubsFromCloud,
  incrementTopicHubRemixInCloud,
  fetchUserLearningTreesFromCloud,
  saveLearningTreeToCloud,
  deleteLearningTreeFromCloud,
  fetchUserLearningSessionsFromCloud,
  saveLearningSessionToCloud,
  deleteLearningSessionFromCloud,
  fetchUserSavedLearningResourcesFromCloud,
  saveLearningResourceToCloud,
  deleteLearningResourceFromCloud,
  fetchUserTeachBackEvaluationsFromCloud,
  saveTeachBackEvaluationToCloud,
  deleteTeachBackEvaluationFromCloud,
  fetchUserRevisionResourcesFromCloud,
  saveRevisionResourceToCloud,
  deleteRevisionResourceFromCloud,
} from "./syncService";

const NOTES_STORAGE_KEY = "ainotemaker_user_notes_v1";
const COMMUNITY_STORAGE_KEY = "ainotemaker_community_v1";
const TOPIC_HUBS_STORAGE_KEY = "ainotemaker_topic_hubs_v1";
const SAVED_HUBS_STORAGE_KEY = "ainotemaker_saved_hubs_v1";
const TESTS_STORAGE_KEY = "ainotemaker_test_attempts_v1";
const SAVED_TESTS_STORAGE_KEY = "ainotemaker_saved_tests_v1";
const SETTINGS_STORAGE_KEY = "ainotemaker_settings_v1";
const TEACHBACK_STORAGE_KEY = "ainotemaker_teachback_v1";
const COLLECTIONS_STORAGE_KEY = "ainotemaker_collections_v1";
const FLASHCARD_DECKS_KEY = "ainotemaker_decks_v1";
const FLASHCARDS_KEY = "ainotemaker_cards_v1";
const LEARNING_TREES_KEY = "ainotemaker_learning_trees_v1";
const LEARNING_SESSIONS_KEY = "ainotemaker_learning_sessions_v1";
const SAVED_LEARNING_RESOURCES_KEY = "ainotemaker_saved_learning_resources_v1";

// Seed IDs to filter out if present in existing local storage
const SEED_COLLECTION_IDS = ["col_sem1", "col_cn", "col_unit1"];
const SEED_DECK_IDS = ["deck_osi"];
const SEED_FLASHCARD_IDS = ["fc_1", "fc_2", "fc_3", "fc_4", "fc_5", "fc_6"];
const SEED_NOTE_IDS = ["seed_cn_01", "seed_dsa_02"];
const SEED_COMMUNITY_IDS = ["comm_cn_osi", "comm_deck_osi", "comm_dsa_trees", "comm_col_sem1"];

// Helper to get current auth user ID if logged in
function getCurrentUserId(): string | null {
  return auth.currentUser ? auth.currentUser.uid : null;
}

export interface MigrationFailure {
  type: string;
  title: string;
}

export interface MigrationSummary {
  success: boolean;
  uploaded: number;
  total: number;
  failed: MigrationFailure[];
}

// Uploads a batch of items, tracking exactly which ones failed (and why) instead of assuming
// success just because no exception was thrown — each saveXToCloud call returns a real
// success/failure boolean now (see syncService.ts), since Firestore writes can silently fail
// per-item (e.g. a note exceeding the 1MB document size limit) without the whole batch throwing.
async function uploadBatch<T>(
  items: T[],
  type: string,
  getTitle: (item: T) => string,
  saveFn: (item: T, userId: string) => Promise<boolean>,
  userId: string,
  failed: MigrationFailure[]
): Promise<number> {
  let uploaded = 0;
  for (const item of items) {
    const ok = await saveFn(item, userId);
    if (ok) uploaded++;
    else failed.push({ type, title: getTitle(item) });
  }
  return uploaded;
}

// Local Safety Migration Helper — pushes everything on this device up to the cloud (used both
// for the one-time post-signup migration and for on-demand manual "Sync to Cloud" actions).
export async function migrateLocalDataToCloud(userId: string): Promise<MigrationSummary> {
  const failed: MigrationFailure[] = [];
  let uploaded = 0;
  let total = 0;

  try {
    // 1. Create local backup snapshot
    const backupData = {
      notes: localStorage.getItem(NOTES_STORAGE_KEY),
      collections: localStorage.getItem(COLLECTIONS_STORAGE_KEY),
      decks: localStorage.getItem(FLASHCARD_DECKS_KEY),
      cards: localStorage.getItem(FLASHCARDS_KEY),
      savedTests: localStorage.getItem(SAVED_TESTS_STORAGE_KEY),
      attempts: localStorage.getItem(TESTS_STORAGE_KEY),
      settings: localStorage.getItem(SETTINGS_STORAGE_KEY),
    };
    localStorage.setItem(`ainotemaker_backup_${Date.now()}`, JSON.stringify(backupData));

    const notes = getSavedNotes();
    notes.forEach((n) => (n.authorId = userId));
    total += notes.length;
    uploaded += await uploadBatch(notes, "Note", (n) => n.title, saveNoteToCloud, userId, failed);

    const collections = getCollections();
    total += collections.length;
    uploaded += await uploadBatch(collections, "Collection", (c) => c.name, saveCollectionToCloud, userId, failed);

    const decks = getFlashcardDecks();
    total += decks.length;
    uploaded += await uploadBatch(decks, "Flashcard Deck", (d) => d.title, saveDeckToCloud, userId, failed);

    const cards = getFlashcards();
    total += cards.length;
    uploaded += await uploadBatch(cards, "Flashcard", (c) => c.front, saveCardToCloud, userId, failed);

    const tests = getSavedTestsList();
    total += tests.length;
    uploaded += await uploadBatch(tests, "Test", (t) => t.title || t.subject, saveTestToCloud, userId, failed);

    const attempts = getTestAttempts();
    total += attempts.length;
    uploaded += await uploadBatch(attempts, "Test Attempt", (a) => a.subject, saveAttemptToCloud, userId, failed);

    total += 1;
    const settings = getAISettings();
    if (await saveUserSettingsToCloud(settings, userId)) uploaded += 1;
    else failed.push({ type: "Settings", title: "AI settings" });

    const learningTrees = getLearningTrees();
    total += learningTrees.length;
    uploaded += await uploadBatch(learningTrees, "Learning Tree", (t) => t.title, saveLearningTreeToCloud, userId, failed);

    const learningSessions = getLearningSessions();
    total += learningSessions.length;
    uploaded += await uploadBatch(
      learningSessions,
      "Learning Session",
      (s) => s.topicTitle,
      saveLearningSessionToCloud,
      userId,
      failed
    );

    const savedLearningResources = getSavedLearningResources();
    total += savedLearningResources.length;
    uploaded += await uploadBatch(
      savedLearningResources,
      "Saved Video",
      (r) => r.title,
      saveLearningResourceToCloud,
      userId,
      failed
    );

    const teachBackEvals = getTeachBackEvaluations();
    total += teachBackEvals.length;
    uploaded += await uploadBatch(
      teachBackEvals,
      "Teach-Back Evaluation",
      (e) => e.topicTitle,
      saveTeachBackEvaluationToCloud,
      userId,
      failed
    );

    const revisionResources = getRevisionResources();
    total += revisionResources.length;
    uploaded += await uploadBatch(
      revisionResources,
      "Revision Guide",
      (r) => r.topicTitle,
      saveRevisionResourceToCloud,
      userId,
      failed
    );

    localStorage.setItem(`ainotemaker_migrated_${userId}`, "true");
    return { success: failed.length === 0, uploaded, total, failed };
  } catch (e) {
    console.error("Migration to Cloud failed:", e);
    failed.push({ type: "Fatal", title: e instanceof Error ? e.message : "Unknown error" });
    return { success: false, uploaded, total, failed };
  }
}

// Sync Cloud Database state into Local Cache
export interface CloudSyncSummary {
  success: boolean;
  counts: Record<string, number>;
}

export async function syncAllCloudDataToLocal(userId: string): Promise<CloudSyncSummary> {
  try {
    const [
      cloudNotes,
      cloudCols,
      cloudDecks,
      cloudCards,
      cloudTests,
      cloudAttempts,
      cloudSettings,
      cloudComm,
      cloudHubs,
      cloudSavedHubs,
      cloudLearningTrees,
      cloudLearningSessions,
      cloudSavedLearningResources,
      cloudTeachBackEvals,
      cloudRevisionResources,
    ] = await Promise.all([
      fetchUserNotesFromCloud(userId),
      fetchUserCollectionsFromCloud(userId),
      fetchUserDecksFromCloud(userId),
      fetchUserCardsFromCloud(userId),
      fetchUserTestsFromCloud(userId),
      fetchUserAttemptsFromCloud(userId),
      fetchUserSettingsFromCloud(userId),
      fetchCommunityNotesFromCloud(),
      fetchCommunityTopicHubsFromCloud(),
      fetchUserSavedTopicHubsFromCloud(userId),
      fetchUserLearningTreesFromCloud(userId),
      fetchUserLearningSessionsFromCloud(userId),
      fetchUserSavedLearningResourcesFromCloud(userId),
      fetchUserTeachBackEvaluationsFromCloud(userId),
      fetchUserRevisionResourcesFromCloud(userId),
    ]);

    if (cloudNotes.length > 0) {
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(cloudNotes));
    }
    if (cloudCols.length > 0) {
      localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(cloudCols));
    }
    if (cloudDecks.length > 0) {
      localStorage.setItem(FLASHCARD_DECKS_KEY, JSON.stringify(cloudDecks));
    }
    if (cloudCards.length > 0) {
      localStorage.setItem(FLASHCARDS_KEY, JSON.stringify(cloudCards));
    }
    if (cloudTests.length > 0) {
      localStorage.setItem(SAVED_TESTS_STORAGE_KEY, JSON.stringify(cloudTests));
    }
    if (cloudAttempts.length > 0) {
      localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(cloudAttempts));
    }
    if (cloudSettings) {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cloudSettings));
    }
    if (cloudComm.length > 0) {
      localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(cloudComm));
    }
    if (cloudHubs.length > 0) {
      localStorage.setItem(TOPIC_HUBS_STORAGE_KEY, JSON.stringify(cloudHubs));
    }
    if (cloudSavedHubs.length > 0) {
      localStorage.setItem(SAVED_HUBS_STORAGE_KEY, JSON.stringify(cloudSavedHubs));
    }
    if (cloudLearningTrees.length > 0) {
      localStorage.setItem(LEARNING_TREES_KEY, JSON.stringify(cloudLearningTrees));
    }
    if (cloudLearningSessions.length > 0) {
      localStorage.setItem(LEARNING_SESSIONS_KEY, JSON.stringify(cloudLearningSessions));
    }
    if (cloudSavedLearningResources.length > 0) {
      localStorage.setItem(SAVED_LEARNING_RESOURCES_KEY, JSON.stringify(cloudSavedLearningResources));
    }
    if (cloudTeachBackEvals.length > 0) {
      localStorage.setItem(TEACHBACK_STORAGE_KEY, JSON.stringify(cloudTeachBackEvals));
    }
    if (cloudRevisionResources.length > 0) {
      localStorage.setItem(REVISIONS_STORAGE_KEY, JSON.stringify(cloudRevisionResources));
    }

    return {
      success: true,
      counts: {
        Notes: cloudNotes.length,
        Collections: cloudCols.length,
        "Flashcard Decks": cloudDecks.length,
        Flashcards: cloudCards.length,
        Tests: cloudTests.length,
        "Test Attempts": cloudAttempts.length,
        "Learning Trees": cloudLearningTrees.length,
        "Learning Sessions": cloudLearningSessions.length,
        "Saved Videos": cloudSavedLearningResources.length,
        "Teach-Back Evaluations": cloudTeachBackEvals.length,
        "Revision Guides": cloudRevisionResources.length,
      },
    };
  } catch (err) {
    console.error("Error syncing cloud data to local cache:", err);
    return { success: false, counts: {} };
  }
}

export async function fetchPublicCommunityCloudData(): Promise<void> {
  try {
    const [cloudComm, cloudHubs] = await Promise.all([
      fetchCommunityNotesFromCloud(),
      fetchCommunityTopicHubsFromCloud(),
    ]);
    localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(cloudComm || []));
    localStorage.setItem(TOPIC_HUBS_STORAGE_KEY, JSON.stringify(cloudHubs || []));
  } catch (err) {
    console.error("Error fetching public community cloud data:", err);
  }
}

export function clearAllLocalWebCache(): void {
  try {
    localStorage.removeItem(NOTES_STORAGE_KEY);
    localStorage.removeItem(COMMUNITY_STORAGE_KEY);
    localStorage.removeItem(TOPIC_HUBS_STORAGE_KEY);
    localStorage.removeItem(SAVED_HUBS_STORAGE_KEY);
    localStorage.removeItem(TESTS_STORAGE_KEY);
    localStorage.removeItem(SAVED_TESTS_STORAGE_KEY);
    localStorage.removeItem(COLLECTIONS_STORAGE_KEY);
    localStorage.removeItem(FLASHCARD_DECKS_KEY);
    localStorage.removeItem(FLASHCARDS_KEY);
    localStorage.removeItem(TEACHBACK_STORAGE_KEY);
    localStorage.removeItem(LEARNING_TREES_KEY);
    localStorage.removeItem(LEARNING_SESSIONS_KEY);
    localStorage.removeItem(SAVED_LEARNING_RESOURCES_KEY);
    localStorage.removeItem("ainotemaker_liked_resources");
    localStorage.removeItem("ainotemaker_saved_hubs_set");
    localStorage.removeItem("ainotemaker_revision_guides_v1");
  } catch (e) {
    console.error("Error clearing local web cache:", e);
  }
}

// Local Notes
export function getSavedNotes(): NoteDocument[] {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];
    const notes: NoteDocument[] = JSON.parse(raw);
    const filtered = (notes || []).filter((n) => !SEED_NOTE_IDS.includes(n.id));
    return filtered.map((n) => ({
      ...n,
      roadmap: n.roadmap || [],
      sections: (n.sections || []).map((sec) => ({
        ...sec,
        blocks: sec.blocks || [],
      })),
      versions: n.versions || [],
    }));
  } catch (e) {
    console.error("Failed to load saved notes", e);
    return [];
  }
}

export function saveNote(note: NoteDocument): void {
  const notes = getSavedNotes();
  const existingIdx = notes.findIndex((n) => n.id === note.id);
  note.updatedAt = new Date().toISOString();
  if (existingIdx >= 0) {
    notes[existingIdx] = note;
  } else {
    notes.unshift(note);
  }
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));

  const uid = getCurrentUserId();
  if (uid) {
    saveNoteToCloud(note, uid);
  }
}

export function deleteNote(id: string): void {
  const notes = getSavedNotes().filter((n) => n.id !== id);
  localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));

  const uid = getCurrentUserId();
  if (uid) {
    deleteNoteFromCloud(id);
  }

  // Remove associated flashcard decks generated from this note & their cards
  const decks = getFlashcardDecks();
  const targetDecks = decks.filter((d) => d.sourceNoteId === id);
  for (const deck of targetDecks) {
    deleteFlashcardDeck(deck.id);
  }

  // Remove associated saved tests for this note
  const tests = getSavedTestsList().filter((t) => t.noteId !== id && t.config?.noteId !== id);
  localStorage.setItem(SAVED_TESTS_STORAGE_KEY, JSON.stringify(tests));
}

// Community Notes
export function getCommunityNotes(): CommunityNote[] {
  try {
    const raw = localStorage.getItem(COMMUNITY_STORAGE_KEY);
    const list: CommunityNote[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((item) => !SEED_COMMUNITY_IDS.includes(item.id));
    return filtered.map((item) => ({
      ...item,
      content: item.content
        ? {
            ...item.content,
            roadmap: item.content.roadmap || [],
            sections: (item.content.sections || []).map((sec) => ({
              ...sec,
              blocks: sec.blocks || [],
            })),
          }
        : ({} as NoteDocument),
    }));
  } catch (e) {
    return [];
  }
}

export function publishCommunityNote(
  note: NoteDocument,
  meta: {
    description: string;
    sourceType: 'My own notes' | 'Public domain' | 'Open educational resource' | 'Permission granted' | 'Reference material';
    sourceNotice?: string;
    authorName?: string;
  }
): CommunityNote {
  const communityList = getCommunityNotes();
  const uid = getCurrentUserId() || note.authorId || "user_local_1";

  const newCommNote: CommunityNote = {
    id: `comm_${Date.now()}`,
    noteId: note.id,
    resourceType: 'note',
    title: note.title,
    subject: note.subject,
    mainTopic: note.roadmap?.[0]?.title || note.subject,
    description: meta.description || `Study notes on ${note.subject}`,
    language: note.language,
    difficulty: note.complexity,
    authorName: meta.authorName || note.authorName || "Student Scholar",
    authorId: uid,
    createdAt: new Date().toISOString(),
    remixCount: 0,
    likesCount: 1,
    sourceType: meta.sourceType,
    sourceNotice: meta.sourceNotice,
    validationStatus: "approved",
    content: note,
    lineage: note.remixFromId
      ? [
          {
            id: note.remixFromId,
            title: `Original: ${note.title}`,
            authorName: note.remixAuthor || "Original Author",
            date: note.createdAt,
          },
        ]
      : [],
  };

  communityList.unshift(newCommNote);
  localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(communityList));

  // Sync to Cloud
  publishCommunityNoteToCloud(newCommNote);

  // Mark note as published locally
  note.isCommunityPublished = true;
  note.communityId = newCommNote.id;
  saveNote(note);

  return newCommNote;
}

export function publishCommunityDeck(
  deck: FlashcardDeck,
  cards: Flashcard[],
  meta: {
    description: string;
    subject?: string;
    difficulty?: Complexity;
    sourceType: 'My own notes' | 'Public domain' | 'Open educational resource' | 'Permission granted' | 'Reference material';
    sourceNotice?: string;
    authorName?: string;
  }
): CommunityNote {
  const communityList = getCommunityNotes();
  const uid = getCurrentUserId() || "user_local_1";

  const newCommResource: CommunityNote = {
    id: `comm_deck_${Date.now()}`,
    resourceType: 'flashcard_deck',
    title: deck.title,
    subject: meta.subject || deck.subject || "General",
    mainTopic: deck.topic || deck.subject || "Flashcards",
    description: meta.description || deck.description || "Interactive flashcard deck",
    language: deck.language || "English",
    difficulty: meta.difficulty || "Medium",
    authorName: meta.authorName || "Student Scholar",
    authorId: uid,
    createdAt: new Date().toISOString(),
    remixCount: 0,
    likesCount: 1,
    sourceType: meta.sourceType,
    sourceNotice: meta.sourceNotice,
    validationStatus: 'approved',
    deckContent: {
      deck: { ...deck },
      cards: JSON.parse(JSON.stringify(cards)),
    },
    lineage: [],
  };

  communityList.unshift(newCommResource);
  localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(communityList));

  // Sync to Cloud
  publishCommunityNoteToCloud(newCommResource);

  return newCommResource;
}

export function publishCommunityCollection(
  collection: Collection,
  notesInCollection: NoteDocument[],
  decksInCollection: { deck: FlashcardDeck; cards: Flashcard[] }[],
  meta: {
    description: string;
    subject?: string;
    difficulty?: Complexity;
    sourceType: 'My own notes' | 'Public domain' | 'Open educational resource' | 'Permission granted' | 'Reference material';
    sourceNotice?: string;
    authorName?: string;
  }
): CommunityNote {
  const communityList = getCommunityNotes();
  const uid = getCurrentUserId() || "user_local_1";

  const newCommResource: CommunityNote = {
    id: `comm_col_${Date.now()}`,
    resourceType: 'collection',
    title: collection.name,
    subject: meta.subject || "Computer Science",
    mainTopic: collection.name,
    description: meta.description || collection.description || "Nested study collection",
    language: "English",
    difficulty: meta.difficulty || "Medium",
    authorName: meta.authorName || "Student Scholar",
    authorId: uid,
    createdAt: new Date().toISOString(),
    remixCount: 0,
    likesCount: 1,
    sourceType: meta.sourceType,
    sourceNotice: meta.sourceNotice,
    validationStatus: 'approved',
    collectionContent: {
      collection: { ...collection },
      notes: JSON.parse(JSON.stringify(notesInCollection)),
      decks: JSON.parse(JSON.stringify(decksInCollection)),
    },
    lineage: [],
  };

  communityList.unshift(newCommResource);
  localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(communityList));

  // Sync to Cloud
  publishCommunityNoteToCloud(newCommResource);

  return newCommResource;
}

export function remixCommunityNote(commNote: CommunityNote): NoteDocument {
  const communityList = getCommunityNotes();
  const found = communityList.find((c) => c.id === commNote.id);
  if (found) {
    found.remixCount += 1;
    localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(communityList));
  }

  const uid = getCurrentUserId();

  const newNote: NoteDocument = {
    ...JSON.parse(JSON.stringify(commNote.content || {})),
    id: `note_remix_${Date.now()}`,
    title: `${commNote.title} (Remix)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    remixFromId: commNote.id,
    remixAuthor: commNote.authorName,
    isCommunityPublished: false,
    communityId: undefined,
    authorId: uid || "local_user",
  };

  saveNote(newNote);
  return newNote;
}

export function remixCommunityResource(resource: CommunityNote): {
  type: import("../types").CommunityResourceType;
  note?: NoteDocument;
  deck?: FlashcardDeck;
  collection?: Collection;
} {
  const communityList = getCommunityNotes();
  const found = communityList.find((c) => c.id === resource.id);
  if (found) {
    found.remixCount = (found.remixCount || 0) + 1;
    localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(communityList));
  }

  const resType = resource.resourceType || (resource.content ? 'note' : 'flashcard_deck');

  if (resType === 'note' && resource.content) {
    const remixedNote = remixCommunityNote(resource);
    return { type: 'note', note: remixedNote };
  }

  if (resType === 'flashcard_deck' && resource.deckContent) {
    const newDeckId = `deck_remix_${Date.now()}`;
    const newDeck: FlashcardDeck = {
      ...JSON.parse(JSON.stringify(resource.deckContent.deck)),
      id: newDeckId,
      title: `${resource.title} (Remix)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cardCount: resource.deckContent.cards.length,
      ownerId: getCurrentUserId() || "user_local_1",
    };
    saveFlashcardDeck(newDeck);

    const newCards: Flashcard[] = resource.deckContent.cards.map((c, idx) => ({
      ...JSON.parse(JSON.stringify(c)),
      id: `fc_remix_${Date.now()}_${idx}`,
      deckId: newDeckId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timesSeen: 0,
      timesCorrect: 0,
    }));
    saveFlashcardBatch(newCards);

    return { type: 'flashcard_deck', deck: newDeck };
  }

  if (resType === 'collection' && resource.collectionContent) {
    const newColId = `col_remix_${Date.now()}`;
    const newCol: Collection = {
      ...JSON.parse(JSON.stringify(resource.collectionContent.collection)),
      id: newColId,
      name: `${resource.title} (Remix)`,
      parentCollectionId: null,
      ownerId: getCurrentUserId() || "user_local_1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveCollection(newCol);

    (resource.collectionContent.notes || []).forEach((n) => {
      const copyNote: NoteDocument = {
        ...JSON.parse(JSON.stringify(n)),
        id: `note_remix_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        collectionId: newColId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        authorId: getCurrentUserId() || "user_local_1",
      };
      saveNote(copyNote);
    });

    (resource.collectionContent.decks || []).forEach((d) => {
      const deckId = `deck_remix_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const copyDeck: FlashcardDeck = {
        ...JSON.parse(JSON.stringify(d.deck)),
        id: deckId,
        collectionId: newColId,
        ownerId: getCurrentUserId() || "user_local_1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveFlashcardDeck(copyDeck);

      const copyCards = d.cards.map((c, idx) => ({
        ...JSON.parse(JSON.stringify(c)),
        id: `fc_remix_${Date.now()}_${idx}`,
        deckId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      saveFlashcardBatch(copyCards);
    });

    return { type: 'collection', collection: newCol };
  }

  if (resource.content) {
    const remixedNote = remixCommunityNote(resource);
    return { type: 'note', note: remixedNote };
  }

  throw new Error("Invalid resource content for remixing.");
}

export function toggleLikeCommunityResource(resourceId: string): { likesCount: number; userLiked: boolean } {
  const list = getCommunityNotes();
  const item = list.find((c) => c.id === resourceId);
  const LIKED_KEY = "ainotemaker_liked_resources";
  const rawLiked = localStorage.getItem(LIKED_KEY);
  const likedSet = new Set<string>(rawLiked ? JSON.parse(rawLiked) : []);

  let userLiked = false;
  if (item) {
    if (likedSet.has(resourceId)) {
      likedSet.delete(resourceId);
      item.likesCount = Math.max(0, item.likesCount - 1);
      userLiked = false;
      likeCommunityResourceInCloud(resourceId, -1);
    } else {
      likedSet.add(resourceId);
      item.likesCount += 1;
      userLiked = true;
      likeCommunityResourceInCloud(resourceId, 1);
    }
    item.userLiked = userLiked;
    localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(likedSet)));
    return { likesCount: item.likesCount, userLiked };
  }
  return { likesCount: 0, userLiked: false };
}

export function reportCommunityResource(resourceId: string, reason: string): void {
  const list = getCommunityNotes();
  const item = list.find((c) => c.id === resourceId);
  const uid = getCurrentUserId() || "anonymous";
  if (item) {
    item.reported = true;
    item.reportReason = reason;
    localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(list));
    reportCommunityResourceToCloud(resourceId, reason, uid);
  }
}

export function unpublishCommunityNote(resourceId: string): void {
  const list = getCommunityNotes();
  const filtered = list.filter((c) => c.id !== resourceId && c.noteId !== resourceId);
  localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(filtered));

  // Sync to Cloud
  unpublishCommunityNoteFromCloud(resourceId);

  // Update local note flags if matching
  const notes = getSavedNotes();
  let updatedNotes = false;
  for (const n of notes) {
    if (n.communityId === resourceId || n.id === resourceId) {
      n.isCommunityPublished = false;
      n.communityId = undefined;
      updatedNotes = true;
    }
  }
  if (updatedNotes) {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  }
}

// ==================== COMMUNITY TOPIC HUBS STORAGE ==================== //

export function getCommunityTopicHubs(): CommunityTopicHub[] {
  try {
    const raw = localStorage.getItem(TOPIC_HUBS_STORAGE_KEY);
    if (!raw) return [];
    const list: CommunityTopicHub[] = JSON.parse(raw);
    const SAVED_KEY = "ainotemaker_saved_hubs_set";
    const rawSaved = localStorage.getItem(SAVED_KEY);
    const savedSet = new Set<string>(rawSaved ? JSON.parse(rawSaved) : []);

    return (list || []).map((hub) => ({
      ...hub,
      userSaved: savedSet.has(hub.id),
      resources: hub.resources || [],
      stats: hub.stats || {
        notesCount: (hub.resources || []).filter((r) => r.resourceType === 'note').length,
        decksCount: (hub.resources || []).filter((r) => r.resourceType === 'flashcard_deck').length,
        testsCount: (hub.resources || []).filter((r) => r.resourceType === 'test').length,
      },
    }));
  } catch (e) {
    return [];
  }
}

export function publishTopicHub(hub: CommunityTopicHub): CommunityTopicHub {
  const hubs = getCommunityTopicHubs();
  const uid = getCurrentUserId() || hub.creatorId || "user_local_1";
  hub.creatorId = uid;
  hub.updatedAt = new Date().toISOString();

  // Calculate stats
  const notesCount = (hub.resources || []).filter((r) => r.resourceType === 'note').length;
  const decksCount = (hub.resources || []).filter((r) => r.resourceType === 'flashcard_deck').length;
  const testsCount = (hub.resources || []).filter((r) => r.resourceType === 'test').length;
  hub.stats = {
    notesCount,
    decksCount,
    testsCount,
    estimatedStudyMinutes: notesCount * 15 + decksCount * 10 + testsCount * 15,
  };

  const existingIdx = hubs.findIndex((h) => h.id === hub.id);
  if (existingIdx >= 0) {
    hubs[existingIdx] = hub;
  } else {
    hubs.unshift(hub);
  }

  localStorage.setItem(TOPIC_HUBS_STORAGE_KEY, JSON.stringify(hubs));

  // Sync to Cloud
  publishTopicHubToCloud(hub);

  return hub;
}

export function unpublishTopicHub(hubId: string): void {
  const hubs = getCommunityTopicHubs().filter((h) => h.id !== hubId);
  localStorage.setItem(TOPIC_HUBS_STORAGE_KEY, JSON.stringify(hubs));

  // Sync to Cloud
  unpublishTopicHubFromCloud(hubId);
}

export function toggleSaveTopicHub(hub: CommunityTopicHub): { savesCount: number; userSaved: boolean } {
  const hubs = getCommunityTopicHubs();
  const found = hubs.find((h) => h.id === hub.id);
  const SAVED_KEY = "ainotemaker_saved_hubs_set";
  const rawSaved = localStorage.getItem(SAVED_KEY);
  const savedSet = new Set<string>(rawSaved ? JSON.parse(rawSaved) : []);
  const uid = getCurrentUserId();

  let userSaved = false;
  let newSavesCount = hub.savesCount || 0;

  if (savedSet.has(hub.id)) {
    savedSet.delete(hub.id);
    newSavesCount = Math.max(0, newSavesCount - 1);
    userSaved = false;
    if (uid) unsaveTopicHubFromUserInCloud(uid, hub.id);
  } else {
    savedSet.add(hub.id);
    newSavesCount += 1;
    userSaved = true;
    if (uid) saveTopicHubToUserSavedInCloud(uid, { ...hub, savesCount: newSavesCount });
  }

  if (found) {
    found.savesCount = newSavesCount;
    found.userSaved = userSaved;
  }

  localStorage.setItem(TOPIC_HUBS_STORAGE_KEY, JSON.stringify(hubs));
  localStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(savedSet)));

  return { savesCount: newSavesCount, userSaved };
}

export function getUserSavedTopicHubs(): SavedTopicHubRef[] {
  try {
    const raw = localStorage.getItem(SAVED_HUBS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function remixTopicHub(hub: CommunityTopicHub): CommunityTopicHub {
  const hubs = getCommunityTopicHubs();
  const found = hubs.find((h) => h.id === hub.id);
  if (found) {
    found.remixesCount = (found.remixesCount || 0) + 1;
    localStorage.setItem(TOPIC_HUBS_STORAGE_KEY, JSON.stringify(hubs));
  }
  incrementTopicHubRemixInCloud(hub.id);

  const uid = getCurrentUserId() || "user_local_1";

  const remixedHub: CommunityTopicHub = {
    ...JSON.parse(JSON.stringify(hub)),
    id: `hub_remix_${Date.now()}`,
    title: `${hub.title} (Remix)`,
    creatorId: uid,
    creatorName: "Student Scholar",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    savesCount: 0,
    remixesCount: 0,
    originalHubId: hub.originalHubId || hub.id,
    parentHubId: hub.id,
    rootHubId: hub.rootHubId || hub.id,
    remixAuthor: hub.creatorName,
    lineage: [
      ...(hub.lineage || []),
      {
        id: hub.id,
        title: hub.title,
        authorName: hub.creatorName,
        date: hub.createdAt,
      },
    ],
    version: (hub.version || 1) + 1,
    status: 'draft',
    visibility: 'private',
  };

  // Save as user's private topic hub draft
  const userHubsRaw = localStorage.getItem("ainotemaker_user_private_hubs");
  const userHubs: CommunityTopicHub[] = userHubsRaw ? JSON.parse(userHubsRaw) : [];
  userHubs.unshift(remixedHub);
  localStorage.setItem("ainotemaker_user_private_hubs", JSON.stringify(userHubs));

  return remixedHub;
}

// Test Attempts
export function getTestAttempts(): TestAttempt[] {
  try {
    const raw = localStorage.getItem(TESTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveTestAttempt(attempt: TestAttempt): void {
  const attempts = getTestAttempts();
  attempts.unshift(attempt);
  localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(attempts));

  const uid = getCurrentUserId();
  if (uid) {
    saveAttemptToCloud(attempt, uid);
  }
}

// Saved Tests
export function getSavedTestsList(): SavedTest[] {
  try {
    const raw = localStorage.getItem(SAVED_TESTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveSavedTest(test: SavedTest): void {
  const tests = getSavedTestsList();
  const existingIdx = tests.findIndex((t) => t.id === test.id);
  if (existingIdx >= 0) {
    tests[existingIdx] = test;
  } else {
    tests.unshift(test);
  }
  localStorage.setItem(SAVED_TESTS_STORAGE_KEY, JSON.stringify(tests));

  const uid = getCurrentUserId();
  if (uid) {
    saveTestToCloud(test, uid);
  }
}

export function deleteSavedTest(id: string): void {
  const tests = getSavedTestsList().filter((t) => t.id !== id);
  localStorage.setItem(SAVED_TESTS_STORAGE_KEY, JSON.stringify(tests));

  const uid = getCurrentUserId();
  if (uid) {
    deleteTestFromCloud(id);
  }

  const attempts = getTestAttempts().filter((a) => a.savedTestId !== id && a.testConfigId !== id);
  localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(attempts));
}

export function deleteTestAttempt(id: string): void {
  const attempts = getTestAttempts().filter((a) => a.id !== id);
  localStorage.setItem(TESTS_STORAGE_KEY, JSON.stringify(attempts));

  const uid = getCurrentUserId();
  if (uid) {
    deleteAttemptFromCloud(id);
  }
}

// Teach-back
export function getTeachBackEvaluations(): TeachBackEvaluation[] {
  try {
    const raw = localStorage.getItem(TEACHBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveTeachBackEvaluation(evalResult: TeachBackEvaluation): void {
  const items = getTeachBackEvaluations();
  const idx = items.findIndex((e) => e.id === evalResult.id);
  if (!evalResult.ownerId) {
    evalResult.ownerId = getCurrentUserId() || "user_local_1";
  }
  if (idx >= 0) {
    items[idx] = evalResult;
  } else {
    items.unshift(evalResult);
  }
  localStorage.setItem(TEACHBACK_STORAGE_KEY, JSON.stringify(items));

  const uid = getCurrentUserId();
  if (uid) {
    saveTeachBackEvaluationToCloud(evalResult, uid);
  }
}

export function deleteTeachBackEvaluation(id: string): void {
  const items = getTeachBackEvaluations().filter((e) => e.id !== id);
  localStorage.setItem(TEACHBACK_STORAGE_KEY, JSON.stringify(items));

  const uid = getCurrentUserId();
  if (uid) {
    deleteTeachBackEvaluationFromCloud(id);
  }
}

// AI Settings
export function getAISettings(): AISettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { mode: "default", userApiKey: "", aiRequestsCount: 0 };
    return JSON.parse(raw);
  } catch (e) {
    return { mode: "default", userApiKey: "", aiRequestsCount: 0 };
  }
}

export function saveAISettings(settings: AISettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

  const uid = getCurrentUserId();
  if (uid) {
    saveUserSettingsToCloud(settings, uid);
  }
}

export function incrementAIRequestCount(): void {
  const settings = getAISettings();
  settings.aiRequestsCount = (settings.aiRequestsCount || 0) + 1;
  saveAISettings(settings);
}

// Collections Storage
export function getCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (!raw) return [];
    const list: Collection[] = JSON.parse(raw);
    return (list || []).filter((c) => !SEED_COLLECTION_IDS.includes(c.id));
  } catch (e) {
    return [];
  }
}

export function saveCollection(col: Collection): void {
  const collections = getCollections();
  const existingIdx = collections.findIndex((c) => c.id === col.id);
  col.updatedAt = new Date().toISOString();
  if (!col.ownerId) {
    col.ownerId = getCurrentUserId() || "user_local_1";
  }
  if (existingIdx >= 0) {
    collections[existingIdx] = col;
  } else {
    collections.push(col);
  }
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));

  const uid = getCurrentUserId();
  if (uid) {
    saveCollectionToCloud(col, uid);
  }
}

export function deleteCollection(id: string): void {
  const collections = getCollections();
  const descendantIds = getDescendantCollectionIds(id, collections);

  const remainingCols = collections.filter((c) => !descendantIds.includes(c.id));
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(remainingCols));

  const uid = getCurrentUserId();
  if (uid) {
    descendantIds.forEach((cId) => deleteCollectionFromCloud(cId));
  }

  const notes = getSavedNotes();
  const notesInCols = notes.filter((n) => n.collectionId && descendantIds.includes(n.collectionId));
  notesInCols.forEach((n) => deleteNote(n.id));

  const decks = getFlashcardDecks();
  const decksInCols = decks.filter((d) => d.collectionId && descendantIds.includes(d.collectionId));
  decksInCols.forEach((d) => deleteFlashcardDeck(d.id));

  const tests = getSavedTestsList();
  const remainingTests = tests.filter((t) => {
    const colId = t.collectionId || t.config?.collectionId;
    return !colId || !descendantIds.includes(colId);
  });
  localStorage.setItem(SAVED_TESTS_STORAGE_KEY, JSON.stringify(remainingTests));
}

export function getCollectionPath(
  collectionId: string | null | undefined,
  collections: Collection[] = getCollections()
): Collection[] {
  if (!collectionId) return [];
  const path: Collection[] = [];
  let currentId: string | null = collectionId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const found = collections.find((c) => c.id === currentId);
    if (!found) break;
    path.unshift(found);
    currentId = found.parentCollectionId;
  }
  return path;
}

export function getDescendantCollectionIds(
  collectionId: string,
  collections: Collection[] = getCollections()
): string[] {
  const result: string[] = [collectionId];
  const queue: string[] = [collectionId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = collections.filter((c) => c.parentCollectionId === parentId);
    for (const child of children) {
      if (!result.includes(child.id)) {
        result.push(child.id);
        queue.push(child.id);
      }
    }
  }
  return result;
}

// Flashcards Storage
export function getFlashcardDecks(): FlashcardDeck[] {
  try {
    const raw = localStorage.getItem(FLASHCARD_DECKS_KEY);
    if (!raw) return [];
    const list: FlashcardDeck[] = JSON.parse(raw);
    return (list || []).filter((d) => !SEED_DECK_IDS.includes(d.id));
  } catch (e) {
    return [];
  }
}

export function saveFlashcardDeck(deck: FlashcardDeck): void {
  const decks = getFlashcardDecks();
  const existingIdx = decks.findIndex((d) => d.id === deck.id);
  deck.updatedAt = new Date().toISOString();
  if (!deck.ownerId) {
    deck.ownerId = getCurrentUserId() || "user_local_1";
  }
  if (existingIdx >= 0) {
    decks[existingIdx] = deck;
  } else {
    decks.unshift(deck);
  }
  localStorage.setItem(FLASHCARD_DECKS_KEY, JSON.stringify(decks));

  const uid = getCurrentUserId();
  if (uid) {
    saveDeckToCloud(deck, uid);
  }
}

export function deleteFlashcardDeck(deckId: string): void {
  const decks = getFlashcardDecks().filter((d) => d.id !== deckId);
  localStorage.setItem(FLASHCARD_DECKS_KEY, JSON.stringify(decks));

  const uid = getCurrentUserId();
  if (uid) {
    deleteDeckFromCloud(deckId);
  }

  const cards = getFlashcards().filter((c) => c.deckId !== deckId);
  localStorage.setItem(FLASHCARDS_KEY, JSON.stringify(cards));
}

export function getFlashcards(deckId?: string): Flashcard[] {
  try {
    const raw = localStorage.getItem(FLASHCARDS_KEY);
    if (!raw) return [];
    let list: Flashcard[] = JSON.parse(raw);
    list = (list || []).filter((c) => !SEED_FLASHCARD_IDS.includes(c.id));
    if (deckId) {
      return list.filter((c) => c.deckId === deckId).sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return list;
  } catch (e) {
    return [];
  }
}

export function saveFlashcard(card: Flashcard): void {
  const cards = getFlashcards();
  const idx = cards.findIndex((c) => c.id === card.id);
  card.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    cards[idx] = card;
  } else {
    cards.push(card);
  }
  localStorage.setItem(FLASHCARDS_KEY, JSON.stringify(cards));

  const uid = getCurrentUserId();
  if (uid) {
    saveCardToCloud(card, uid);
  }

  updateDeckCardCount(card.deckId);
}

export function saveFlashcardBatch(newCards: Flashcard[]): void {
  const cards = getFlashcards();
  const uid = getCurrentUserId();

  for (const card of newCards) {
    const idx = cards.findIndex((c) => c.id === card.id);
    card.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      cards[idx] = card;
    } else {
      cards.push(card);
    }
    if (uid) {
      saveCardToCloud(card, uid);
    }
  }
  localStorage.setItem(FLASHCARDS_KEY, JSON.stringify(cards));

  const deckIds = Array.from(new Set(newCards.map((c) => c.deckId)));
  deckIds.forEach(updateDeckCardCount);
}

export function deleteFlashcard(cardId: string): void {
  const cards = getFlashcards();
  const target = cards.find((c) => c.id === cardId);
  const filtered = cards.filter((c) => c.id !== cardId);
  localStorage.setItem(FLASHCARDS_KEY, JSON.stringify(filtered));

  const uid = getCurrentUserId();
  if (uid) {
    deleteCardFromCloud(cardId);
  }

  if (target) {
    updateDeckCardCount(target.deckId);
  }
}

function updateDeckCardCount(deckId: string) {
  const decks = getFlashcardDecks();
  const deck = decks.find((d) => d.id === deckId);
  if (deck) {
    const cards = getFlashcards(deckId);
    deck.cardCount = cards.length;
    saveFlashcardDeck(deck);
  }
}

export function recordCardReview(cardId: string, rating: 'again' | 'hard' | 'good' | 'easy'): Flashcard | null {
  const cards = getFlashcards();
  const card = cards.find((c) => c.id === cardId);
  if (!card) return null;

  const now = new Date();
  card.timesSeen = (card.timesSeen || 0) + 1;
  if (rating !== 'again') {
    card.timesCorrect = (card.timesCorrect || 0) + 1;
  }
  card.difficultyRating = rating;
  card.lastStudiedAt = now.toISOString();

  let intervalDays = card.intervalDays || 1;
  switch (rating) {
    case 'again':
      intervalDays = 0.01;
      break;
    case 'hard':
      intervalDays = 1;
      break;
    case 'good':
      intervalDays = Math.max(3, Math.round(intervalDays * 2));
      break;
    case 'easy':
      intervalDays = Math.max(7, Math.round(intervalDays * 2.5));
      break;
  }

  card.intervalDays = intervalDays;
  const nextDate = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  card.nextReviewAt = nextDate.toISOString();

  saveFlashcard(card);
  return card;
}

export function getDueFlashcards(collectionId?: string | null, includeSubcollections: boolean = true): Flashcard[] {
  const collections = getCollections();
  const decks = getFlashcardDecks();
  let targetDeckIds: string[] = [];

  if (collectionId) {
    const targetColIds = includeSubcollections
      ? getDescendantCollectionIds(collectionId, collections)
      : [collectionId];
    targetDeckIds = decks.filter((d) => d.collectionId && targetColIds.includes(d.collectionId)).map((d) => d.id);
  } else {
    targetDeckIds = decks.map((d) => d.id);
  }

  const cards = getFlashcards();
  const nowIso = new Date().toISOString();

  return cards.filter((c) => {
    if (!targetDeckIds.includes(c.deckId)) return false;
    if (!c.lastStudiedAt) return true;
    if (c.nextReviewAt && c.nextReviewAt <= nowIso) return true;
    return false;
  });
}

// Weakness & Revision
const REVISIONS_STORAGE_KEY = "ainotemaker_revision_guides_v1";

export function getRevisionResources(): RevisionPlan[] {
  try {
    const raw = localStorage.getItem(REVISIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveRevisionResource(resource: RevisionPlan): RevisionPlan {
  const items = getRevisionResources();
  const saved: RevisionPlan = {
    ...resource,
    id: resource.id || `rev_${Date.now()}`,
    ownerId: resource.ownerId || getCurrentUserId() || "user_local_1",
    createdAt: resource.createdAt || new Date().toISOString(),
  };
  const idx = items.findIndex((r) => r.id === saved.id);
  if (idx >= 0) {
    items[idx] = saved;
  } else {
    items.unshift(saved);
  }
  localStorage.setItem(REVISIONS_STORAGE_KEY, JSON.stringify(items));

  const uid = getCurrentUserId();
  if (uid) {
    saveRevisionResourceToCloud(saved, uid);
  }
  return saved;
}

export function deleteRevisionResource(id: string): void {
  const items = getRevisionResources().filter((r) => r.id !== id);
  localStorage.setItem(REVISIONS_STORAGE_KEY, JSON.stringify(items));

  const uid = getCurrentUserId();
  if (uid) {
    deleteRevisionResourceFromCloud(id);
  }
}

export function getWeakTopicStats(): import("../types").WeakTopicStat[] {
  const attempts = getTestAttempts().sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );

  const statsMap: Record<
    string,
    {
      topicId: string;
      topicTitle: string;
      subject: string;
      attemptsCount: number;
      totalQuestions: number;
      totalCorrect: number;
      history: { attemptId: string; date: string; accuracy: number }[];
      lastTestedAt: string;
      lastAccuracy: number;
    }
  > = {};

  for (const att of attempts) {
    if (!att.topicScores) continue;

    for (const [tId, info] of Object.entries(att.topicScores)) {
      if (!info || info.total === 0) continue;

      const accuracy = Math.round((info.correct / info.total) * 100);

      if (!statsMap[tId]) {
        statsMap[tId] = {
          topicId: tId,
          topicTitle: info.title || "Topic",
          subject: att.subject || "General",
          attemptsCount: 0,
          totalQuestions: 0,
          totalCorrect: 0,
          history: [],
          lastTestedAt: att.completedAt,
          lastAccuracy: accuracy,
        };
      }

      const stat = statsMap[tId];
      stat.attemptsCount += 1;
      stat.totalQuestions += info.total;
      stat.totalCorrect += info.correct;
      stat.history.push({
        attemptId: att.id,
        date: att.completedAt,
        accuracy,
      });
      stat.lastTestedAt = att.completedAt;
      stat.lastAccuracy = accuracy;
    }
  }

  const result: import("../types").WeakTopicStat[] = [];

  for (const stat of Object.values(statsMap)) {
    const currentAccuracy = stat.lastAccuracy;
    let status: 'weak' | 'needs_review' | 'improving' | 'mastered' = 'needs_review';

    const hasEarlierLowerScore =
      stat.history.length > 1 &&
      stat.history[0].accuracy < currentAccuracy &&
      currentAccuracy >= 60;

    if (currentAccuracy < 60) {
      status = 'weak';
    } else if (hasEarlierLowerScore) {
      status = 'improving';
    } else if (currentAccuracy >= 80) {
      status = 'mastered';
    } else {
      status = 'needs_review';
    }

    result.push({
      topicId: stat.topicId,
      topicTitle: stat.topicTitle,
      subject: stat.subject,
      attemptsCount: stat.attemptsCount,
      totalQuestions: stat.totalQuestions,
      totalCorrect: stat.totalCorrect,
      currentAccuracy,
      status,
      history: stat.history,
      lastTestedAt: stat.lastTestedAt,
    });
  }

  return result.sort((a, b) => a.currentAccuracy - b.currentAccuracy);
}

// ==========================================
// SHORTS LEARNING
// ==========================================

export function getLearningTrees(): LearningTree[] {
  try {
    const raw = localStorage.getItem(LEARNING_TREES_KEY);
    if (!raw) return [];
    const list: LearningTree[] = JSON.parse(raw);
    return list || [];
  } catch (e) {
    return [];
  }
}

export function getLearningTree(id: string): LearningTree | null {
  return getLearningTrees().find((t) => t.id === id) || null;
}

export function saveLearningTree(tree: LearningTree): void {
  const trees = getLearningTrees();
  const idx = trees.findIndex((t) => t.id === tree.id);
  tree.updatedAt = new Date().toISOString();
  if (!tree.userId) {
    tree.userId = getCurrentUserId() || "user_local_1";
  }
  if (idx >= 0) {
    trees[idx] = tree;
  } else {
    trees.unshift(tree);
  }
  localStorage.setItem(LEARNING_TREES_KEY, JSON.stringify(trees));

  const uid = getCurrentUserId();
  if (uid) {
    saveLearningTreeToCloud(tree, uid);
  }
}

export function deleteLearningTree(id: string): void {
  const trees = getLearningTrees().filter((t) => t.id !== id);
  localStorage.setItem(LEARNING_TREES_KEY, JSON.stringify(trees));

  const uid = getCurrentUserId();
  if (uid) {
    deleteLearningTreeFromCloud(id);
  }

  const sessions = getLearningSessions().filter((s) => s.treeId !== id);
  localStorage.setItem(LEARNING_SESSIONS_KEY, JSON.stringify(sessions));
}

// Learning Sessions

export function getLearningSessions(): LearningSession[] {
  try {
    const raw = localStorage.getItem(LEARNING_SESSIONS_KEY);
    if (!raw) return [];
    const list: LearningSession[] = JSON.parse(raw);
    return list || [];
  } catch (e) {
    return [];
  }
}

export function getActiveLearningSession(treeId: string): LearningSession | null {
  return getLearningSessions().find((s) => s.treeId === treeId && !s.endedAt) || null;
}

export function saveLearningSession(session: LearningSession): void {
  const sessions = getLearningSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (!session.userId) {
    session.userId = getCurrentUserId() || "user_local_1";
  }
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  localStorage.setItem(LEARNING_SESSIONS_KEY, JSON.stringify(sessions));

  const uid = getCurrentUserId();
  if (uid) {
    saveLearningSessionToCloud(session, uid);
  }
}

export function deleteLearningSession(id: string): void {
  const sessions = getLearningSessions().filter((s) => s.id !== id);
  localStorage.setItem(LEARNING_SESSIONS_KEY, JSON.stringify(sessions));

  const uid = getCurrentUserId();
  if (uid) {
    deleteLearningSessionFromCloud(id);
  }
}

// Saved Learning Resources

export function getSavedLearningResources(): SavedLearningResource[] {
  try {
    const raw = localStorage.getItem(SAVED_LEARNING_RESOURCES_KEY);
    if (!raw) return [];
    const list: SavedLearningResource[] = JSON.parse(raw);
    return list || [];
  } catch (e) {
    return [];
  }
}

export function isLearningResourceSaved(providerContentId: string, learningNodeId: string): boolean {
  return getSavedLearningResources().some(
    (r) => r.providerContentId === providerContentId && r.learningNodeId === learningNodeId
  );
}

// Saves a resource, or updates the existing one in place if the same video
// was already saved for the same learning node (prevents duplicate saves).
export function saveSavedLearningResource(resource: SavedLearningResource): SavedLearningResource {
  const resources = getSavedLearningResources();
  const existingIdx = resources.findIndex(
    (r) =>
      r.id === resource.id ||
      (r.providerContentId === resource.providerContentId && r.learningNodeId === resource.learningNodeId)
  );
  if (!resource.userId) {
    resource.userId = getCurrentUserId() || "user_local_1";
  }

  let saved: SavedLearningResource;
  if (existingIdx >= 0) {
    saved = { ...resources[existingIdx], ...resource, id: resources[existingIdx].id };
    resources[existingIdx] = saved;
  } else {
    saved = resource;
    resources.unshift(saved);
  }
  localStorage.setItem(SAVED_LEARNING_RESOURCES_KEY, JSON.stringify(resources));

  const uid = getCurrentUserId();
  if (uid) {
    saveLearningResourceToCloud(saved, uid);
  }
  return saved;
}

export function deleteSavedLearningResource(id: string): void {
  const resources = getSavedLearningResources().filter((r) => r.id !== id);
  localStorage.setItem(SAVED_LEARNING_RESOURCES_KEY, JSON.stringify(resources));

  const uid = getCurrentUserId();
  if (uid) {
    deleteLearningResourceFromCloud(id);
  }
}
