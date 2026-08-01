import React, { useState } from "react";
import { X, Clock, SlidersHorizontal, Play, Film } from "lucide-react";
import { LearningSessionFilter } from "../../types";

interface SessionSetupModalProps {
  leafCount: number;
  onCancel: () => void;
  onStart: (timeLimitMinutes: number, filters: LearningSessionFilter) => void;
}

const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
const SHORT_DURATION_OPTIONS = [30, 45, 60, 90];

const DEFAULT_FILTERS: LearningSessionFilter = {
  language: "Any",
  difficulty: "Mixed",
  duration: "Any",
  content: "Any",
  freshness: "Any",
  contentFormat: "long",
  shortsMaxDurationSeconds: 60,
};

const CONTENT_FORMAT_OPTIONS: { value: LearningSessionFilter["contentFormat"]; label: string; hint: string }[] = [
  { value: "long", label: "Long-form", hint: "Regular-length videos" },
  { value: "hybrid", label: "Hybrid", hint: "Mix of both" },
  { value: "short", label: "Short-form", hint: "Vertical, quick videos" },
];

export const SessionSetupModal: React.FC<SessionSetupModalProps> = ({ leafCount, onCancel, onStart }) => {
  const [timeLimit, setTimeLimit] = useState<number>(20);
  const [customTime, setCustomTime] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filters, setFilters] = useState<LearningSessionFilter>(DEFAULT_FILTERS);
  const [useCustomShortLength, setUseCustomShortLength] = useState(false);

  const effectiveTime = useCustom ? Math.max(1, Number(customTime) || 0) : timeLimit;
  const estimatedNodes = Math.max(1, Math.min(leafCount, Math.round(effectiveTime / 5)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Start Learning Session</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light mt-0.5">
              {leafCount} learning item{leafCount === 1 ? "" : "s"} available in this tree.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <Clock className="w-3.5 h-3.5" />
            <span>Session Length</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TIME_OPTIONS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setTimeLimit(mins);
                  setUseCustom(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  !useCustom && timeLimit === mins
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {mins} min
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUseCustom(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                useCustom
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                  : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              Custom
            </button>
            {useCustom && (
              <input
                type="number"
                min={1}
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                placeholder="Minutes"
                className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-light">
            ~{estimatedNodes} of {leafCount} topics estimated for this session (adjusts as real video durations load).
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center space-x-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <Film className="w-3.5 h-3.5" />
            <span>Content Format</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CONTENT_FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilters({ ...filters, contentFormat: opt.value })}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border text-center transition-colors ${
                  filters.contentFormat === opt.value
                    ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800"
                    : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                }`}
              >
                <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{opt.label}</span>
                <span className="text-[10px] font-normal text-zinc-500 dark:text-zinc-400">{opt.hint}</span>
              </button>
            ))}
          </div>

          {filters.contentFormat === "short" && (
            <div className="pt-1 space-y-1.5">
              <p className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">Max short-form length</p>
              <div className="flex flex-wrap gap-2">
                {SHORT_DURATION_OPTIONS.map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => {
                      setUseCustomShortLength(false);
                      setFilters({ ...filters, shortsMaxDurationSeconds: secs });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      !useCustomShortLength && filters.shortsMaxDurationSeconds === secs
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                        : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {secs}s
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setUseCustomShortLength(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    useCustomShortLength
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  Custom
                </button>
                {useCustomShortLength && (
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={filters.shortsMaxDurationSeconds ?? 60}
                    onChange={(e) => setFilters({ ...filters, shortsMaxDurationSeconds: Number(e.target.value) || 60 })}
                    placeholder="Seconds"
                    className="w-24 px-2.5 py-1.5 rounded-lg text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center space-x-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{showAdvanced ? "Hide" : "Show"} Advanced Filters</span>
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
              <div className="space-y-1">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">Language</label>
                <select
                  value={filters.language}
                  onChange={(e) => setFilters({ ...filters, language: e.target.value as LearningSessionFilter["language"] })}
                  className="w-full p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                >
                  {["Any", "English", "Hindi", "Gujarati", "Hinglish"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">Difficulty</label>
                <select
                  value={filters.difficulty}
                  onChange={(e) => setFilters({ ...filters, difficulty: e.target.value as LearningSessionFilter["difficulty"] })}
                  className="w-full p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                >
                  {["Mixed", "Beginner", "Intermediate", "Advanced"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">Duration</label>
                <select
                  value={filters.duration}
                  onChange={(e) => setFilters({ ...filters, duration: e.target.value as LearningSessionFilter["duration"] })}
                  disabled={filters.contentFormat !== "long"}
                  className="w-full p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 disabled:opacity-40"
                >
                  {["Any", "< 1 min", "1–3 min", "3–5 min", "5–10 min"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                {filters.contentFormat === "short" && (
                  <p className="text-[10px] text-zinc-400">Controlled by the short-form length above</p>
                )}
                {filters.contentFormat === "hybrid" && (
                  <p className="text-[10px] text-zinc-400">Not applied in Hybrid mode</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">Content Type</label>
                <select
                  value={filters.content}
                  onChange={(e) => setFilters({ ...filters, content: e.target.value as LearningSessionFilter["content"] })}
                  className="w-full p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                >
                  {["Any", "Explanation", "Tutorial", "Visual", "Example", "Revision", "Exam preparation", "Project/application"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="block font-medium text-zinc-700 dark:text-zinc-300">Freshness</label>
                <select
                  value={filters.freshness}
                  onChange={(e) => setFilters({ ...filters, freshness: e.target.value as LearningSessionFilter["freshness"] })}
                  className="w-full p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                >
                  {["Any", "Last 7 days", "Last 30 days", "Last year"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(effectiveTime, filters)}
            disabled={effectiveTime <= 0}
            className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs shadow-md flex items-center space-x-2 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Learning</span>
          </button>
        </div>
      </div>
    </div>
  );
};
