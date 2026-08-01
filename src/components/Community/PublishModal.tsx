import React, { useState, useEffect } from "react";
import { Globe, ShieldCheck, Check, X, BookOpen, Layers, Folder, Compass, Plus, Trash2 } from "lucide-react";
import {
  NoteDocument,
  FlashcardDeck,
  Collection,
  Complexity,
  CommunityTopicHub,
  TopicHubResource,
  TopicHubResourceType,
  NoteLanguage,
  SavedTest,
} from "../../types";
import {
  getSavedNotes,
  getFlashcardDecks,
  getFlashcards,
  getCollections,
  getSavedTestsList,
  publishCommunityNote,
  publishCommunityDeck,
  publishCommunityCollection,
  publishTopicHub,
} from "../../lib/storage";
import { auth } from "../../lib/firebase";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedNote?: NoteDocument | null;
  preselectedDeck?: FlashcardDeck | null;
  preselectedCollection?: Collection | null;
}

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedNote,
  preselectedDeck,
  preselectedCollection,
}) => {
  const [resourceType, setResourceType] = useState<"note" | "flashcard_deck" | "collection" | "topic_hub">(
    preselectedCollection ? "collection" : preselectedDeck ? "flashcard_deck" : "note"
  );

  const notesList = getSavedNotes();
  const decksList = getFlashcardDecks();
  const collectionsList = getCollections();
  const testsList = getSavedTestsList();

  const [selectedNoteId, setSelectedNoteId] = useState<string>(
    preselectedNote?.id || notesList[0]?.id || ""
  );
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    preselectedDeck?.id || decksList[0]?.id || ""
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    preselectedCollection?.id || collectionsList[0]?.id || ""
  );

  // Topic Hub Specific Form State
  const [hubTitle, setHubTitle] = useState<string>("Mastering AI & Machine Learning");
  const [hubTopic, setHubTopic] = useState<string>("Artificial Intelligence");
  const [hubSubtopic, setHubSubtopic] = useState<string>("Neural Networks & Deep Learning");
  const [hubLanguage, setHubLanguage] = useState<NoteLanguage>("English");
  const [selectedNoteIdsForHub, setSelectedNoteIdsForHub] = useState<string[]>(
    notesList.slice(0, 2).map((n) => n.id)
  );
  const [selectedDeckIdsForHub, setSelectedDeckIdsForHub] = useState<string[]>(
    decksList.slice(0, 1).map((d) => d.id)
  );
  const [selectedTestIdsForHub, setSelectedTestIdsForHub] = useState<string[]>(
    testsList.slice(0, 1).map((t) => t.id)
  );

  const selectedNote = preselectedNote || notesList.find((n) => n.id === selectedNoteId);
  const selectedDeck = preselectedDeck || decksList.find((d) => d.id === selectedDeckId);
  const selectedCollection = preselectedCollection || collectionsList.find((c) => c.id === selectedCollectionId);

  const [description, setDescription] = useState<string>(
    selectedNote?.subject
      ? `High-yield study notes for ${selectedNote.subject}`
      : "Comprehensive educational topic hub with integrated notes, flashcard decks, and practice tests."
  );
  const [subject, setSubject] = useState<string>(selectedNote?.subject || selectedDeck?.subject || "Computer Science");
  const [difficulty, setDifficulty] = useState<Complexity>(selectedNote?.complexity || "Medium");
  const [sourceType, setSourceType] = useState<
    "My own notes" | "Public domain" | "Open educational resource" | "Permission granted" | "Reference material"
  >("My own notes");
  const [sourceNotice, setSourceNotice] = useState<string>("");
  const [authorAlias, setAuthorAlias] = useState<string>("Student Scholar");
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      alert("Please confirm the privacy and content license agreement.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (resourceType === "note") {
        if (!selectedNote) throw new Error("Please select a note to publish.");
        publishCommunityNote(selectedNote, {
          description,
          sourceType,
          sourceNotice,
          authorName: authorAlias,
        });
      } else if (resourceType === "flashcard_deck") {
        if (!selectedDeck) throw new Error("Please select a flashcard deck to publish.");
        const cards = getFlashcards(selectedDeck.id);
        publishCommunityDeck(selectedDeck, cards, {
          description,
          subject,
          difficulty,
          sourceType,
          sourceNotice,
          authorName: authorAlias,
        });
      } else if (resourceType === "collection") {
        if (!selectedCollection) throw new Error("Please select a collection to publish.");
        const allNotes = getSavedNotes().filter((n) => n.collectionId === selectedCollection.id);
        const colDecks = getFlashcardDecks().filter((d) => d.collectionId === selectedCollection.id);
        const decksWithCards = colDecks.map((d) => ({
          deck: d,
          cards: getFlashcards(d.id),
        }));

        publishCommunityCollection(selectedCollection, allNotes, decksWithCards, {
          description,
          subject,
          difficulty,
          sourceType,
          sourceNotice,
          authorName: authorAlias,
        });
      } else if (resourceType === "topic_hub") {
        const uid = auth.currentUser?.uid || "user_local_1";
        const hubId = `hub_${Date.now()}`;

        // Construct resources array
        const resources: TopicHubResource[] = [];
        let order = 1;

        // Notes
        notesList
          .filter((n) => selectedNoteIdsForHub.includes(n.id))
          .forEach((n) => {
            resources.push({
              id: `res_note_${n.id}`,
              topicHubId: hubId,
              resourceType: "note",
              resourceId: n.id,
              displayOrder: order++,
              title: n.title,
              description: n.subject,
              createdAt: new Date().toISOString(),
              noteContent: n,
            });
          });

        // Decks
        decksList
          .filter((d) => selectedDeckIdsForHub.includes(d.id))
          .forEach((d) => {
            resources.push({
              id: `res_deck_${d.id}`,
              topicHubId: hubId,
              resourceType: "flashcard_deck",
              resourceId: d.id,
              displayOrder: order++,
              title: d.title,
              description: `${d.cardCount} flashcards`,
              createdAt: new Date().toISOString(),
              deckContent: {
                deck: d,
                cards: getFlashcards(d.id),
              },
            });
          });

        // Tests
        testsList
          .filter((t) => selectedTestIdsForHub.includes(t.id))
          .forEach((t) => {
            resources.push({
              id: `res_test_${t.id}`,
              topicHubId: hubId,
              resourceType: "test",
              resourceId: t.id,
              displayOrder: order++,
              title: t.title,
              description: `${t.questions.length} questions`,
              createdAt: new Date().toISOString(),
              testContent: t,
            });
          });

        const newHub: CommunityTopicHub = {
          id: hubId,
          title: hubTitle,
          description,
          subject,
          topic: hubTopic,
          subtopic: hubSubtopic,
          language: hubLanguage,
          difficulty,
          creatorId: uid,
          creatorName: authorAlias,
          status: "published",
          visibility: "public",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          savesCount: 0,
          remixesCount: 0,
          resources,
          learningPath: resources.map((r, i) => ({
            stepIndex: i + 1,
            title: r.title,
            description: r.description,
            resourceType: r.resourceType,
            resourceId: r.resourceId,
          })),
        };

        publishTopicHub(newHub);
      }

      alert("Successfully published to the Global Community Library!");
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Publishing failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-6 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                Publish to Community Library
              </h2>
              <p className="text-xs text-zinc-500">
                Share your structured learning resource with students worldwide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handlePublish} className="space-y-5 text-xs">
          {/* Resource Type Selector if not preselected */}
          {!preselectedNote && !preselectedDeck && !preselectedCollection && (
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Resource Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setResourceType("note")}
                  className={`p-2.5 rounded-xl border flex flex-col items-center space-y-1 text-center font-semibold transition-all ${
                    resourceType === "note"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Note</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResourceType("flashcard_deck")}
                  className={`p-2.5 rounded-xl border flex flex-col items-center space-y-1 text-center font-semibold transition-all ${
                    resourceType === "flashcard_deck"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Flashcards</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResourceType("collection")}
                  className={`p-2.5 rounded-xl border flex flex-col items-center space-y-1 text-center font-semibold transition-all ${
                    resourceType === "collection"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  <span>Collection</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResourceType("topic_hub")}
                  className={`p-2.5 rounded-xl border flex flex-col items-center space-y-1 text-center font-semibold transition-all ${
                    resourceType === "topic_hub"
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                      : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Topic Hub</span>
                </button>
              </div>
            </div>
          )}

          {/* Item Selector for Notes / Decks / Collections */}
          {!preselectedNote && !preselectedDeck && !preselectedCollection && resourceType !== "topic_hub" && (
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Select {resourceType === "note" ? "Note" : resourceType === "flashcard_deck" ? "Flashcard Deck" : "Collection"}
              </label>
              {resourceType === "note" && (
                <select
                  value={selectedNoteId}
                  onChange={(e) => setSelectedNoteId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                >
                  {notesList.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title} ({n.subject})
                    </option>
                  ))}
                </select>
              )}

              {resourceType === "flashcard_deck" && (
                <select
                  value={selectedDeckId}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                >
                  {decksList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.cardCount} cards)
                    </option>
                  ))}
                </select>
              )}

              {resourceType === "collection" && (
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                >
                  {collectionsList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Topic Hub Custom Form Fields */}
          {resourceType === "topic_hub" && (
            <div className="space-y-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700">
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-500">
                Topic Hub Metadata & Multi-Resource Bundle
              </h3>

              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300">
                  Topic Hub Title
                </label>
                <input
                  type="text"
                  value={hubTitle}
                  onChange={(e) => setHubTitle(e.target.value)}
                  placeholder="e.g. Complete Artificial Intelligence & Neural Networks Guide"
                  className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={hubTopic}
                    onChange={(e) => setHubTopic(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Subtopic
                  </label>
                  <input
                    type="text"
                    value={hubSubtopic}
                    onChange={(e) => setHubSubtopic(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Attach Local Notes */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300 flex justify-between">
                  <span>Include Notes</span>
                  <span className="text-[10px] text-zinc-400">({selectedNoteIdsForHub.length} selected)</span>
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 bg-white dark:bg-zinc-900">
                  {notesList.map((n) => (
                    <label key={n.id} className="flex items-center space-x-2 text-xs cursor-pointer p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        checked={selectedNoteIdsForHub.includes(n.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNoteIdsForHub([...selectedNoteIdsForHub, n.id]);
                          } else {
                            setSelectedNoteIdsForHub(selectedNoteIdsForHub.filter((id) => id !== n.id));
                          }
                        }}
                        className="rounded border-zinc-300"
                      />
                      <span className="truncate text-zinc-800 dark:text-zinc-200">{n.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Attach Flashcard Decks */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300 flex justify-between">
                  <span>Include Flashcard Decks</span>
                  <span className="text-[10px] text-zinc-400">({selectedDeckIdsForHub.length} selected)</span>
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 bg-white dark:bg-zinc-900">
                  {decksList.map((d) => (
                    <label key={d.id} className="flex items-center space-x-2 text-xs cursor-pointer p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        checked={selectedDeckIdsForHub.includes(d.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDeckIdsForHub([...selectedDeckIdsForHub, d.id]);
                          } else {
                            setSelectedDeckIdsForHub(selectedDeckIdsForHub.filter((id) => id !== d.id));
                          }
                        }}
                        className="rounded border-zinc-300"
                      />
                      <span className="truncate text-zinc-800 dark:text-zinc-200">{d.title} ({d.cardCount} cards)</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Attach Practice Tests */}
              <div className="space-y-1.5">
                <label className="font-bold text-zinc-700 dark:text-zinc-300 flex justify-between">
                  <span>Include Practice Tests</span>
                  <span className="text-[10px] text-zinc-400">({selectedTestIdsForHub.length} selected)</span>
                </label>
                <div className="max-h-28 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2 bg-white dark:bg-zinc-900">
                  {testsList.map((t) => (
                    <label key={t.id} className="flex items-center space-x-2 text-xs cursor-pointer p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <input
                        type="checkbox"
                        checked={selectedTestIdsForHub.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTestIdsForHub([...selectedTestIdsForHub, t.id]);
                          } else {
                            setSelectedTestIdsForHub(selectedTestIdsForHub.filter((id) => id !== t.id));
                          }
                        }}
                        className="rounded border-zinc-300"
                      />
                      <span className="truncate text-zinc-800 dark:text-zinc-200">{t.title} ({t.questions.length} questions)</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              Community Summary / Overview
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide a clear description of what students will learn from this resource..."
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none"
              required
            />
          </div>

          {/* Subject & Difficulty */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Complexity)}
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
              >
                <option value="Beginner">Beginner</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
              </select>
            </div>
          </div>

          {/* Source Attribution Declaration */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              Source Rights & Declaration
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as any)}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
            >
              <option value="My own notes">My own original study notes</option>
              <option value="Open educational resource">Open Educational Resource (OER / CC License)</option>
              <option value="Public domain">Public Domain Material</option>
              <option value="Permission granted">Permission Granted by Author</option>
              <option value="Reference material">Reference Material (Summarized)</option>
            </select>
          </div>

          {sourceType !== "My own notes" && (
            <div className="space-y-1.5">
              <label className="font-bold text-zinc-700 dark:text-zinc-300">
                Source Citation / Notice
              </label>
              <input
                type="text"
                value={sourceNotice}
                onChange={(e) => setSourceNotice(e.target.value)}
                placeholder="e.g. Adapted from MIT OpenCourseWare 6.0001"
                className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>
          )}

          {/* Author Display Alias */}
          <div className="space-y-1.5">
            <label className="font-bold text-zinc-700 dark:text-zinc-300">
              Author Display Alias
            </label>
            <input
              type="text"
              value={authorAlias}
              onChange={(e) => setAuthorAlias(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold"
              required
            />
          </div>

          {/* Privacy & Safety Checkbox */}
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-2">
            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
              />
              <span className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-tight">
                <strong>Privacy & Integrity Confirmation:</strong> I confirm this resource contains no private API keys, raw IP addresses, personal identification data, or unauthorized copyrighted materials. I grant permission for students to read and remix this content.
              </span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !agreedToTerms}
              className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold text-xs flex items-center space-x-1.5 disabled:opacity-50 shadow-xs"
            >
              <Globe className="w-4 h-4" />
              <span>{isSubmitting ? "Publishing..." : "Publish Resource"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
