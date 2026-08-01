import { getAISettings, incrementAIRequestCount } from "./storage";
import { LearningContent, LearningNode, LearningSessionFilter } from "../types";
import { providerRegistry } from "./providers/ContentProvider";
import "./providers/YouTubeProvider"; // registers the YouTube provider (side effect)

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const settings = getAISettings();
  if (settings.mode === "byok" && settings.userApiKey?.trim()) {
    headers["x-user-api-key"] = settings.userApiKey.trim();
  }
  return headers;
}

function generateNodeId(): string {
  return `ln_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

interface RawTreeNode {
  title: string;
  description?: string;
  keywords?: string[];
  children?: RawTreeNode[];
}

// Flattens Gemini's nested tree JSON into the flat LearningNode[] shape used by LearningTree.nodes.
// Node ids are generated here (not trusted from the model) to guarantee global uniqueness.
export function flattenTree(rawNodes: RawTreeNode[], parentId: string | null = null, depth = 0): LearningNode[] {
  const flat: LearningNode[] = [];
  rawNodes.forEach((raw, index) => {
    const id = generateNodeId();
    flat.push({
      id,
      parentId,
      title: raw.title,
      description: raw.description || "",
      keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
      depth,
      order: index,
    });
    if (Array.isArray(raw.children) && raw.children.length > 0) {
      flat.push(...flattenTree(raw.children, id, depth + 1));
    }
  });
  return flat;
}

type NestedLearningNode = Omit<LearningNode, "children"> & { children: NestedLearningNode[] };

// Reconstructs the nested hierarchy from a flat LearningNode[] for rendering, respecting `order`.
export function buildTreeFromFlat(flatNodes: LearningNode[]): NestedLearningNode[] {
  const byId = new Map<string, NestedLearningNode>();
  flatNodes.forEach((n) => byId.set(n.id, { ...n, children: [] }));
  const roots: NestedLearningNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRecursive = (list: NestedLearningNode[]) => {
    list.sort((a, b) => a.order - b.order);
    list.forEach((n) => sortRecursive(n.children));
  };
  sortRecursive(roots);
  return roots;
}

// Excludes any node whose ancestor chain includes a permanently-skipped node.
function excludeSkippedSubtrees(flatNodes: LearningNode[]): LearningNode[] {
  const skippedIds = new Set(flatNodes.filter((n) => n.skipped).map((n) => n.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of flatNodes) {
      if (!skippedIds.has(n.id) && n.parentId && skippedIds.has(n.parentId)) {
        skippedIds.add(n.id);
        changed = true;
      }
    }
  }
  return flatNodes.filter((n) => !skippedIds.has(n.id));
}

// Returns the tree's leaf nodes (the actual learning items) in depth-first hierarchy order.
// Leaves are the only nodes that ever get YouTube content / appear in the feed.
export function getOrderedLeafNodes(flatNodes: LearningNode[], includeSkipped = false): LearningNode[] {
  const usable = includeSkipped ? flatNodes : excludeSkippedSubtrees(flatNodes);
  const tree = buildTreeFromFlat(usable);
  const leaves: LearningNode[] = [];
  const walk = (list: NestedLearningNode[]) => {
    for (const n of list) {
      if (n.children.length > 0) walk(n.children);
      else leaves.push(n);
    }
  };
  walk(tree);
  return leaves;
}

export async function generateLearningTree(params: {
  mainTopic: string;
  topicDescription?: string;
  depth: number;
  language?: string;
  difficulty?: string;
}): Promise<{ topic: string; nodes: LearningNode[] }> {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/learning-tree", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to generate learning tree");
  }
  return { topic: data.topic, nodes: flattenTree(data.nodes) };
}

export async function regenerateNodeKeywords(params: {
  nodeTitle: string;
  nodeDescription?: string;
  existingKeywords?: string[];
}): Promise<string[]> {
  incrementAIRequestCount();
  const res = await fetch("/api/ai/learning-keywords", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Failed to regenerate keywords");
  }
  return data.keywords as string[];
}

// In-memory per-node content cache (session lifetime only) so revisiting a node
// or going back doesn't re-hit the provider/quota.
const nodeContentCache = new Map<string, { timestamp: number; content: LearningContent[] }>();
const NODE_CONTENT_CACHE_TTL_MS = 15 * 60 * 1000;

// Searches for YouTube content for a single learning node using its keywords.
// Tries the first keyword only; falls back to a second keyword if results are thin.
// Never fans out to every keyword at once (quota-conscious, per spec).
export async function searchLearningContentForNode(
  node: LearningNode,
  filters: Partial<LearningSessionFilter>,
  limit = 6
): Promise<LearningContent[]> {
  const cacheKey = `${node.id}_${JSON.stringify(filters)}_${limit}`;
  const cached = nodeContentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < NODE_CONTENT_CACHE_TTL_MS) {
    return cached.content;
  }

  const provider = providerRegistry.get("youtube");
  const keywords = node.keywords.length > 0 ? node.keywords : [node.title];

  let results: LearningContent[] = [];
  for (const keyword of keywords.slice(0, 2)) {
    const found = await provider.search(keyword, { limit, filters });
    const withTopic = found.map((c) => ({ ...c, topicId: node.id }));
    const existingIds = new Set(results.map((r) => r.providerContentId));
    results = [...results, ...withTopic.filter((c) => !existingIds.has(c.providerContentId))];
    if (results.length >= limit) break;
  }

  results = results.slice(0, limit);
  nodeContentCache.set(cacheKey, { timestamp: Date.now(), content: results });
  return results;
}
