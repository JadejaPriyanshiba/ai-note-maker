import React, { useState } from "react";
import { Bookmark, Plus, X, Trash2 } from "lucide-react";

interface PresetLike {
  id: string;
  name: string;
}

interface PresetPickerProps<T extends PresetLike> {
  label: string;
  presets: T[];
  onLoad: (preset: T) => void;
  onSaveNew: (name: string) => void;
  onDelete: (id: string) => void;
}

// Generic "load a saved preset / save current settings as a new one" control, shared by the notes
// intake wizard and Shorts Hub setup — the interaction is identical in both, only the underlying
// settings shape (and therefore T) differs.
export function PresetPicker<T extends PresetLike>({ label, presets, onLoad, onSaveNew, onDelete }: PresetPickerProps<T>) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");

  function confirmSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSaveNew(trimmed);
    setName("");
    setIsSaving(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {presets.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => {
              const preset = presets.find((p) => p.id === e.target.value);
              if (preset) onLoad(preset);
              e.target.value = "";
            }}
            className="flex-1 min-w-0 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
          >
            <option value="" disabled>
              {label}: load a saved preset...
            </option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setIsSaving((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Save as preset
        </button>
      </div>

      {isSaving && (
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), confirmSave())}
            placeholder="Name this preset..."
            autoFocus
            className="flex-1 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-white outline-none"
          />
          <button
            type="button"
            onClick={confirmSave}
            disabled={!name.trim()}
            className="shrink-0 px-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSaving(false);
              setName("");
            }}
            className="shrink-0 p-2 rounded-xl text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 text-[11px] font-medium text-zinc-500 dark:text-zinc-400"
            >
              <Bookmark className="w-3 h-3" />
              {p.name}
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                title="Delete this preset"
                className="p-0.5 rounded-full hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
