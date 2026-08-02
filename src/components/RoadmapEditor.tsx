import React, { useState } from "react";
import { motion } from "motion/react";
import { RoadmapTopic, LearnerLevel, Complexity, Depth, NoteLanguage } from "../types";
import { ArrowUp, ArrowDown, Trash2, Plus, Copy, Sparkles, Play, Layers } from "lucide-react";
import { suggestTopics } from "../lib/aiService";
import { fadeInUp, staggerContainer } from "../lib/motion";

interface RoadmapEditorProps {
  subject: string;
  learnerLevel: LearnerLevel;
  complexity: Complexity;
  depth: Depth;
  language: NoteLanguage;
  instructions?: string;
  initialTopics: { title: string; description: string; estimatedMinutes?: number }[];
  onStartGeneration: (
    topics: RoadmapTopic[],
    batchSize: number
  ) => void;
  onCancel: () => void;
}

export const RoadmapEditor: React.FC<RoadmapEditorProps> = ({
  subject,
  learnerLevel,
  complexity,
  depth,
  language,
  instructions,
  initialTopics,
  onStartGeneration,
  onCancel,
}) => {
  const [topics, setTopics] = useState<RoadmapTopic[]>(
    initialTopics.map((t, index) => ({
      id: `top_${Date.now()}_${index}`,
      title: t.title,
      description: t.description,
      estimatedMinutes: t.estimatedMinutes || 15,
      status: "pending",
    }))
  );

  const [batchSize, setBatchSize] = useState<number>(1);
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleMove = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === topics.length - 1)) return;
    const newTopics = [...topics];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = newTopics[index];
    newTopics[index] = newTopics[targetIdx];
    newTopics[targetIdx] = temp;
    setTopics(newTopics);
  };

  const handleDelete = (id: string) => {
    setTopics(topics.filter((t) => t.id !== id));
  };

  const handleDuplicate = (topic: RoadmapTopic) => {
    const idx = topics.findIndex((t) => t.id === topic.id);
    const newTopic: RoadmapTopic = {
      ...topic,
      id: `top_${Date.now()}_dup`,
      title: `${topic.title} (Part 2)`,
    };
    const updated = [...topics];
    updated.splice(idx + 1, 0, newTopic);
    setTopics(updated);
  };

  const handleAddTopic = () => {
    const newTopic: RoadmapTopic = {
      id: `top_${Date.now()}_new`,
      title: "New Custom Study Topic",
      description: "Enter a brief summary of concepts covered in this section.",
      estimatedMinutes: 15,
      status: "pending",
    };
    setTopics([...topics, newTopic]);
    setEditingId(newTopic.id);
  };

  const handleAISuggest = async () => {
    try {
      setIsSuggesting(true);
      const existingTitles = topics.map((t) => t.title);
      const suggestions = await suggestTopics(subject, existingTitles);
      const formatted: RoadmapTopic[] = suggestions.map((s, idx) => ({
        id: `top_sugg_${Date.now()}_${idx}`,
        title: s.title,
        description: s.description,
        estimatedMinutes: s.estimatedMinutes || 15,
        status: "pending",
      }));
      setTopics([...topics, ...formatted]);
    } catch (err: any) {
      alert(err.message || "Could not fetch topic suggestions");
    } finally {
      setIsSuggesting(false);
    }
  };

  const updateTopic = (id: string, field: "title" | "description", value: string) => {
    setTopics(
      topics.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-lg max-w-4xl mx-auto my-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
              Step 2 of 3
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-light">
              {subject} • {learnerLevel} Level
            </span>
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
            Review & Edit Learning Roadmap
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light">
            Reorder, edit, or add topics before starting AI note generation.
          </p>
        </div>

        {/* Batch Size Selection */}
        <div className="bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center space-x-3">
          <Layers className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
          <div>
            <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
              Generation Batch Size
            </label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="mt-0.5 bg-white dark:bg-zinc-900 text-xs font-light border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-zinc-400"
            >
              <option value={1}>1 topic / request (Recommended Default)</option>
              <option value={2}>2 topics / request</option>
              <option value={3}>3 topics / request</option>
            </select>
          </div>
        </div>
      </div>

      {/* Topic List */}
      <motion.div
        variants={staggerContainer(0.04)}
        initial="hidden"
        animate="show"
        className="space-y-3 max-h-[500px] overflow-y-auto pr-2"
      >
        {topics.map((topic, index) => (
          <motion.div
            key={topic.id}
            layout
            variants={fadeInUp}
            transition={{ layout: { duration: 0.2, ease: "easeOut" } }}
            className={`p-4 rounded-2xl border transition-colors ${
              editingId === topic.id
                ? "border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/50"
                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-3 mt-1">
                <span className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
              </div>

              {/* Title & Description Fields */}
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={topic.title}
                  onChange={(e) => updateTopic(topic.id, "title", e.target.value)}
                  placeholder="Topic title..."
                  className="w-full font-medium text-sm text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none px-1 py-0.5"
                />
                <textarea
                  value={topic.description}
                  onChange={(e) => updateTopic(topic.id, "description", e.target.value)}
                  placeholder="Topic summary..."
                  rows={2}
                  className="w-full text-xs font-light text-zinc-600 dark:text-zinc-400 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none px-1 py-0.5 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMove(index, "up")}
                  disabled={index === 0}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 disabled:opacity-30"
                  title="Move Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(index, "down")}
                  disabled={index === topics.length - 1}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 disabled:opacity-30"
                  title="Move Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicate(topic)}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
                  title="Duplicate Topic"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(topic.id)}
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
                  title="Delete Topic"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Add Topic Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleAddTopic}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Topic</span>
          </button>

          <button
            type="button"
            onClick={handleAISuggest}
            disabled={isSuggesting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSuggesting ? "Suggesting..." : "AI Suggest Topics"}</span>
          </button>
        </div>

        <span className="text-xs font-light text-zinc-500 dark:text-zinc-400">
          Total Topics: {topics.length}
        </span>
      </div>

      {/* Footer Action Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={() => onStartGeneration(topics, batchSize)}
          disabled={topics.length === 0}
          className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs shadow-md flex items-center space-x-2 transition-all disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Approve & Generate Notes</span>
        </button>
      </div>
    </div>
  );
};
