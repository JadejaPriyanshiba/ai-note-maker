import React, { useState } from "react";
import { motion } from "motion/react";
import { NoteDocument } from "../types";
import { getSavedNotes, deleteNote, saveNote } from "../lib/storage";
import { FolderKanban, Search, Trash2, Edit3, CheckSquare, Sparkles, Star, GitFork, Plus } from "lucide-react";
import { ConfirmModal } from "./ConfirmModal";
import { EmptyState } from "./EmptyState";
import { fadeInUp, staggerContainer } from "../lib/motion";

interface NotesListViewProps {
  onOpenNoteStudio: (note: NoteDocument) => void;
  onOpenTest: (note: NoteDocument) => void;
  onOpenAudio: (note: NoteDocument) => void;
  onCreateNew: () => void;
}

export const NotesListView: React.FC<NotesListViewProps> = ({
  onOpenNoteStudio,
  onOpenTest,
  onOpenAudio,
  onCreateNew,
}) => {
  const [notes, setNotes] = useState<NoteDocument[]>(getSavedNotes());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
  const [noteToDelete, setNoteToDelete] = useState<NoteDocument | null>(null);

  const handleDeleteClick = (note: NoteDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteToDelete(note);
  };

  const confirmDeleteNote = () => {
    if (!noteToDelete) return;
    deleteNote(noteToDelete.id);
    setNotes(notes.filter((n) => n.id !== noteToDelete.id));
    setNoteToDelete(null);
  };

  const handleToggleFavorite = (note: NoteDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...note, favorite: !note.favorite };
    saveNote(updated);
    setNotes(notes.map((n) => (n.id === note.id ? updated : n)));
  };

  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = !filterFavorite || Boolean(n.favorite);
    return matchesSearch && matchesFav;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            My Notes Library
          </span>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            My Study Notes ({notes.length})
          </h1>
        </div>

        <button
          onClick={onCreateNew}
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs shadow-sm flex items-center space-x-2 shrink-0 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Note</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes by title or subject..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        <button
          onClick={() => setFilterFavorite(!filterFavorite)}
          className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center space-x-1.5 border transition-colors ${
            filterFavorite
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
              : "bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${filterFavorite ? "fill-current" : ""}`} />
          <span>Favorites Only</span>
        </button>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length > 0 ? (
        <motion.div
          variants={staggerContainer()}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredNotes.map((note) => {
            const completedCount = (note.roadmap || []).filter((t) => t.status === "completed").length;
            const totalCount = (note.roadmap || []).length;
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            return (
              <motion.div
                key={note.id}
                variants={fadeInUp}
                onClick={() => onOpenNoteStudio(note)}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:shadow-md hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-medium uppercase">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                      {note.subject}
                    </span>
                    <button
                      onClick={(e) => handleToggleFavorite(note, e)}
                      className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                    >
                      <Star className={`w-4 h-4 ${note.favorite ? "fill-zinc-800 text-zinc-800 dark:fill-zinc-200 dark:text-zinc-200" : ""}`} />
                    </button>
                  </div>

                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {note.title}
                  </h3>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-light text-zinc-500 dark:text-zinc-400">
                      <span>{completedCount} / {totalCount} Topics Generated</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenAudio(note); }}
                      className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      title="Audio Learning"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenTest(note); }}
                      className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      title="Take Test"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={(e) => handleDeleteClick(note, e)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <EmptyState icon={FolderKanban} message="No matching study notes found." />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(noteToDelete)}
        title="Delete Study Note?"
        message={`Are you sure you want to delete "${noteToDelete?.title}"? This note and all nested flashcard decks and practice tests generated from it will be permanently deleted.`}
        confirmText="Delete Note"
        onConfirm={confirmDeleteNote}
        onClose={() => setNoteToDelete(null)}
      />
    </div>
  );
};
