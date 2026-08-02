import React, { useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Play,
  X,
  RotateCcw,
  EyeOff,
  Eye,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Bookmark,
  SkipForward,
  StickyNote,
  ExternalLink,
  Clock,
} from "lucide-react";
import { LearningNode, LearningTree, LearningSession, LearningSessionFilter, SavedLearningResource } from "../../types";
import {
  saveLearningTree,
  deleteLearningTree,
  getActiveLearningSession,
  getLearningSessions,
  getSavedLearningResources,
  deleteSavedLearningResource,
} from "../../lib/storage";
import { buildTreeFromFlat, getOrderedLeafNodes, generateLearningTree, regenerateNodeKeywords } from "../../lib/learningService";
import { SessionSetupModal } from "./SessionSetupModal";

type NestedNode = Omit<LearningNode, "children"> & { children: NestedNode[] };

interface LearningMapViewProps {
  tree: LearningTree;
  onTreeChange: (tree: LearningTree) => void;
  onStartSession: (tree: LearningTree, timeLimitMinutes: number, filters: LearningSessionFilter) => void;
  onResumeSession: (tree: LearningTree, session: LearningSession) => void;
  onBack: () => void;
  onTreeDeleted: () => void;
  onStartRevision: (resources: SavedLearningResource[]) => void;
}

function newNodeId(): string {
  return `ln_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const LearningMapView: React.FC<LearningMapViewProps> = ({
  tree,
  onTreeChange,
  onStartSession,
  onResumeSession,
  onBack,
  onTreeDeleted,
  onStartRevision,
}) => {
  const [nodes, setNodes] = useState<LearningNode[]>(tree.nodes);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(nodes.map((n) => n.id)));
  const [regeneratingKeywordsId, setRegeneratingKeywordsId] = useState<string | null>(null);
  const [keywordDraft, setKeywordDraft] = useState<Record<string, string>>({});
  const [depthChoice, setDepthChoice] = useState(tree.depth);
  const [isRegeneratingTree, setIsRegeneratingTree] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [showSessionSetup, setShowSessionSetup] = useState(false);

  const nestedTree = useMemo(() => buildTreeFromFlat(nodes), [nodes]);
  const leafNodes = useMemo(() => getOrderedLeafNodes(nodes), [nodes]);

  const latestSession = useMemo(() => {
    const sessions = getLearningSessions().filter((s) => s.treeId === tree.id);
    if (sessions.length === 0) return null;
    return sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
  }, [tree.id]);
  const activeSession = useMemo(() => getActiveLearningSession(tree.id), [tree.id]);

  const [savedResources, setSavedResources] = useState<SavedLearningResource[]>(() => {
    const treeNodeIds = new Set(tree.nodes.map((n) => n.id));
    return getSavedLearningResources()
      .filter((r) => treeNodeIds.has(r.learningNodeId))
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  });
  const [showSavedSection, setShowSavedSection] = useState(true);
  const savedResourceNodeIds = useMemo(() => new Set(savedResources.map((r) => r.learningNodeId)), [savedResources]);

  function handleRemoveSavedResource(id: string) {
    if (!window.confirm("Remove this saved video and its notes? This cannot be undone.")) return;
    deleteSavedLearningResource(id);
    setSavedResources((prev) => prev.filter((r) => r.id !== id));
  }

  function persist(updated: LearningNode[]) {
    setNodes(updated);
    const updatedTree: LearningTree = { ...tree, nodes: updated };
    saveLearningTree(updatedTree);
    onTreeChange(updatedTree);
  }

  function updateNode(id: string, patch: Partial<LearningNode>) {
    persist(nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteNode(id: string) {
    const idsToDelete = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (!idsToDelete.has(n.id) && n.parentId && idsToDelete.has(n.parentId)) {
          idsToDelete.add(n.id);
          changed = true;
        }
      }
    }
    persist(nodes.filter((n) => !idsToDelete.has(n.id)));
  }

  function addNode(parentId: string | null, depth: number) {
    const siblings = nodes.filter((n) => n.parentId === parentId);
    const node: LearningNode = {
      id: newNodeId(),
      parentId,
      title: "New Topic",
      description: "",
      keywords: [],
      depth,
      order: siblings.length,
    };
    persist([...nodes, node]);
    if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
  }

  function moveNode(id: string, direction: "up" | "down") {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const siblings = nodes.filter((n) => n.parentId === node.parentId).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((n) => n.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[swapIdx];
    persist(nodes.map((n) => (n.id === a.id ? { ...n, order: b.order } : n.id === b.id ? { ...n, order: a.order } : n)));
  }

  function toggleSkip(id: string) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    updateNode(id, { skipped: !node.skipped });
  }

  function addKeyword(id: string) {
    const draft = (keywordDraft[id] || "").trim();
    if (!draft) return;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    updateNode(id, { keywords: [...node.keywords, draft] });
    setKeywordDraft((prev) => ({ ...prev, [id]: "" }));
  }

  function removeKeyword(id: string, index: number) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    updateNode(id, { keywords: node.keywords.filter((_, i) => i !== index) });
  }

  async function handleRegenerateKeywords(node: LearningNode) {
    setRegeneratingKeywordsId(node.id);
    setRegenError(null);
    try {
      const keywords = await regenerateNodeKeywords({
        nodeTitle: node.title,
        nodeDescription: node.description,
        existingKeywords: node.keywords,
      });
      updateNode(node.id, { keywords });
    } catch (err: any) {
      setRegenError(err.message || "Failed to regenerate keywords. Please try again.");
    } finally {
      setRegeneratingKeywordsId(null);
    }
  }

  async function handleRegenerateTree() {
    setIsRegeneratingTree(true);
    setRegenError(null);
    setConfirmRegenerate(false);
    try {
      const result = await generateLearningTree({ mainTopic: tree.subject, depth: depthChoice });
      const updatedTree: LearningTree = {
        ...tree,
        nodes: result.nodes,
        depth: depthChoice,
        title: result.topic || tree.title,
      };
      saveLearningTree(updatedTree);
      setNodes(result.nodes);
      setExpandedIds(new Set(result.nodes.map((n) => n.id)));
      onTreeChange(updatedTree);
    } catch (err: any) {
      setRegenError(err.message || "Failed to regenerate the learning tree. Your existing tree was not changed.");
    } finally {
      setIsRegeneratingTree(false);
    }
  }

  function handleDeleteTree() {
    if (!window.confirm(`Delete "${tree.title}" and all its progress? This cannot be undone.`)) return;
    deleteLearningTree(tree.id);
    onTreeDeleted();
  }

  function nodeStatusIcon(node: LearningNode) {
    if (node.skipped) return <EyeOff className="w-3.5 h-3.5 text-zinc-400" title="Skipped permanently" />;
    if (!latestSession) return null;
    if (latestSession.completedNodeIds?.includes(node.id))
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" title="Completed" />;
    if (latestSession.skippedNodeIds?.includes(node.id))
      return <SkipForward className="w-3.5 h-3.5 text-amber-500" title="Skipped this session" />;
    if (latestSession.visitedNodeIds?.includes(node.id))
      return <Eye className="w-3.5 h-3.5 text-blue-500" title="Viewed" />;
    return null;
  }

  function renderNode(node: NestedNode): React.ReactNode {
    const isLeaf = node.children.length === 0;
    const isExpanded = expandedIds.has(node.id);
    const siblings = nodes.filter((n) => n.parentId === node.parentId).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((n) => n.id === node.id);

    return (
      <div key={node.id} style={{ marginLeft: node.depth > 0 ? 20 : 0 }} className="space-y-1.5">
        <div
          className={`p-3 rounded-xl border transition-all ${
            node.skipped
              ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 opacity-60"
              : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-700"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {!isLeaf && (
              <button
                type="button"
                onClick={() => toggleExpanded(node.id)}
                className="mt-1.5 p-0.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            )}
            {isLeaf && <span className="w-4 h-4 mt-1.5 shrink-0" />}

            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={node.title}
                  onChange={(e) => updateNode(node.id, { title: e.target.value })}
                  className="flex-1 font-medium text-sm text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none px-1 py-0.5 min-w-0"
                />
                {isLeaf && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 shrink-0">item</span>}
                {nodeStatusIcon(node)}
                {savedResourceNodeIds.has(node.id) && <Bookmark className="w-3.5 h-3.5 text-zinc-500" title="Has saved resource" />}
              </div>
              <textarea
                value={node.description}
                onChange={(e) => updateNode(node.id, { description: e.target.value })}
                rows={1}
                placeholder="Short description..."
                className="w-full text-xs font-light text-zinc-600 dark:text-zinc-400 bg-transparent border-b border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:border-zinc-900 dark:focus:border-zinc-100 focus:outline-none px-1 py-0.5 resize-none"
              />

              {isLeaf && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {node.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                    >
                      {kw}
                      <button onClick={() => removeKeyword(node.id, i)} className="hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={keywordDraft[node.id] || ""}
                    onChange={(e) => setKeywordDraft((prev) => ({ ...prev, [node.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addKeyword(node.id);
                      }
                    }}
                    placeholder="+ keyword"
                    className="text-[11px] px-2 py-0.5 rounded-full bg-transparent border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 w-24 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                  <button
                    onClick={() => handleRegenerateKeywords(node)}
                    disabled={regeneratingKeywordsId === node.id}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Regenerate keywords (small AI call, not a full tree regeneration)"
                  >
                    {regeneratingKeywordsId === node.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>Regenerate</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
            <button
              onClick={() => moveNode(node.id, "up")}
              disabled={idx === 0}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 disabled:opacity-30"
              title="Move Up"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => moveNode(node.id, "down")}
              disabled={idx === siblings.length - 1}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 disabled:opacity-30"
              title="Move Down"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => addNode(node.id, node.depth + 1)}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
              title="Add Subtopic"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toggleSkip(node.id)}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
              title={node.skipped ? "Unskip" : "Skip Permanently"}
            >
              {node.skipped ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => deleteNode(node.id)}
              className="p-1.5 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          </div>
        </div>

        {!isLeaf && isExpanded && (
          <div className="space-y-1.5">{node.children.map((child) => renderNode(child))}</div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <button
        onClick={onBack}
        className="flex items-center space-x-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">{tree.title}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light">
              Learning Map • {leafNodes.length} learning item{leafNodes.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={depthChoice}
              onChange={(e) => setDepthChoice(Number(e.target.value))}
              className="text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
            >
              <option value={2}>Depth: 2</option>
              <option value={3}>Depth: 3</option>
              <option value={4}>Depth: 4</option>
            </select>
            <button
              onClick={() => setConfirmRegenerate(true)}
              disabled={isRegeneratingTree}
              title="Regenerate Tree"
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isRegeneratingTree ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Regenerate Tree</span>
            </button>
            <button
              onClick={handleDeleteTree}
              title="Delete Tree"
              className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete Tree</span>
            </button>
          </div>
        </div>

        {regenError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
            <span>{regenError}</span>
            <button onClick={() => setRegenError(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {confirmRegenerate && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3">
            <span>This replaces the entire tree structure and keywords. Continue?</span>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setConfirmRegenerate(false)} className="px-2 py-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40">Cancel</button>
              <button onClick={handleRegenerateTree} className="px-2 py-1 rounded-lg bg-amber-600 text-white hover:bg-amber-700">Regenerate</button>
            </div>
          </div>
        )}

        {activeSession && (
          <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-3">
            <span className="text-xs text-zinc-700 dark:text-zinc-300">
              You have a session in progress ({activeSession.completedNodeIds.length} completed).
            </span>
            <button
              onClick={() => onResumeSession(tree, activeSession)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium"
            >
              Resume Session
            </button>
          </div>
        )}

        <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-2">
          {nestedTree.map((node) => renderNode(node))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => addNode(null, 0)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Top-Level Topic</span>
          </button>

          <button
            onClick={() => setShowSessionSetup(true)}
            disabled={leafNodes.length === 0}
            className="px-6 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs shadow-md flex items-center space-x-2 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Learning</span>
          </button>
        </div>
      </div>

      {savedResources.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setShowSavedSection((v) => !v)}
              className="flex items-center gap-1.5 min-w-0 flex-1"
            >
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 min-w-0">
                <Bookmark className="w-4 h-4 shrink-0" />
                <span className="truncate">Saved Videos & Notes ({savedResources.length})</span>
              </h3>
              {showSavedSection ? (
                <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
              )}
            </button>
            <button
              onClick={() => onStartRevision(savedResources)}
              title="Watch your saved videos with notes, one after another"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Review</span>
            </button>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light -mt-2">
            Everything you've saved from this tree's learning feed, for quick revision.
          </p>

          {showSavedSection && (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-2">
              {savedResources.map((r) => (
                <div
                  key={r.id}
                  className="flex gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/30"
                >
                  <img
                    src={r.thumbnailUrl}
                    alt=""
                    className="w-24 h-16 rounded-lg object-cover shrink-0 bg-zinc-200 dark:bg-zinc-800"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{r.learningNodeTitle}</p>
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">{r.title}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
                          title="Open on YouTube"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleRemoveSavedResource(r.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="Remove saved video"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{r.duration}</span>
                      <span>{r.channelName}</span>
                    </div>

                    {r.userNotes && (
                      <div className="flex items-start gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 mt-1">
                        <StickyNote className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                        <p className="whitespace-pre-wrap">{r.userNotes}</p>
                      </div>
                    )}

                    {r.timestampNotes && r.timestampNotes.length > 0 && (
                      <div className="space-y-0.5 mt-1">
                        {r.timestampNotes.map((t, i) => (
                          <div key={i} className="text-[11px] text-zinc-600 dark:text-zinc-400 flex gap-2">
                            <span className="font-mono text-zinc-500 shrink-0">{t.time}</span>
                            <span>→ {t.note}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!r.userNotes && (!r.timestampNotes || r.timestampNotes.length === 0) && (
                      <p className="text-[11px] text-zinc-400 italic">No notes yet</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <SessionSetupModal
        isOpen={showSessionSetup}
        leafCount={leafNodes.length}
        onClose={() => setShowSessionSetup(false)}
        onStart={(timeLimitMinutes, filters) => {
          setShowSessionSetup(false);
          onStartSession({ ...tree, nodes }, timeLimitMinutes, filters);
        }}
      />
    </div>
  );
};
