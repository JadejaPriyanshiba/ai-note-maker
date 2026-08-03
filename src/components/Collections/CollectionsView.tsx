import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { fadeInUp, staggerContainer } from "../../lib/motion";
import {
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  FileText,
  Layers,
  CheckSquare,
  Sparkles,
  Search,
  Plus,
  Edit2,
  Trash2,
  MoveRight,
  FolderTree,
  Home,
  BookOpen,
  ArrowRight,
  GitFork,
  Globe
} from "lucide-react";
import { Collection, NoteDocument, FlashcardDeck, SavedTest } from "../../types";
import {
  getCollections,
  saveCollection,
  deleteCollection,
  getCollectionPath,
  getDescendantCollectionIds,
  getSavedNotes,
  saveNote,
  deleteNote,
  getFlashcardDecks,
  saveFlashcardDeck,
  deleteFlashcardDeck,
  getSavedTestsList,
  saveSavedTest,
  deleteSavedTest,
} from "../../lib/storage";
import { CollectionSelectorModal } from "./CollectionSelectorModal";
import { PublishModal } from "../Community/PublishModal";
import { ConfirmModal } from "../ConfirmModal";
import { Modal } from "../Modal";
import { EmptyState } from "../EmptyState";

interface CollectionsViewProps {
  onOpenNoteStudio: (note: NoteDocument) => void;
  onOpenFlashcardDeck: (deck: FlashcardDeck) => void;
  onStudyFlashcardDeck: (deck: FlashcardDeck) => void;
  onStudyCollectionFlashcards: (collectionId: string) => void;
  onOpenTest: (test: SavedTest) => void;
  onCreateNewNoteInCollection: (collectionId: string | null) => void;
  onCreateNewDeckInCollection: (collectionId: string | null) => void;
  onCreateNewTestInCollection: (collectionId: string | null) => void;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  onOpenNoteStudio,
  onOpenFlashcardDeck,
  onStudyFlashcardDeck,
  onStudyCollectionFlashcards,
  onOpenTest,
  onCreateNewNoteInCollection,
  onCreateNewDeckInCollection,
  onCreateNewTestInCollection,
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [notes, setNotes] = useState<NoteDocument[]>([]);
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [tests, setTests] = useState<SavedTest[]>([]);

  // Current folder navigation state
  const [currentCollectionId, setCurrentCollectionId] = useState<string | null>(null);

  // Tree sidebar expanded folder state
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [publishingCol, setPublishingCol] = useState<Collection | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCol, setEditingCol] = useState<Collection | null>(null);
  const [colName, setColName] = useState("");
  const [colDesc, setColDesc] = useState("");

  // Move Resource Modal State
  const [movingResource, setMovingResource] = useState<{
    type: "note" | "deck" | "test" | "collection";
    id: string;
    title: string;
  } | null>(null);
  const [isMoveSelectorOpen, setIsMoveSelectorOpen] = useState(false);

  const reloadData = () => {
    const cols = getCollections();
    const allNotes = getSavedNotes();
    const allDecks = getFlashcardDecks();
    const allTests = getSavedTestsList();
    setCollections(cols);
    setNotes(allNotes);
    setDecks(allDecks);
    setTests(allTests);
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Auto-expand path when currentCollectionId changes
  useEffect(() => {
    if (currentCollectionId) {
      const path = getCollectionPath(currentCollectionId, collections);
      const newExpanded = { ...expandedFolders };
      path.forEach((c) => {
        newExpanded[c.id] = true;
      });
      setExpandedFolders(newExpanded);
    }
  }, [currentCollectionId, collections]);

  const toggleFolderExpand = (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleSaveCollectionForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!colName.trim()) return;

    if (editingCol) {
      saveCollection({
        ...editingCol,
        name: colName.trim(),
        description: colDesc.trim(),
      });
    } else {
      saveCollection({
        id: `col_${Date.now()}`,
        ownerId: "user_local_1",
        parentCollectionId: currentCollectionId,
        name: colName.trim(),
        description: colDesc.trim(),
        icon: "folder",
        color: "zinc",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    setIsCreateModalOpen(false);
    setEditingCol(null);
    setColName("");
    setColDesc("");
    reloadData();
  };

  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<{
    type: "collection" | "note" | "deck" | "test";
    id: string;
    name: string;
  } | null>(null);

  const handleDeleteCollection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const col = collections.find((c) => c.id === id);
    setItemToDelete({
      type: "collection",
      id,
      name: col ? col.name : "this folder",
    });
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const note = notes.find((n) => n.id === id);
    setItemToDelete({
      type: "note",
      id,
      name: note ? note.title : "this study note",
    });
  };

  const handleDeleteDeck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const deck = decks.find((d) => d.id === id);
    setItemToDelete({
      type: "deck",
      id,
      name: deck ? deck.title : "this flashcard deck",
    });
  };

  const handleDeleteTest = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const test = tests.find((t) => t.id === id);
    setItemToDelete({
      type: "test",
      id,
      name: test ? test.noteTitle : "this practice test",
    });
  };

  const confirmDeleteItem = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === "collection") {
      deleteCollection(itemToDelete.id);
      if (currentCollectionId === itemToDelete.id) {
        setCurrentCollectionId(null);
      }
    } else if (itemToDelete.type === "note") {
      deleteNote(itemToDelete.id);
    } else if (itemToDelete.type === "deck") {
      deleteFlashcardDeck(itemToDelete.id);
    } else if (itemToDelete.type === "test") {
      deleteSavedTest(itemToDelete.id);
    }
    setItemToDelete(null);
    reloadData();
  };

  const handleMoveResourceConfirm = (targetColId: string | null) => {
    if (!movingResource) return;

    if (movingResource.type === "note") {
      const note = notes.find((n) => n.id === movingResource.id);
      if (note) {
        saveNote({ ...note, collectionId: targetColId });
      }
    } else if (movingResource.type === "deck") {
      const deck = decks.find((d) => d.id === movingResource.id);
      if (deck) {
        saveFlashcardDeck({ ...deck, collectionId: targetColId });
      }
    } else if (movingResource.type === "test") {
      const test = tests.find((t) => t.id === movingResource.id);
      if (test) {
        saveSavedTest({ ...test, collectionId: targetColId, config: { ...test.config, collectionId: targetColId } });
      }
    } else if (movingResource.type === "collection") {
      const col = collections.find((c) => c.id === movingResource.id);
      if (col) {
        saveCollection({ ...col, parentCollectionId: targetColId });
      }
    }

    setMovingResource(null);
    setIsMoveSelectorOpen(false);
    reloadData();
  };

  // Helper Breadcrumbs Path
  const breadcrumbPath = getCollectionPath(currentCollectionId, collections);
  const currentCollection = collections.find((c) => c.id === currentCollectionId);

  // Sub-collections in current folder
  const currentChildCols = collections.filter((c) => c.parentCollectionId === currentCollectionId);

  // Resources in current folder
  const currentNotes = notes.filter((n) => (n.collectionId || null) === currentCollectionId);
  const currentDecks = decks.filter((d) => (d.collectionId || null) === currentCollectionId);
  const currentTests = tests.filter((t) => (t.collectionId || null) === currentCollectionId);

  // Search Results across all folders
  const isSearching = searchQuery.trim().length > 0;
  const searchLower = searchQuery.toLowerCase();

  const searchResultsCols = isSearching
    ? collections.filter((c) => c.name.toLowerCase().includes(searchLower) || (c.description || "").toLowerCase().includes(searchLower))
    : [];
  const searchResultsNotes = isSearching
    ? notes.filter((n) => n.title.toLowerCase().includes(searchLower) || n.subject.toLowerCase().includes(searchLower))
    : [];
  const searchResultsDecks = isSearching
    ? decks.filter((d) => d.title.toLowerCase().includes(searchLower) || d.subject.toLowerCase().includes(searchLower))
    : [];
  const searchResultsTests = isSearching
    ? tests.filter((t) => t.noteTitle.toLowerCase().includes(searchLower) || t.subject.toLowerCase().includes(searchLower))
    : [];

  // Recursive Tree Node Renderer for Sidebar
  const renderTreeNode = (col: Collection, level: number = 0) => {
    const isExpanded = !!expandedFolders[col.id];
    const children = collections.filter((c) => c.parentCollectionId === col.id);
    const isSelected = currentCollectionId === col.id;

    return (
      <div key={col.id} className="space-y-0.5">
        <div
          onClick={() => setCurrentCollectionId(col.id)}
          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold"
              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
          }`}
          style={{ paddingLeft: `${level * 12 + 10}px` }}
        >
          <div className="flex items-center space-x-2 truncate">
            {children.length > 0 ? (
              <button
                onClick={(e) => toggleFolderExpand(col.id, e)}
                className="p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ) : (
              <span className="w-3.5 h-3.5" />
            )}
            <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-white dark:text-zinc-900" : "text-zinc-500"}`} />
            <span className="truncate">{col.name}</span>
          </div>

          <div className="hidden group-hover:flex items-center space-x-1 shrink-0">
            <button
              title="Edit folder"
              onClick={(e) => {
                e.stopPropagation();
                setEditingCol(col);
                setColName(col.name);
                setColDesc(col.description || "");
                setIsCreateModalOpen(true);
              }}
              className="p-1 hover:text-zinc-900 dark:hover:text-white"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              title="Delete folder"
              onClick={(e) => handleDeleteCollection(col.id, e)}
              className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {isExpanded && children.length > 0 && (
          <div className="space-y-0.5">
            {children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootCollections = collections.filter((c) => c.parentCollectionId === null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <FolderTree className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Personal Study Library
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            My Collections
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
            Organize all your notes, flashcards, and practice tests into arbitrary nested study folders without restrictions.
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setEditingCol(null);
              setColName("");
              setColDesc("");
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold flex items-center space-x-1.5 shadow-xs"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ New Folder</span>
          </button>

          {currentCollectionId && (
            <>
              <button
                onClick={() => onStudyCollectionFlashcards(currentCollectionId)}
                className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-semibold flex items-center space-x-1.5"
              >
                <Layers className="w-4 h-4" />
                <span>Study All Flashcards</span>
              </button>

              <button
                onClick={() => {
                  const targetCol = collections.find((c) => c.id === currentCollectionId);
                  if (targetCol) setPublishingCol(targetCol);
                }}
                className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-semibold flex items-center space-x-1.5"
              >
                <Globe className="w-4 h-4" />
                <span>Publish Collection</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Sidebar Tree + Content View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Sidebar Tree Navigation */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center space-x-1.5">
              <FolderTree className="w-4 h-4 text-zinc-500" />
              <span>Directory Tree</span>
            </h3>
            <span className="text-[10px] font-semibold text-zinc-400">
              {collections.length} folders
            </span>
          </div>

          <div className="space-y-1">
            {/* Root Selection Button */}
            <div
              onClick={() => setCurrentCollectionId(null)}
              className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                currentCollectionId === null
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <Home className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
              <span>Root (All Unorganized)</span>
            </div>

            {/* Tree Nodes */}
            {rootCollections.map((col) => renderTreeNode(col, 0))}
          </div>
        </div>

        {/* Right Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Top Search & Breadcrumb Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collections, notes, flashcard decks, or tests..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Clickable Breadcrumbs Path */}
            {!isSearching && (
              <div className="flex items-center space-x-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 overflow-x-auto pt-1">
                <button
                  onClick={() => setCurrentCollectionId(null)}
                  className={`px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center space-x-1 ${
                    currentCollectionId === null ? "text-zinc-900 dark:text-white font-bold bg-zinc-100 dark:bg-zinc-800" : ""
                  }`}
                >
                  <Home className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Library</span>
                </button>

                {breadcrumbPath.map((col) => (
                  <React.Fragment key={col.id}>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <button
                      onClick={() => setCurrentCollectionId(col.id)}
                      className={`px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap ${
                        currentCollectionId === col.id ? "text-zinc-900 dark:text-white font-bold bg-zinc-100 dark:bg-zinc-800" : ""
                      }`}
                    >
                      {col.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* SEARCH RESULTS VIEW */}
          {isSearching ? (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Search Results for "{searchQuery}"
              </h3>

              {searchResultsCols.length === 0 &&
              searchResultsNotes.length === 0 &&
              searchResultsDecks.length === 0 &&
              searchResultsTests.length === 0 ? (
                <EmptyState message="No matching collections or resources found." />
              ) : (
                <div className="space-y-4">
                  {/* Matching Folders */}
                  {searchResultsCols.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Folders ({searchResultsCols.length})</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResultsCols.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setCurrentCollectionId(c.id);
                              setSearchQuery("");
                            }}
                            className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <Folder className="w-5 h-5 text-zinc-600 dark:text-zinc-300 shrink-0" />
                              <div>
                                <p className="text-xs font-bold text-zinc-900 dark:text-white">{c.name}</p>
                                <p className="text-[11px] text-zinc-500">{c.description || "Collection folder"}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Notes */}
                  {searchResultsNotes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Notes ({searchResultsNotes.length})</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResultsNotes.map((note) => {
                          const notePath = getCollectionPath(note.collectionId, collections);
                          return (
                            <div
                              key={note.id}
                              onClick={() => onOpenNoteStudio(note)}
                              className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">{note.subject}</span>
                                <FileText className="w-4 h-4 text-zinc-500" />
                              </div>
                              <h5 className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-1">{note.title}</h5>
                              <p className="text-[10px] text-zinc-400">
                                📍 {notePath.map((p) => p.name).join(" → ") || "Root"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Matching Flashcard Decks */}
                  {searchResultsDecks.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Flashcard Decks ({searchResultsDecks.length})</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {searchResultsDecks.map((deck) => {
                          const deckPath = getCollectionPath(deck.collectionId, collections);
                          return (
                            <div
                              key={deck.id}
                              onClick={() => onOpenFlashcardDeck(deck)}
                              className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">{deck.subject}</span>
                                <Layers className="w-4 h-4 text-zinc-500" />
                              </div>
                              <h5 className="text-xs font-bold text-zinc-900 dark:text-white line-clamp-1">{deck.title}</h5>
                              <p className="text-[10px] text-zinc-400">
                                📍 {deckPath.map((p) => p.name).join(" → ") || "Root"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* FOLDER CONTENT VIEW */
            <div className="space-y-6">
              {/* Folder Details Banner */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Folder className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                      {currentCollection ? currentCollection.name : "Root Directory"}
                    </h2>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {currentCollection?.description || "Top-level unorganized notes and resources."}
                  </p>
                </div>

                {/* Quick Add Buttons for Current Folder */}
                <div className="flex flex-wrap items-center gap-2">
                  {currentCollection && (
                    <button
                      onClick={(e) => handleDeleteCollection(currentCollection.id, e)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-semibold flex items-center space-x-1"
                      title="Delete this folder and all nested items"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Folder</span>
                    </button>
                  )}
                  <button
                    onClick={() => onCreateNewNoteInCollection(currentCollectionId)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Note</span>
                  </button>
                  <button
                    onClick={() => onCreateNewDeckInCollection(currentCollectionId)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Flashcards</span>
                  </button>
                  <button
                    onClick={() => onCreateNewTestInCollection(currentCollectionId)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Test</span>
                  </button>
                </div>
              </div>

              {/* Sub-Folders Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center space-x-1.5">
                    <Folder className="w-4 h-4 text-zinc-400" />
                    <span>Sub-Folders ({currentChildCols.length})</span>
                  </h3>
                  <button
                    onClick={() => {
                      setEditingCol(null);
                      setColName("");
                      setColDesc("");
                      setIsCreateModalOpen(true);
                    }}
                    className="text-xs font-bold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center space-x-1"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>+ Add Sub-folder</span>
                  </button>
                </div>

                {currentChildCols.length === 0 ? (
                  <EmptyState message="No sub-folders inside this directory." />
                ) : (
                  <motion.div
                    variants={staggerContainer()}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
                  >
                    {currentChildCols.map((childCol) => {
                      const childNotes = notes.filter((n) => n.collectionId === childCol.id);
                      const childDecks = decks.filter((d) => d.collectionId === childCol.id);
                      return (
                        <motion.div
                          key={childCol.id}
                          variants={fadeInUp}
                          onClick={() => setCurrentCollectionId(childCol.id)}
                          className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
                                <Folder className="w-4 h-4" />
                              </div>
                              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  title="Move folder"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovingResource({ type: "collection", id: childCol.id, title: childCol.name });
                                    setIsMoveSelectorOpen(true);
                                  }}
                                  className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded"
                                >
                                  <MoveRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  title="Delete folder"
                                  onClick={(e) => handleDeleteCollection(childCol.id, e)}
                                  className="p-1 text-zinc-400 hover:text-red-600 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">{childCol.name}</h4>
                            <p className="text-[11px] text-zinc-500 line-clamp-2">{childCol.description || "Folder"}</p>
                          </div>

                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                            <span>{childNotes.length} Notes • {childDecks.length} Decks</span>
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </div>

              {/* Resources Section (Notes, Decks, Tests) */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-zinc-400" />
                  <span>Resources in Folder ({currentNotes.length + currentDecks.length + currentTests.length})</span>
                </h3>

                {currentNotes.length === 0 && currentDecks.length === 0 && currentTests.length === 0 ? (
                  <EmptyState message="No resources saved directly in this folder yet. Use the buttons above to create notes, flashcards, or practice tests here." />
                ) : (
                  <motion.div
                    variants={staggerContainer()}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  >
                    {/* Notes in folder */}
                    {currentNotes.map((note) => (
                      <motion.div
                        key={note.id}
                        variants={fadeInUp}
                        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                              <FileText className="w-3 h-3" />
                              <span>Note</span>
                            </span>
                            <div className="flex items-center space-x-1">
                              <button
                                title="Move Note to another folder"
                                onClick={() => {
                                  setMovingResource({ type: "note", id: note.id, title: note.title });
                                  setIsMoveSelectorOpen(true);
                                }}
                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              >
                                <MoveRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Delete Note"
                                onClick={(e) => handleDeleteNote(note.id, e)}
                                className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">{note.title}</h4>
                          <p className="text-xs text-zinc-500">{note.subject} • {note.sections.length} topics</p>
                        </div>

                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                          <button
                            onClick={() => onOpenNoteStudio(note)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold"
                          >
                            Open Note
                          </button>
                        </div>
                      </motion.div>
                    ))}

                    {/* Decks in folder */}
                    {currentDecks.map((deck) => (
                      <motion.div
                        key={deck.id}
                        variants={fadeInUp}
                        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                              <Layers className="w-3 h-3" />
                              <span>Flashcard Deck</span>
                            </span>
                            <div className="flex items-center space-x-1">
                              <button
                                title="Move Deck to another folder"
                                onClick={() => {
                                  setMovingResource({ type: "deck", id: deck.id, title: deck.title });
                                  setIsMoveSelectorOpen(true);
                                }}
                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              >
                                <MoveRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Delete Deck"
                                onClick={(e) => handleDeleteDeck(deck.id, e)}
                                className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">{deck.title}</h4>
                          <p className="text-xs text-zinc-500">{deck.subject} • {deck.cardCount || 0} cards</p>
                        </div>

                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between space-x-2">
                          <button
                            onClick={() => onOpenFlashcardDeck(deck)}
                            className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            Edit Cards
                          </button>
                          <button
                            onClick={() => onStudyFlashcardDeck(deck)}
                            className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold"
                          >
                            Study Deck
                          </button>
                        </div>
                      </motion.div>
                    ))}

                    {/* Tests in folder */}
                    {currentTests.map((test) => (
                      <motion.div
                        key={test.id}
                        variants={fadeInUp}
                        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center space-x-1">
                              <CheckSquare className="w-3 h-3" />
                              <span>Practice Test</span>
                            </span>
                            <div className="flex items-center space-x-1">
                              <button
                                title="Move Test to another folder"
                                onClick={() => {
                                  setMovingResource({ type: "test", id: test.id, title: test.noteTitle });
                                  setIsMoveSelectorOpen(true);
                                }}
                                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              >
                                <MoveRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="Delete Test"
                                onClick={(e) => handleDeleteTest(test.id, e)}
                                className="p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-white line-clamp-1">{test.noteTitle}</h4>
                          <p className="text-xs text-zinc-500">{test.subject} • {test.questions.length} questions</p>
                        </div>

                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                          <button
                            onClick={() => onOpenTest(test)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold"
                          >
                            Take Test
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT COLLECTION MODAL */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} panelClassName="max-w-md">
          <form
            onSubmit={handleSaveCollectionForm}
            className="p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              {editingCol ? "Rename / Edit Folder" : "Create New Study Folder"}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Computer Networks, Unit 1, GATE Prep..."
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  placeholder="Short description or syllabus scope..."
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!colName.trim()}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold disabled:opacity-50"
              >
                {editingCol ? "Save Changes" : "Create Folder"}
              </button>
            </div>
          </form>
      </Modal>

      {/* MOVE RESOURCE SELECTOR MODAL */}
      <CollectionSelectorModal
        isOpen={isMoveSelectorOpen}
        onClose={() => setIsMoveSelectorOpen(false)}
        title={`Move "${movingResource?.title}" to Folder`}
        selectedCollectionId={currentCollectionId}
        onSelectCollection={handleMoveResourceConfirm}
      />

      {/* PUBLISH COLLECTION MODAL */}
      <PublishModal
        isOpen={!!publishingCol}
        onClose={() => setPublishingCol(null)}
        onSuccess={reloadData}
        preselectedCollection={publishingCol}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={Boolean(itemToDelete)}
        title={`Delete ${
          itemToDelete?.type === "collection"
            ? "Folder"
            : itemToDelete?.type === "note"
            ? "Note"
            : itemToDelete?.type === "deck"
            ? "Flashcard Deck"
            : "Practice Test"
        }?`}
        message={`Are you sure you want to delete "${itemToDelete?.name}"? This action cannot be undone and all associated items will be deleted.`}
        confirmText="Delete"
        onConfirm={confirmDeleteItem}
        onClose={() => setItemToDelete(null)}
      />
    </div>
  );
};
