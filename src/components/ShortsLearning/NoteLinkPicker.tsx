import React, { useMemo, useState } from "react";
import { Search, FileText, X } from "lucide-react";
import { Modal } from "../Modal";
import { NoteDocument } from "../../types";
import { getSavedNotes } from "../../lib/storage";

interface NoteLinkPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (note: NoteDocument) => void;
}

// Lets a Shorts Hub creation borrow settings/context from an existing text note — a one-time
// prefill, not a persisted link, so this never writes anything back to the note.
export const NoteLinkPicker: React.FC<NoteLinkPickerProps> = ({ isOpen, onClose, onSelect }) => {
  const [query, setQuery] = useState("");
  const notes = useMemo(() => (isOpen ? getSavedNotes() : []), [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...notes].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    if (!q) return sorted;
    return sorted.filter((n) => n.title.toLowerCase().includes(q) || n.subject.toLowerCase().includes(q));
  }, [notes, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} panelClassName="max-w-lg">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">Link an existing note</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              We'll prefill the topic and settings from that note — nothing is saved back to it.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950">
          <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your notes..."
            className="w-full bg-transparent py-2.5 text-xs font-medium text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
          />
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-zinc-400 italic py-4 text-center">
              {notes.length === 0 ? "You don't have any notes yet." : "No notes match your search."}
            </p>
          )}
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                onSelect(n);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{n.title}</p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {n.subject} • {n.learnerLevel} • {n.complexity}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};
