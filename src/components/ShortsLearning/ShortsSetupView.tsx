import React, { useState } from "react";
import { motion } from "motion/react";
import { Film, Sparkles, Loader2, FolderTree, CloudUpload, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { LearningTree } from "../../types";
import { generateLearningTree, getOrderedLeafNodes } from "../../lib/learningService";
import { getLearningTrees, saveLearningTree, deleteLearningTree, migrateLocalDataToCloud } from "../../lib/storage";
import { useAuth } from "../../lib/AuthContext";
import { fadeInUp, staggerContainer } from "../../lib/motion";
import { ConfirmModal } from "../ConfirmModal";

interface ShortsSetupViewProps {
  onGenerated: (tree: LearningTree) => void;
}

export const ShortsSetupView: React.FC<ShortsSetupViewProps> = ({ onGenerated }) => {
  const { user, syncing, setSyncing } = useAuth();
  const [existingTrees, setExistingTrees] = useState<LearningTree[]>(() => getLearningTrees());
  const [mainTopic, setMainTopic] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [depth, setDepth] = useState(3);
  const [language, setLanguage] = useState("English");
  const [difficulty, setDifficulty] = useState("Mixed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSynced, setJustSynced] = useState(false);
  const [treeToDelete, setTreeToDelete] = useState<LearningTree | null>(null);

  const handleSyncTrees = async () => {
    if (!user) return;
    setSyncing(true);
    setJustSynced(false);
    try {
      await migrateLocalDataToCloud(user.uid);
      setJustSynced(true);
    } catch {
      // errors are non-fatal here; the full Settings sync panel surfaces details
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteTree = (tree: LearningTree, e: React.MouseEvent) => {
    e.stopPropagation();
    setTreeToDelete(tree);
  };

  const confirmDeleteTree = () => {
    if (!treeToDelete) return;
    deleteLearningTree(treeToDelete.id);
    setExistingTrees((prev) => prev.filter((t) => t.id !== treeToDelete.id));
    setTreeToDelete(null);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainTopic.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const { topic, nodes } = await generateLearningTree({
        mainTopic: mainTopic.trim(),
        topicDescription: topicDescription.trim() || undefined,
        depth,
        language,
        difficulty,
      });

      const tree: LearningTree = {
        id: `lt_${Date.now()}`,
        userId: "",
        rootTopicId: mainTopic.trim(),
        title: topic || mainTopic.trim(),
        subject: mainTopic.trim(),
        depth,
        nodes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveLearningTree(tree);
      onGenerated(tree);
    } catch (err: any) {
      setError(err.message || "Failed to generate the learning tree. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {existingTrees.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-1.5">
              <FolderTree className="w-4 h-4" />
              <span>Your Learning Trees</span>
            </h2>
            {user && (
              <button
                type="button"
                onClick={handleSyncTrees}
                disabled={syncing}
                title="Push any trees created on this device (including before cloud sync existed) up to the cloud"
                className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 transition-colors"
              >
                {syncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : justSynced ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                <span>{syncing ? "Syncing..." : justSynced ? "Synced" : "Sync to Cloud"}</span>
              </button>
            )}
          </div>
          <motion.div variants={staggerContainer()} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {existingTrees.slice(0, 6).map((t) => (
              <motion.div
                key={t.id}
                variants={fadeInUp}
                onClick={() => onGenerated(t)}
                className="group relative text-left p-3 pr-9 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xs transition-all cursor-pointer"
              >
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{t.title}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  {getOrderedLeafNodes(t.nodes).length} items • Depth {t.depth}
                </p>
                <button
                  type="button"
                  onClick={(e) => handleDeleteTree(t, e)}
                  title="Delete this learning tree"
                  className="absolute top-2 right-2 p-1 rounded-lg text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="relative overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 sm:p-10 shadow-sm space-y-6"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-20 w-80 h-80 rounded-full bg-zinc-200/70 dark:bg-zinc-700/20 blur-3xl"
        />

        <div className="relative z-10 space-y-3 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">
            <Film className="w-3.5 h-3.5" />
            <span>Shorts Learning</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-zinc-900 dark:text-white">
            What do you want to learn today?
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            AI breaks your topic into a learning tree of focused subtopics. We'll then find short YouTube videos
            for each one — a focused, swipeable feed built to actually teach you, not distract you.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="relative z-10 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Topic *</label>
            <input
              type="text"
              value={mainTopic}
              onChange={(e) => setMainTopic(e.target.value)}
              placeholder="e.g. Unsupervised Learning, Thermodynamics, React Hooks..."
              required
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Additional Context (Optional)
            </label>
            <input
              type="text"
              value={topicDescription}
              onChange={(e) => setTopicDescription(e.target.value)}
              placeholder="e.g. Focus on the intuition, exam-relevant subtopics..."
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="block font-bold text-zinc-700 dark:text-zinc-300">Tree Depth</label>
              <select
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
              >
                <option value={2}>2 levels</option>
                <option value={3}>3 levels (Recommended)</option>
                <option value={4}>4 levels</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-zinc-700 dark:text-zinc-300">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Gujarati">Gujarati</option>
                <option value="Hinglish">Hinglish</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-zinc-700 dark:text-zinc-300">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating || !mainTopic.trim()}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold text-sm shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 fill-current" />
              )}
              <span>{isGenerating ? "Building Learning Tree..." : "Generate Learning Tree"}</span>
            </button>
          </div>
        </form>
      </motion.div>

      <ConfirmModal
        isOpen={Boolean(treeToDelete)}
        title="Delete Learning Tree?"
        message={`Are you sure you want to delete "${treeToDelete?.title}"? All progress and saved videos for it will be permanently deleted.`}
        confirmText="Delete Tree"
        onConfirm={confirmDeleteTree}
        onClose={() => setTreeToDelete(null)}
      />
    </div>
  );
};
