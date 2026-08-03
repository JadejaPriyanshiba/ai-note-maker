import React, { useState, useEffect } from "react";
import { Folder, FolderPlus, ChevronRight, Check, X, Layers, Plus } from "lucide-react";
import { Collection } from "../../types";
import { getCollections, saveCollection, getCollectionPath } from "../../lib/storage";
import { Modal } from "../Modal";

interface CollectionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
  title?: string;
}

export const CollectionSelectorModal: React.FC<CollectionSelectorModalProps> = ({
  isOpen,
  onClose,
  selectedCollectionId,
  onSelectCollection,
  title = "Select Collection",
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeParentId, setActiveParentId] = useState<string | null>(selectedCollectionId);
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const allCols = getCollections();
    setCollections(allCols);
    setIsCreatingInline(false);
    setNewColName("");
    setNewColDesc("");
  }, [isOpen]);

  const currentPath = getCollectionPath(activeParentId, collections);
  const childCollections = collections.filter((c) => c.parentCollectionId === activeParentId);

  const handleCreateNewCol = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    const newCol: Collection = {
      id: `col_${Date.now()}`,
      ownerId: "user_local_1",
      parentCollectionId: activeParentId,
      name: newColName.trim(),
      description: newColDesc.trim(),
      icon: "folder",
      color: "zinc",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveCollection(newCol);
    const updated = getCollections();
    setCollections(updated);
    setActiveParentId(newCol.id);
    setIsCreatingInline(false);
    setNewColName("");
    setNewColDesc("");
  };

  const handleConfirm = () => {
    onSelectCollection(activeParentId);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} panelClassName="max-w-lg p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <Folder className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            <h3 className="font-bold text-base text-zinc-900 dark:text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb Path inside Modal */}
        <div className="flex items-center space-x-1 overflow-x-auto py-1 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
          <button
            onClick={() => setActiveParentId(null)}
            className={`px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
              activeParentId === null ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold" : ""
            }`}
          >
            Root (Unorganized)
          </button>

          {currentPath.map((col) => (
            <React.Fragment key={col.id}>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <button
                onClick={() => setActiveParentId(col.id)}
                className={`px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap ${
                  activeParentId === col.id ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold" : ""
                }`}
              >
                {col.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Folder Navigation List */}
        {!isCreatingInline ? (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                {activeParentId ? "Sub-folders" : "Root Folders"}
              </span>
              <button
                onClick={() => setIsCreatingInline(true)}
                className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center space-x-1"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>+ New Folder Here</span>
              </button>
            </div>

            {childCollections.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-dashed border-zinc-200 dark:border-zinc-700">
                <p className="text-xs text-zinc-500">No folders here yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {childCollections.map((col) => (
                  <div
                    key={col.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      activeParentId === col.id
                        ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-600"
                        : "bg-zinc-50/50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                    onClick={() => setActiveParentId(col.id)}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <Folder className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{col.name}</p>
                        {col.description && (
                          <p className="text-[11px] text-zinc-500 truncate">{col.description}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Inline New Folder Form */
          <form onSubmit={handleCreateNewCol} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-3">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Create New Folder inside "{activeParentId ? currentPath[currentPath.length - 1]?.name : 'Root'}"</h4>
            <div>
              <input
                type="text"
                placeholder="Folder Name (e.g. Unit 1 - OSI Model)"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Description (optional)"
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium focus:ring-1 focus:ring-zinc-400 outline-none"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingInline(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newColName.trim()}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold disabled:opacity-50"
              >
                Create & Select
              </button>
            </div>
          </form>
        )}

        {/* Footer Confirmation */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Selected: <strong className="text-zinc-900 dark:text-white">{activeParentId ? currentPath[currentPath.length - 1]?.name : "Root (Unorganized)"}</strong>
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold flex items-center space-x-1.5 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select Destination</span>
            </button>
          </div>
        </div>
    </Modal>
  );
};
