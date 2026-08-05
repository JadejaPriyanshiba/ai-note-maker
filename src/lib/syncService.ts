import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  NoteDocument,
  Collection,
  FlashcardDeck,
  Flashcard,
  SavedTest,
  TestAttempt,
  AISettings,
  CommunityNote,
  CommunityTopicHub,
  SavedTopicHubRef,
  LearningTree,
  LearningSession,
  SavedLearningResource,
  TeachBackEvaluation,
  RevisionPlan,
  PodcastEpisode,
  KnowledgeSource,
  IntakeSummary,
} from "../types";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

// Helper functions to handle Firestore data constraints (e.g. no nested 2D arrays, no undefined values)
export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    const hasNestedArray = obj.some((item) => Array.isArray(item));
    if (hasNestedArray) {
      return obj.map((item) => {
        if (Array.isArray(item)) {
          return { _row: sanitizeForFirestore(item) };
        }
        return sanitizeForFirestore(item);
      });
    }
    return obj.map((item) => sanitizeForFirestore(item));
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = sanitizeForFirestore(val);
    }
  }
  return result;
}

export function deserializeFromFirestore(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    const isWrappedNestedArray =
      obj.length > 0 &&
      obj.every((item) => item && typeof item === "object" && "_row" in item);
    if (isWrappedNestedArray) {
      return obj.map((item) => deserializeFromFirestore(item._row));
    }
    return obj.map((item) => deserializeFromFirestore(item));
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    result[key] = deserializeFromFirestore(obj[key]);
  }
  return result;
}

// ==================== USER PROFILE ==================== //

export async function syncUserProfile(profile: UserProfile): Promise<void> {
  try {
    const userRef = doc(db, "users", profile.uid);
    const snap = await getDoc(userRef);
    const cleanProfile = sanitizeForFirestore(profile);
    if (!snap.exists()) {
      await setDoc(userRef, cleanProfile);
    } else {
      await updateDoc(userRef, {
        displayName: profile.displayName || snap.data().displayName || "Scholar",
        photoURL: profile.photoURL || snap.data().photoURL || "",
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("Error syncing user profile to Firestore:", err);
  }
}

// ==================== NOTES ==================== //

export async function fetchUserNotesFromCloud(userId: string): Promise<NoteDocument[]> {
  try {
    const q = query(
      collection(db, "notes"),
      where("ownerId", "==", userId)
    );
    const snap = await getDocs(q);
    const notes: NoteDocument[] = [];
    snap.forEach((docSnap) => {
      const data = deserializeFromFirestore(docSnap.data());
      const { ownerId, ...noteData } = data;
      notes.push(noteData as NoteDocument);
    });
    // Sort in memory by updatedAt
    return notes.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  } catch (err) {
    console.error("Error fetching notes from cloud:", err);
    return [];
  }
}

// Returns whether the write actually succeeded — errors are logged AND surfaced via the return
// value (rather than only swallowed) so callers like migrateLocalDataToCloud can tell a real
// failure (e.g. exceeding Firestore's 1MB document size limit) apart from success.
export async function saveNoteToCloud(note: NoteDocument, userId: string): Promise<boolean> {
  try {
    const noteRef = doc(db, "notes", note.id);
    const payload = sanitizeForFirestore({
      ...note,
      ownerId: userId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(noteRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving note to cloud:", err);
    return false;
  }
}

export async function deleteNoteFromCloud(noteId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "notes", noteId));
  } catch (err) {
    console.error("Error deleting note from cloud:", err);
  }
}

// ==================== COLLECTIONS ==================== //

export async function fetchUserCollectionsFromCloud(userId: string): Promise<Collection[]> {
  try {
    const q = query(
      collection(db, "collections"),
      where("ownerId", "==", userId)
    );
    const snap = await getDocs(q);
    const cols: Collection[] = [];
    snap.forEach((docSnap) => {
      const data = deserializeFromFirestore(docSnap.data());
      const { ownerId, ...colData } = data;
      cols.push(colData as Collection);
    });
    return cols;
  } catch (err) {
    console.error("Error fetching collections from cloud:", err);
    return [];
  }
}

export async function saveCollectionToCloud(col: Collection, userId: string): Promise<boolean> {
  try {
    const colRef = doc(db, "collections", col.id);
    const payload = sanitizeForFirestore({
      ...col,
      ownerId: userId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(colRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving collection to cloud:", err);
    return false;
  }
}

export async function deleteCollectionFromCloud(collectionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "collections", collectionId));
  } catch (err) {
    console.error("Error deleting collection from cloud:", err);
  }
}

// ==================== FLASHCARDS & DECKS ==================== //

export async function fetchUserDecksFromCloud(userId: string): Promise<FlashcardDeck[]> {
  try {
    const q = query(
      collection(db, "decks"),
      where("ownerId", "==", userId)
    );
    const snap = await getDocs(q);
    const decks: FlashcardDeck[] = [];
    snap.forEach((docSnap) => {
      const data = deserializeFromFirestore(docSnap.data());
      const { ownerId, ...deckData } = data;
      decks.push(deckData as FlashcardDeck);
    });
    return decks;
  } catch (err) {
    console.error("Error fetching decks from cloud:", err);
    return [];
  }
}

export async function saveDeckToCloud(deck: FlashcardDeck, userId: string): Promise<boolean> {
  try {
    const deckRef = doc(db, "decks", deck.id);
    const payload = sanitizeForFirestore({
      ...deck,
      ownerId: userId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(deckRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving deck to cloud:", err);
    return false;
  }
}

export async function deleteDeckFromCloud(deckId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "decks", deckId));
  } catch (err) {
    console.error("Error deleting deck from cloud:", err);
  }
}

export async function fetchUserCardsFromCloud(userId: string): Promise<Flashcard[]> {
  try {
    const q = query(
      collection(db, "flashcards"),
      where("ownerId", "==", userId)
    );
    const snap = await getDocs(q);
    const cards: Flashcard[] = [];
    snap.forEach((docSnap) => {
      const data = deserializeFromFirestore(docSnap.data());
      const { ownerId, ...cardData } = data;
      cards.push(cardData as Flashcard);
    });
    return cards;
  } catch (err) {
    console.error("Error fetching cards from cloud:", err);
    return [];
  }
}

export async function saveCardToCloud(card: Flashcard, userId: string): Promise<boolean> {
  try {
    const cardRef = doc(db, "flashcards", card.id);
    const payload = sanitizeForFirestore({
      ...card,
      ownerId: userId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(cardRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving card to cloud:", err);
    return false;
  }
}

export async function deleteCardFromCloud(cardId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "flashcards", cardId));
  } catch (err) {
    console.error("Error deleting card from cloud:", err);
  }
}

// ==================== TESTS & ATTEMPTS ==================== //

export async function fetchUserTestsFromCloud(userId: string): Promise<SavedTest[]> {
  try {
    const q = query(
      collection(db, "tests"),
      where("ownerId", "==", userId)
    );
    const snap = await getDocs(q);
    const tests: SavedTest[] = [];
    snap.forEach((docSnap) => {
      const data = deserializeFromFirestore(docSnap.data());
      const { ownerId, ...testData } = data;
      tests.push(testData as SavedTest);
    });
    return tests;
  } catch (err) {
    console.error("Error fetching tests from cloud:", err);
    return [];
  }
}

export async function saveTestToCloud(test: SavedTest, userId: string): Promise<boolean> {
  try {
    const testRef = doc(db, "tests", test.id);
    const payload = sanitizeForFirestore({
      ...test,
      ownerId: userId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(testRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving test to cloud:", err);
    return false;
  }
}

export async function deleteTestFromCloud(testId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "tests", testId));
  } catch (err) {
    console.error("Error deleting test from cloud:", err);
  }
}

export async function fetchUserAttemptsFromCloud(userId: string): Promise<TestAttempt[]> {
  try {
    const q = query(
      collection(db, "attempts"),
      where("ownerId", "==", userId)
    );
    const snap = await getDocs(q);
    const attempts: TestAttempt[] = [];
    snap.forEach((docSnap) => {
      const data = deserializeFromFirestore(docSnap.data());
      const { ownerId, ...attemptData } = data;
      attempts.push(attemptData as TestAttempt);
    });
    return attempts.sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
  } catch (err) {
    console.error("Error fetching attempts from cloud:", err);
    return [];
  }
}

export async function saveAttemptToCloud(attempt: TestAttempt, userId: string): Promise<boolean> {
  try {
    const attemptRef = doc(db, "attempts", attempt.id);
    const payload = sanitizeForFirestore({
      ...attempt,
      ownerId: userId,
    });
    await setDoc(attemptRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving attempt to cloud:", err);
    return false;
  }
}

export async function deleteAttemptFromCloud(attemptId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "attempts", attemptId));
  } catch (err) {
    console.error("Error deleting attempt from cloud:", err);
  }
}

// ==================== USER SETTINGS ==================== //

export async function fetchUserSettingsFromCloud(userId: string): Promise<AISettings | null> {
  try {
    const docRef = doc(db, "user_settings", userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = deserializeFromFirestore(snap.data());
      return {
        mode: data.mode || "default",
        userApiKey: data.userApiKey || "",
        aiRequestsCount: data.aiRequestsCount || 0,
      };
    }
  } catch (err) {
    console.error("Error fetching user settings from cloud:", err);
  }
  return null;
}

export async function saveUserSettingsToCloud(settings: AISettings, userId: string): Promise<boolean> {
  try {
    const docRef = doc(db, "user_settings", userId);
    const payload = sanitizeForFirestore({
      ...settings,
      ownerId: userId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(docRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving user settings to cloud:", err);
    return false;
  }
}

// ==================== COMMUNITY NOTES (GLOBAL PUBLIC ACCESS) ==================== //

export async function fetchCommunityNotesFromCloud(): Promise<CommunityNote[]> {
  try {
    const snap = await getDocs(collection(db, "community_notes"));
    const list: CommunityNote[] = [];
    snap.forEach((docSnap) => {
      const rawData = deserializeFromFirestore(docSnap.data());
      list.push({
        id: docSnap.id,
        ...rawData,
      } as CommunityNote);
    });
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    console.error("Error fetching community notes from cloud:", err);
    return [];
  }
}

export async function publishCommunityNoteToCloud(communityNote: CommunityNote): Promise<void> {
  try {
    const docRef = doc(db, "community_notes", communityNote.id);
    const payload = sanitizeForFirestore(communityNote);
    await setDoc(docRef, payload);
  } catch (err) {
    console.error("Error publishing community note to cloud:", err);
  }
}

export async function unpublishCommunityNoteFromCloud(communityNoteId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "community_notes", communityNoteId));
  } catch (err) {
    console.error("Error unpublishing community note from cloud:", err);
  }
}

export async function likeCommunityResourceInCloud(resourceId: string, delta: number): Promise<void> {
  try {
    const docRef = doc(db, "community_notes", resourceId);
    await updateDoc(docRef, {
      likesCount: increment(delta),
    });
  } catch (err) {
    console.error("Error updating community likes in cloud:", err);
  }
}

export async function reportCommunityResourceToCloud(resourceId: string, reason: string, reporterId: string): Promise<void> {
  try {
    const reportRef = doc(db, "reports", `rep_${Date.now()}`);
    await setDoc(reportRef, {
      resourceId,
      reason,
      reporterId,
      createdAt: new Date().toISOString(),
    });
    const itemRef = doc(db, "community_notes", resourceId);
    await updateDoc(itemRef, {
      reported: true,
      reportReason: reason,
    });
  } catch (err) {
    console.error("Error reporting community resource to cloud:", err);
  }
}

// ==================== COMMUNITY TOPIC HUBS (GLOBAL PUBLIC ACCESS) ==================== //

export async function fetchCommunityTopicHubsFromCloud(): Promise<CommunityTopicHub[]> {
  try {
    const snap = await getDocs(collection(db, "community_topic_hubs"));
    const list: CommunityTopicHub[] = [];
    snap.forEach((docSnap) => {
      const rawData = deserializeFromFirestore(docSnap.data());
      list.push({
        id: docSnap.id,
        ...rawData,
      } as CommunityTopicHub);
    });
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (err) {
    console.error("Error fetching community topic hubs from cloud:", err);
    return [];
  }
}

export async function publishTopicHubToCloud(hub: CommunityTopicHub): Promise<void> {
  try {
    const docRef = doc(db, "community_topic_hubs", hub.id);
    const payload = sanitizeForFirestore(hub);
    await setDoc(docRef, payload);
  } catch (err) {
    console.error("Error publishing topic hub to cloud:", err);
  }
}

export async function unpublishTopicHubFromCloud(hubId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "community_topic_hubs", hubId));
  } catch (err) {
    console.error("Error unpublishing topic hub from cloud:", err);
  }
}

export async function saveTopicHubToUserSavedInCloud(userId: string, hub: CommunityTopicHub): Promise<void> {
  try {
    const savedId = `saved_${userId}_${hub.id}`;
    const docRef = doc(db, "saved_topic_hubs", savedId);
    await setDoc(docRef, {
      id: savedId,
      userId,
      topicHubId: hub.id,
      savedAt: new Date().toISOString(),
      topicHubData: sanitizeForFirestore(hub),
    });

    // Increment saves count on the hub
    const hubRef = doc(db, "community_topic_hubs", hub.id);
    await updateDoc(hubRef, {
      savesCount: increment(1),
    });
  } catch (err) {
    console.error("Error saving topic hub to user saved in cloud:", err);
  }
}

export async function unsaveTopicHubFromUserInCloud(userId: string, hubId: string): Promise<void> {
  try {
    const savedId = `saved_${userId}_${hubId}`;
    await deleteDoc(doc(db, "saved_topic_hubs", savedId));

    const hubRef = doc(db, "community_topic_hubs", hubId);
    await updateDoc(hubRef, {
      savesCount: increment(-1),
    });
  } catch (err) {
    console.error("Error unsaving topic hub from user in cloud:", err);
  }
}

export async function fetchUserSavedTopicHubsFromCloud(userId: string): Promise<SavedTopicHubRef[]> {
  try {
    const q = query(collection(db, "saved_topic_hubs"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const list: SavedTopicHubRef[] = [];
    snap.forEach((docSnap) => {
      const rawData = deserializeFromFirestore(docSnap.data());
      list.push(rawData as SavedTopicHubRef);
    });
    return list;
  } catch (err) {
    console.error("Error fetching user saved topic hubs:", err);
    return [];
  }
}

export async function incrementTopicHubRemixInCloud(hubId: string): Promise<void> {
  try {
    const hubRef = doc(db, "community_topic_hubs", hubId);
    await updateDoc(hubRef, {
      remixesCount: increment(1),
    });
  } catch (err) {
    console.error("Error incrementing topic hub remix in cloud:", err);
  }
}

// ==================== SHORTS LEARNING ==================== //

export async function fetchUserLearningTreesFromCloud(userId: string): Promise<LearningTree[]> {
  try {
    const q = query(collection(db, "learning_trees"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const trees: LearningTree[] = [];
    snap.forEach((docSnap) => {
      trees.push(deserializeFromFirestore(docSnap.data()) as LearningTree);
    });
    return trees;
  } catch (err) {
    console.error("Error fetching learning trees from cloud:", err);
    return [];
  }
}

export async function saveLearningTreeToCloud(tree: LearningTree, userId: string): Promise<boolean> {
  try {
    const treeRef = doc(db, "learning_trees", tree.id);
    const payload = sanitizeForFirestore({
      ...tree,
      userId,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(treeRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving learning tree to cloud:", err);
    return false;
  }
}

export async function deleteLearningTreeFromCloud(treeId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "learning_trees", treeId));
  } catch (err) {
    console.error("Error deleting learning tree from cloud:", err);
  }
}

export async function fetchUserLearningSessionsFromCloud(userId: string): Promise<LearningSession[]> {
  try {
    const q = query(collection(db, "learning_sessions"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const sessions: LearningSession[] = [];
    snap.forEach((docSnap) => {
      sessions.push(deserializeFromFirestore(docSnap.data()) as LearningSession);
    });
    return sessions;
  } catch (err) {
    console.error("Error fetching learning sessions from cloud:", err);
    return [];
  }
}

export async function saveLearningSessionToCloud(session: LearningSession, userId: string): Promise<boolean> {
  try {
    const sessionRef = doc(db, "learning_sessions", session.id);
    const payload = sanitizeForFirestore({
      ...session,
      userId,
    });
    await setDoc(sessionRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving learning session to cloud:", err);
    return false;
  }
}

export async function deleteLearningSessionFromCloud(sessionId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "learning_sessions", sessionId));
  } catch (err) {
    console.error("Error deleting learning session from cloud:", err);
  }
}

export async function fetchUserSavedLearningResourcesFromCloud(userId: string): Promise<SavedLearningResource[]> {
  try {
    const q = query(collection(db, "saved_learning_resources"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const resources: SavedLearningResource[] = [];
    snap.forEach((docSnap) => {
      resources.push(deserializeFromFirestore(docSnap.data()) as SavedLearningResource);
    });
    return resources;
  } catch (err) {
    console.error("Error fetching saved learning resources from cloud:", err);
    return [];
  }
}

export async function saveLearningResourceToCloud(resource: SavedLearningResource, userId: string): Promise<boolean> {
  try {
    const resourceRef = doc(db, "saved_learning_resources", resource.id);
    const payload = sanitizeForFirestore({
      ...resource,
      userId,
    });
    await setDoc(resourceRef, payload);
    return true;
  } catch (err) {
    console.error("Error saving learning resource to cloud:", err);
    return false;
  }
}

export async function deleteLearningResourceFromCloud(resourceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "saved_learning_resources", resourceId));
  } catch (err) {
    console.error("Error deleting learning resource from cloud:", err);
  }
}

// ==================== TEACH-BACK EVALUATIONS ==================== //

export async function fetchUserTeachBackEvaluationsFromCloud(userId: string): Promise<TeachBackEvaluation[]> {
  try {
    const q = query(collection(db, "teachback_evaluations"), where("ownerId", "==", userId));
    const snap = await getDocs(q);
    const list: TeachBackEvaluation[] = [];
    snap.forEach((docSnap) => {
      list.push(deserializeFromFirestore(docSnap.data()) as TeachBackEvaluation);
    });
    return list;
  } catch (err) {
    console.error("Error fetching teach-back evaluations from cloud:", err);
    return [];
  }
}

export async function saveTeachBackEvaluationToCloud(evalResult: TeachBackEvaluation, userId: string): Promise<boolean> {
  try {
    const ref = doc(db, "teachback_evaluations", evalResult.id);
    const payload = sanitizeForFirestore({ ...evalResult, ownerId: userId });
    await setDoc(ref, payload);
    return true;
  } catch (err) {
    console.error("Error saving teach-back evaluation to cloud:", err);
    return false;
  }
}

export async function deleteTeachBackEvaluationFromCloud(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "teachback_evaluations", id));
  } catch (err) {
    console.error("Error deleting teach-back evaluation from cloud:", err);
  }
}

// ==================== PODCAST EPISODES ==================== //

export async function fetchUserPodcastsFromCloud(userId: string): Promise<PodcastEpisode[]> {
  try {
    const q = query(collection(db, "podcasts"), where("ownerId", "==", userId));
    const snap = await getDocs(q);
    const list: PodcastEpisode[] = [];
    snap.forEach((docSnap) => {
      list.push(deserializeFromFirestore(docSnap.data()) as PodcastEpisode);
    });
    return list;
  } catch (err) {
    console.error("Error fetching podcast episodes from cloud:", err);
    return [];
  }
}

export async function savePodcastToCloud(episode: PodcastEpisode, userId: string): Promise<boolean> {
  try {
    const ref = doc(db, "podcasts", episode.id);
    const payload = sanitizeForFirestore({ ...episode, ownerId: userId });
    await setDoc(ref, payload);
    return true;
  } catch (err) {
    console.error("Error saving podcast episode to cloud:", err);
    return false;
  }
}

export async function deletePodcastFromCloud(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "podcasts", id));
  } catch (err) {
    console.error("Error deleting podcast episode from cloud:", err);
  }
}

// ==================== REVISION RESOURCES ==================== //

export async function fetchUserRevisionResourcesFromCloud(userId: string): Promise<RevisionPlan[]> {
  try {
    const q = query(collection(db, "revision_resources"), where("ownerId", "==", userId));
    const snap = await getDocs(q);
    const list: RevisionPlan[] = [];
    snap.forEach((docSnap) => {
      list.push(deserializeFromFirestore(docSnap.data()) as RevisionPlan);
    });
    return list;
  } catch (err) {
    console.error("Error fetching revision resources from cloud:", err);
    return [];
  }
}

export async function saveRevisionResourceToCloud(resource: RevisionPlan, userId: string): Promise<boolean> {
  try {
    const ref = doc(db, "revision_resources", resource.id!);
    const payload = sanitizeForFirestore({ ...resource, ownerId: userId });
    await setDoc(ref, payload);
    return true;
  } catch (err) {
    console.error("Error saving revision resource to cloud:", err);
    return false;
  }
}

export async function deleteRevisionResourceFromCloud(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "revision_resources", id));
  } catch (err) {
    console.error("Error deleting revision resource from cloud:", err);
  }
}

// ==================== KNOWLEDGE SOURCES (Knowledge Intake pipeline) ==================== //

export async function fetchUserKnowledgeSourcesFromCloud(userId: string): Promise<KnowledgeSource[]> {
  try {
    const q = query(collection(db, "knowledge_sources"), where("ownerId", "==", userId));
    const snap = await getDocs(q);
    const list: KnowledgeSource[] = [];
    snap.forEach((docSnap) => {
      list.push(deserializeFromFirestore(docSnap.data()) as KnowledgeSource);
    });
    return list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  } catch (err) {
    console.error("Error fetching knowledge sources from cloud:", err);
    return [];
  }
}

export async function saveKnowledgeSourceToCloud(source: KnowledgeSource, userId: string): Promise<boolean> {
  try {
    const ref = doc(db, "knowledge_sources", source.id);
    const payload = sanitizeForFirestore({ ...source, ownerId: userId });
    await setDoc(ref, payload);
    return true;
  } catch (err) {
    console.error("Error saving knowledge source to cloud:", err);
    return false;
  }
}

export async function deleteKnowledgeSourceFromCloud(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "knowledge_sources", id));
  } catch (err) {
    console.error("Error deleting knowledge source from cloud:", err);
  }
}

// ==================== INTAKE SUMMARIES (Knowledge Intake pipeline) ==================== //

export async function fetchUserIntakeSummariesFromCloud(userId: string): Promise<IntakeSummary[]> {
  try {
    const q = query(collection(db, "intake_summaries"), where("ownerId", "==", userId));
    const snap = await getDocs(q);
    const list: IntakeSummary[] = [];
    snap.forEach((docSnap) => {
      list.push(deserializeFromFirestore(docSnap.data()) as IntakeSummary);
    });
    return list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  } catch (err) {
    console.error("Error fetching intake summaries from cloud:", err);
    return [];
  }
}

export async function saveIntakeSummaryToCloud(summary: IntakeSummary, userId: string): Promise<boolean> {
  try {
    const ref = doc(db, "intake_summaries", summary.id);
    const payload = sanitizeForFirestore({ ...summary, ownerId: userId });
    await setDoc(ref, payload);
    return true;
  } catch (err) {
    console.error("Error saving intake summary to cloud:", err);
    return false;
  }
}

export async function deleteIntakeSummaryFromCloud(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "intake_summaries", id));
  } catch (err) {
    console.error("Error deleting intake summary from cloud:", err);
  }
}
