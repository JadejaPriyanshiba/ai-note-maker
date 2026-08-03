import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion } from "motion/react";
import { fadeInUp } from "../../lib/motion";
import { NoteDocument, NoteSection, NoteBlock, StudentTagType, NoteVersion } from "../../types";
import { saveNote, deleteNote, publishCommunityNote, remixCommunityNote } from "../../lib/storage";
import { selectionAction } from "../../lib/aiService";
import { CollectionSelectorModal } from "../Collections/CollectionSelectorModal";
import { AIFlashcardGeneratorModal } from "../Flashcards/AIFlashcardGeneratorModal";
import { PublishModal } from "../Community/PublishModal";
import { ConfirmModal } from "../ConfirmModal";
import {
  ArrowLeft, Save, Share2, Download, Printer, History, Plus, Trash2,
  Sparkles, CheckSquare, AlertCircle, Bookmark, HelpCircle, FileCheck,
  Code, Table as TableIcon, Edit3, MessageSquare, Copy, Check, ChevronDown, RefreshCw,
  ChevronLeft, ChevronRight, Compass, Folder, Layers, GitFork, BookOpen, Lock,
  Maximize2, Minimize2, X
} from "lucide-react";

// Grows to fit its content exactly — never shorter nor taller than the text — instead of a
// fixed row-count estimate that under- or over-shoots for long or short content. Used for every
// editable block field so long text wraps and the block grows vertically instead of causing
// horizontal scroll inside a single-line input.
const AutoResizeTextarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }
> = ({ minRows = 1, className = "", value, onChange, ...rest }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={onChange}
      className={`resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
};

interface NoteStudioProps {
  note?: NoteDocument;
  initialNote?: NoteDocument;
  readOnly?: boolean;
  onBack: () => void;
  onOpenTest: (note: NoteDocument) => void;
  onOpenAudio: (note: NoteDocument) => void;
  onNoteRemixed?: (note: NoteDocument) => void;
}

export const NoteStudio: React.FC<NoteStudioProps> = ({
  note: propNote,
  initialNote,
  readOnly = false,
  onBack,
  onOpenTest,
  onOpenAudio,
  onNoteRemixed,
}) => {
  const currentInitialNote = propNote || initialNote || ({} as NoteDocument);
  const [note, setNote] = useState<NoteDocument>(currentInitialNote);
  const [isReadOnlyState, setIsReadOnlyState] = useState<boolean>(!!readOnly);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    currentInitialNote.sections?.[0]?.id || ""
  );

  useEffect(() => {
    setIsReadOnlyState(!!readOnly);
  }, [readOnly]);
  const [showVersionHistory, setShowVersionHistory] = useState<boolean>(false);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [showCollectionModal, setShowCollectionModal] = useState<boolean>(false);
  const [showFlashcardModal, setShowFlashcardModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);
  
  // Selection Floating AI Menu state
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [aiActionResult, setAiActionResult] = useState<string | null>(null);
  const [isAiExecuting, setIsAiExecuting] = useState<boolean>(false);
  const [customAiPrompt, setCustomAiPrompt] = useState<string>("");

  // Publish Form State
  const [publishDesc, setPublishDesc] = useState<string>(`Study notes for ${note?.subject || ""}`);
  const [sourceType, setSourceType] = useState<any>("My own notes");
  const [sourceNotice, setSourceNotice] = useState<string>("");
  const [licenseAgreed, setLicenseAgreed] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  const sectionsList = note?.sections || [];
  const activeSection = sectionsList.find((s) => s.id === activeSectionId) || sectionsList[0];

  // Auto handle text selection for AI Selection Actions
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 3) {
        const text = selection.toString().trim();
        setSelectedText(text);
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPos({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
      } else {
        // Only clear if not clicking inside AI action popup
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const handleRemixThisNote = () => {
    try {
      const commItem = {
        id: note.communityId || note.id || `comm_${Date.now()}`,
        title: note.title,
        subject: note.subject,
        authorName: note.authorName || "Community Member",
        content: note,
      };
      const remixedNote = remixCommunityNote(commItem as any);
      setNote(remixedNote);
      setIsReadOnlyState(false);
      if (onNoteRemixed) {
        onNoteRemixed(remixedNote);
      }
      alert(`Remixed "${note.title}"! A duplicate copy has been saved to your private notes.`);
    } catch (err: any) {
      alert("Failed to remix note: " + err.message);
    }
  };

  const handleUpdateNote = (updated: NoteDocument, saveVersion: boolean = false, versionTitle: string = "Manual Update") => {
    if (isReadOnlyState) return;
    if (saveVersion) {
      const newVersion: NoteVersion = {
        id: `ver_${Date.now()}`,
        title: versionTitle,
        timestamp: new Date().toISOString(),
        createdBy: "user",
        sections: JSON.parse(JSON.stringify(updated.sections || [])),
      };
      updated.versions = [newVersion, ...(updated.versions || [])];
    }
    updated.updatedAt = new Date().toISOString();
    setNote(updated);
    saveNote(updated);
  };

  // Block Edits
  const handleUpdateBlock = (blockId: string, updatedFields: Partial<NoteBlock>) => {
    if (!activeSection) return;
    const updatedSections = (note.sections || []).map((sec) => {
      if (sec.id !== activeSection.id) return sec;
      return {
        ...sec,
        blocks: (sec.blocks || []).map((b) => (b.id === blockId ? { ...b, ...updatedFields } : b)),
      };
    });
    handleUpdateNote({ ...note, sections: updatedSections });
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!activeSection) return;
    const updatedSections = (note.sections || []).map((sec) => {
      if (sec.id !== activeSection.id) return sec;
      return {
        ...sec,
        blocks: (sec.blocks || []).filter((b) => b.id !== blockId),
      };
    });
    handleUpdateNote({ ...note, sections: updatedSections });
  };

  const handleAddBlock = (type: NoteBlock["type"], tagType?: StudentTagType) => {
    if (!activeSection) return;
    const newBlock: NoteBlock = {
      id: `b_${Date.now()}`,
      type,
      content:
        type === "heading"
          ? "New Section Heading"
          : type === "quote"
          ? "A key takeaway worth remembering..."
          : "Type your study content here...",
      level: type === "heading" ? 2 : undefined,
      tagType,
      items:
        type === "bullet_list" || type === "checklist" || type === "numbered_list"
          ? ["First item", "Second item"]
          : undefined,
      checkedItems: type === "checklist" ? [false, false] : undefined,
      tableData: type === "table" ? [["Header 1", "Header 2"], ["Data 1", "Data 2"]] : undefined,
    };

    const updatedSections = (note.sections || []).map((sec) => {
      if (sec.id !== activeSection.id) return sec;
      return { ...sec, blocks: [...(sec.blocks || []), newBlock] };
    });

    handleUpdateNote({ ...note, sections: updatedSections });
  };

  // Table row/column editing — manual tables start at 2x2 (see handleAddBlock) but users need to
  // grow or shrink them afterwards; each keeps at least a header row and one column so the block
  // never collapses into something unrenderable.
  const handleAddTableRow = (block: NoteBlock) => {
    const data = block.tableData || [];
    const cols = data[0]?.length || 1;
    handleUpdateBlock(block.id, { tableData: [...data, Array(cols).fill("")] });
  };

  const handleRemoveTableRow = (block: NoteBlock, rowIdx: number) => {
    const data = block.tableData || [];
    if (data.length <= 2) return; // keep the header row + at least one data row
    handleUpdateBlock(block.id, { tableData: data.filter((_, i) => i !== rowIdx) });
  };

  const handleAddTableColumn = (block: NoteBlock) => {
    const data = block.tableData || [];
    const updated = data.map((row, i) => [...row, i === 0 ? `Column ${row.length + 1}` : ""]);
    handleUpdateBlock(block.id, { tableData: updated });
  };

  const handleRemoveTableColumn = (block: NoteBlock, colIdx: number) => {
    const data = block.tableData || [];
    if ((data[0]?.length || 0) <= 1) return; // keep at least one column
    handleUpdateBlock(block.id, { tableData: data.map((row) => row.filter((_, i) => i !== colIdx)) });
  };

  // AI Selection Action execution
  const handleExecuteAiAction = async (actionKey: string) => {
    if (!selectedText) return;
    setIsAiExecuting(true);
    setAiActionResult(null);
    try {
      const result = await selectionAction({
        action: actionKey,
        selectedText,
        contextTopic: activeSection?.title || note.subject,
        language: note.language,
        userPrompt: customAiPrompt,
      });
      setAiActionResult(result);
    } catch (err: any) {
      alert(`AI Action failed: ${err.message || "Error"}`);
    } finally {
      setIsAiExecuting(false);
    }
  };

  const handleInsertAiResult = () => {
    if (!aiActionResult || !activeSection) return;
    const newBlock: NoteBlock = {
      id: `b_ai_${Date.now()}`,
      type: "callout",
      content: `AI Explanation / Note:\n${aiActionResult}`,
    };
    const updatedSections = (note.sections || []).map((sec) => {
      if (sec.id !== activeSection.id) return sec;
      return { ...sec, blocks: [...(sec.blocks || []), newBlock] };
    });
    handleUpdateNote({ ...note, sections: updatedSections }, true, "AI Selection Edit");
    setAiActionResult(null);
    setSelectionPos(null);
    setSelectedText("");
  };

  // Export handlers
  const handleExportJSON = () => {
    try {
      const jsonStr = JSON.stringify(note, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(note.title || "study_note").toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("JSON export error:", err);
    } finally {
      setIsExportOpen(false);
    }
  };

  const handleExportTXT = () => {
    try {
      let txt = `# ${note.title}\nSubject: ${note.subject} | Level: ${note.learnerLevel} | Complexity: ${note.complexity}\n\n`;
      (note.sections || []).forEach((sec, idx) => {
        txt += `## Topic ${idx + 1}: ${sec.title}\n`;
        if (sec.summary) txt += `Summary: ${sec.summary}\n`;
        txt += `\n`;
        (sec.blocks || []).forEach((b) => {
          if (b.type === "heading") txt += `### ${b.content}\n\n`;
          else if (b.type === "paragraph") txt += `${b.content}\n\n`;
          else if (b.type === "bullet_list") {
            (b.items || []).forEach((item) => {
              txt += `- ${item}\n`;
            });
            txt += `\n`;
          } else if (b.type === "numbered_list") {
            (b.items || []).forEach((item, idx) => {
              txt += `${idx + 1}. ${item}\n`;
            });
            txt += `\n`;
          } else if (b.type === "checklist") {
            (b.items || []).forEach((item, idx) => {
              txt += `[${b.checkedItems?.[idx] ? "x" : " "}] ${item}\n`;
            });
            txt += `\n`;
          } else if (b.type === "quote") {
            txt += `> ${b.content}\n\n`;
          } else if (b.type === "callout") {
            txt += `[NOTE]: ${b.content}\n\n`;
          } else if (b.type === "table") {
            (b.tableData || []).forEach((row, rIdx) => {
              txt += `| ${row.join(" | ")} |\n`;
              if (rIdx === 0) txt += `|${row.map(() => " --- ").join("|")}|\n`;
            });
            txt += `\n`;
          } else if (b.type === "student_tag") {
            txt += `[${(b.tagType || "NOTE").toUpperCase()}]: ${b.content}\n\n`;
          } else if (b.type === "code") {
            txt += `\`\`\`${b.language || ""}\n${b.content}\n\`\`\`\n\n`;
          }
        });
        txt += `---\n\n`;
      });

      const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(note.title || "study_note").toLowerCase().replace(/[^a-z0-9]/g, "_")}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("TXT export error:", err);
    } finally {
      setIsExportOpen(false);
    }
  };

  // Helper to generate pixel-perfect monochromatic HTML matching Note Studio design
  const generateNoteStudioHTML = (noteDoc: NoteDocument): string => {
    const escapeHtml = (str: string = ""): string => {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const title = noteDoc.title || "Untitled Note";
    const subject = noteDoc.subject || "General";
    const level = noteDoc.learnerLevel || "Intermediate";
    const complexity = noteDoc.complexity || "Standard";

    let sectionsHTML = "";

    (noteDoc.sections || []).forEach((sec, idx) => {
      let blocksHTML = "";
      (sec.blocks || []).forEach((block) => {
        if (block.type === "heading") {
          blocksHTML += `<h3 style="font-size:18px; font-weight:800; color:#09090b; margin-top:22px; margin-bottom:10px; letter-spacing:0.02em;">${escapeHtml(block.content)}</h3>`;
        } else if (block.type === "paragraph") {
          blocksHTML += `<p style="font-size:14px; font-weight:400; color:#18181b; line-height:1.75; margin-bottom:14px; white-space:pre-wrap; word-break:break-word;">${escapeHtml(block.content)}</p>`;
        } else if (block.type === "student_tag") {
          const tagLabel = (block.tagType || "NOTE").replace(/_/g, " ").toUpperCase();
          blocksHTML += `
            <div style="padding:14px 18px; border-radius:12px; border:1px solid #d4d4d8; background-color:#f4f4f5; color:#09090b; margin:16px 0; display:flex; flex-direction:column; gap:8px; page-break-inside:avoid; break-inside:avoid;">
              <div style="align-self:flex-start; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; padding:4px 10px; border-radius:6px; background-color:#09090b; color:#ffffff;">
                ${escapeHtml(tagLabel)}
              </div>
              <div style="font-size:13px; font-weight:500; line-height:1.6; color:#09090b; white-space:pre-wrap; word-break:break-word;">
                ${escapeHtml(block.content)}
              </div>
            </div>
          `;
        } else if (block.type === "bullet_list") {
          const items = (block.items || [])
            .map((item) => `<li style="margin-bottom:8px; white-space:pre-wrap; word-break:break-word;">${escapeHtml(item)}</li>`)
            .join("");
          blocksHTML += `<ul style="padding-left:20px; border-left:2px solid #a1a1aa; font-size:14px; color:#18181b; line-height:1.65; margin:14px 0; list-style-type:disc;">${items}</ul>`;
        } else if (block.type === "numbered_list") {
          const items = (block.items || [])
            .map((item) => `<li style="margin-bottom:8px; white-space:pre-wrap; word-break:break-word;">${escapeHtml(item)}</li>`)
            .join("");
          blocksHTML += `<ol style="padding-left:20px; font-size:14px; color:#18181b; line-height:1.65; margin:14px 0;">${items}</ol>`;
        } else if (block.type === "checklist") {
          const items = (block.items || [])
            .map((item, idx) => {
              const checked = !!block.checkedItems?.[idx];
              return `<li style="margin-bottom:8px; list-style:none; display:flex; align-items:flex-start; gap:8px; ${
                checked ? "color:#a1a1aa; text-decoration:line-through;" : ""
              }"><span style="display:inline-block; width:14px; height:14px; margin-top:2px; border-radius:3px; border:1px solid #a1a1aa; background-color:${
                checked ? "#09090b" : "transparent"
              }; flex-shrink:0;"></span><span style="white-space:pre-wrap; word-break:break-word;">${escapeHtml(item)}</span></li>`;
            })
            .join("");
          blocksHTML += `<ul style="padding-left:0; font-size:14px; color:#18181b; line-height:1.65; margin:14px 0;">${items}</ul>`;
        } else if (block.type === "quote") {
          blocksHTML += `<blockquote style="padding-left:16px; border-left:4px solid #09090b; font-size:14px; font-style:italic; color:#3f3f46; line-height:1.7; margin:16px 0; white-space:pre-wrap; word-break:break-word;">&ldquo;${escapeHtml(block.content)}&rdquo;</blockquote>`;
        } else if (block.type === "callout") {
          blocksHTML += `
            <div style="padding:14px 18px; border-radius:12px; border:1px solid #fde68a; background-color:#fffbeb; color:#78350f; margin:16px 0; font-size:13px; font-weight:500; line-height:1.6; white-space:pre-wrap; word-break:break-word; page-break-inside:avoid; break-inside:avoid;">
              ${escapeHtml(block.content)}
            </div>
          `;
        } else if (block.type === "table") {
          const colCount = block.tableData?.[0]?.length || 1;
          const rowsHTML = (block.tableData || [])
            .map((row, rIdx) => {
              const cellTag = rIdx === 0 ? "th" : "td";
              const cellStyle =
                (rIdx === 0
                  ? "border:1px solid #d4d4d8; padding:8px 12px; text-align:left; font-weight:700; background-color:#f4f4f5; color:#09090b;"
                  : "border:1px solid #d4d4d8; padding:8px 12px; text-align:left; color:#18181b;") +
                ` width:${100 / colCount}%; word-break:break-word; white-space:pre-wrap;`;
              const cellsHTML = row.map((cell) => `<${cellTag} style="${cellStyle}">${escapeHtml(cell)}</${cellTag}>`).join("");
              return `<tr>${cellsHTML}</tr>`;
            })
            .join("");
          blocksHTML += `<table style="width:100%; table-layout:fixed; border-collapse:collapse; font-size:13px; margin:16px 0; page-break-inside:avoid; break-inside:avoid;">${rowsHTML}</table>`;
        } else if (block.type === "code") {
          const lang = (block.language || "code").toUpperCase();
          blocksHTML += `
            <div style="border-radius:16px; background-color:#09090b; color:#f4f4f5; padding:16px 18px; margin:18px 0; border:1px solid #27272a; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; page-break-inside:avoid; break-inside:avoid;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #27272a; padding-bottom:8px; margin-bottom:12px; font-size:10px; color:#a1a1aa; font-weight:700; letter-spacing:0.05em;">
                <span>${escapeHtml(lang)}</span>
                <span>SOURCE CODE</span>
              </div>
              <pre style="margin:0; font-size:12px; line-height:1.6; white-space:pre-wrap; word-break:break-all; font-family:inherit; color:#f4f4f5;"><code>${escapeHtml(block.content)}</code></pre>
            </div>
          `;
        }
      });

      sectionsHTML += `
        <div style="background:#ffffff; border:1px solid #e4e4e7; border-radius:20px; padding:28px; margin-bottom:28px; page-break-inside:avoid; break-inside:avoid; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
          <div style="border-bottom:1px solid #e4e4e7; padding-bottom:14px; margin-bottom:20px;">
            <div style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#71717a; margin-bottom:4px;">
              Topic ${idx + 1} of ${noteDoc.sections.length}
            </div>
            <h2 style="font-size:22px; font-weight:800; color:#09090b; margin:0; letter-spacing:-0.01em;">
              ${escapeHtml(sec.title)}
            </h2>
            ${
              sec.summary
                ? `<p style="font-size:13px; font-style:italic; color:#52525b; margin-top:8px; margin-bottom:0; font-weight:400;">Summary: ${escapeHtml(sec.summary)}</p>`
                : ""
            }
          </div>
          <div>
            ${blocksHTML}
          </div>
        </div>
      `;
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&display=swap" rel="stylesheet">
  <style>
    @media print {
      body { background: #ffffff !important; padding: 0 !important; color: #000000 !important; }
      .no-print { display: none !important; }
      .page-card { border: 1px solid #d4d4d8 !important; box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; }
      @page { margin: 1.5cm; size: auto; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f4f4f5;
      color: #09090b;
      margin: 0;
      padding: 40px 20px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
    }
    .header-card {
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 20px;
      padding: 28px;
      margin-bottom: 24px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background-color: #09090b;
      color: #ffffff;
    }
    .meta-tag {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      background-color: #f4f4f5;
      color: #27272a;
      border: 1px solid #e4e4e7;
      margin-left: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-card page-card">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <span class="badge">${escapeHtml(subject)}</span>
        <span class="meta-tag">Level: ${escapeHtml(level)}</span>
        <span class="meta-tag">Complexity: ${escapeHtml(complexity)}</span>
      </div>
      <h1 style="font-size:26px; font-weight:800; color:#09090b; margin:0 0 6px 0; letter-spacing:-0.02em;">
        ${escapeHtml(title)}
      </h1>
      <p style="font-size:12px; color:#71717a; margin:0; font-weight:600;">
        Study Note Studio • Monochromatic Print & Export Edition
      </p>
    </div>

    ${sectionsHTML}
  </div>
</body>
</html>`;
  };

  const handleExportHTML = () => {
    try {
      const htmlContent = generateNoteStudioHTML(note);
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(note.title || "study_note").toLowerCase().replace(/[^a-z0-9]/g, "_")}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("HTML export error:", err);
    } finally {
      setIsExportOpen(false);
    }
  };

  const handlePrintPDF = () => {
    setIsExportOpen(false);
    const htmlContent = generateNoteStudioHTML(note);

    // 1. Try opening a clean printable window
    try {
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlContent);
        printWin.document.close();

        setTimeout(() => {
          printWin.focus();
          printWin.print();
        }, 350);
        return;
      }
    } catch (e) {
      console.warn("Popup print blocked, falling back to hidden iframe print:", e);
    }

    // 2. Hidden iframe print fallback (works reliably when popups are blocked in iframe)
    let printFrame = document.getElementById("note-print-iframe") as HTMLIFrameElement;
    if (!printFrame) {
      printFrame = document.createElement("iframe");
      printFrame.id = "note-print-iframe";
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0px";
      printFrame.style.height = "0px";
      printFrame.style.border = "none";
      printFrame.style.zIndex = "-9999";
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      }, 350);
    } else {
      window.print();
    }
  };

  // Publish Handler
  const handlePublish = async () => {
    if (!licenseAgreed) {
      alert("Please confirm that you have the right to share this educational content.");
      return;
    }
    setIsPublishing(true);
    try {
      publishCommunityNote(note, {
        description: publishDesc,
        sourceType,
        sourceNotice,
        authorName: note.authorName || "Student Scholar",
      });
      alert("Note successfully published to the Global Community Library!");
      setShowPublishModal(false);
      setNote({ ...note, isCommunityPublished: true });
    } catch (err: any) {
      alert("Failed to publish note: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteNote = () => {
    deleteNote(note.id);
    onBack();
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-12 transition-colors">
      {/* Read-Only Notice Banner */}
      {isReadOnlyState && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/80 px-4 py-3 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center space-x-2.5">
              <BookOpen className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>Community Note (Read-Only Mode):</strong> You are viewing a published note from @{note.authorName || "Community Member"}. Remix this note to save a private, editable copy to your library.
              </span>
            </div>
            <button
              onClick={handleRemixThisNote}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center space-x-1.5 shadow-xs text-xs shrink-0 transition-colors"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Remix & Edit Copy</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Studio Toolbar */}
      <div className="sticky top-16 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                  {note.subject}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {note.learnerLevel} • {note.complexity}
                </span>
                {isReadOnlyState && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center space-x-1">
                    <Lock className="w-3 h-3" />
                    <span>Read Only</span>
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                {note.title}
              </h1>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {isReadOnlyState ? (
              <button
                onClick={handleRemixThisNote}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 shadow-xs transition-colors"
                title="Remix Note into My Library"
              >
                <GitFork className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                  title="Delete Note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setShowCollectionModal(true)}
                  className="p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Organize into Collection"
                >
                  <Folder className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              onClick={() => setShowFlashcardModal(true)}
              className="p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Generate Flashcards"
            >
              <Layers className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenAudio(note)}
              className="p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              title="Audio Learning Studio"
            >
              <Sparkles className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </button>

            <button
              onClick={() => onOpenTest(note)}
              className="p-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xs transition-colors"
              title="Take Practice Test"
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsFullScreen(true)}
              className="p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-xs transition-colors"
              title="Full Screen View"
            >
              <Maximize2 className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            </button>

            {!isReadOnlyState && (
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className="p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Version Snapshots"
              >
                <History className="w-4 h-4" />
              </button>
            )}

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Export & Save Options"
              >
                <Download className="w-4 h-4" />
              </button>

              {isExportOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsExportOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl py-1.5 z-50"
                  >
                    <button
                      onClick={handlePrintPDF}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-2.5 transition-colors"
                    >
                      <Printer className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                      <span>Print / Save PDF</span>
                    </button>
                    <button
                      onClick={handleExportTXT}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-2.5 transition-colors"
                    >
                      <Edit3 className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                      <span>Export Text (.txt)</span>
                    </button>
                    <button
                      onClick={handleExportHTML}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-2.5 transition-colors"
                    >
                      <Code className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                      <span>Export HTML (.html)</span>
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="w-full text-left px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-2.5 transition-colors"
                    >
                      <Download className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />
                      <span>Export JSON (.json)</span>
                    </button>
                  </motion.div>
                </>
              )}
            </div>

            {/* Publish Button */}
            {!isReadOnlyState && (
              <button
                onClick={() => setShowPublishModal(true)}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 shadow-xs transition-colors"
                title={note.isCommunityPublished ? "Published to Community" : "Publish Note"}
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Studio Body (Two Column Layout) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Column: Topic Sections List Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Study Topics ({sectionsList.length})
            </h3>
            <div className="space-y-1">
              {sectionsList.map((sec, idx) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSectionId(sec.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                    sec.id === activeSectionId
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="line-clamp-1">{idx + 1}. {sec.title}</span>
                  <span className="text-[10px] opacity-75">{(sec.blocks || []).length} blocks</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Section Content Canvas */}
        <div className="md:col-span-3 space-y-6">
          {activeSection ? (
            <motion.div
              key={activeSection.id}
              initial="hidden"
              animate="show"
              variants={fadeInUp}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-xs space-y-6 print:shadow-none print:border-none print:p-0"
            >
              {/* Section Title */}
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                {isReadOnlyState ? (
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 px-1 py-1">
                    {activeSection.title}
                  </h2>
                ) : (
                  <input
                    type="text"
                    value={activeSection.title}
                    onChange={(e) => {
                      const updated = sectionsList.map((s) =>
                        s.id === activeSection.id ? { ...s, title: e.target.value } : s
                      );
                      handleUpdateNote({ ...note, sections: updated });
                    }}
                    className="w-full text-2xl font-bold text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-transparent focus:border-zinc-500 focus:outline-none px-1 py-1"
                  />
                )}
                {activeSection.summary && (
                  <p className="text-xs italic text-zinc-500 dark:text-zinc-400 mt-1 px-1">
                    Summary: {activeSection.summary}
                  </p>
                )}
              </div>

              {/* Blocks */}
              <div className="space-y-4">
                {(activeSection?.blocks || []).map((block) => (
                  <div key={block.id} className="group relative">
                    {/* Block Renderers */}
                    {block.type === "heading" && (
                      isReadOnlyState ? (
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 py-1">
                          {block.content}
                        </h3>
                      ) : (
                        <AutoResizeTextarea
                          value={block.content}
                          onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                          className="w-full font-bold text-lg text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-transparent focus:border-zinc-500 focus:outline-none py-1"
                        />
                      )
                    )}

                    {block.type === "paragraph" && (
                      isReadOnlyState ? (
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 py-1 leading-relaxed whitespace-pre-wrap">
                          {block.content}
                        </p>
                      ) : (
                        <AutoResizeTextarea
                          value={block.content}
                          onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                          minRows={2}
                          className="w-full text-sm text-zinc-800 dark:text-zinc-200 bg-transparent border-b border-transparent focus:border-zinc-500 focus:outline-none py-1 leading-relaxed"
                        />
                      )
                    )}

                    {/* Student Tag Box */}
                    {block.type === "student_tag" && (
                      <div className="p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 flex flex-col sm:flex-row items-start gap-3 w-full min-w-0">
                        <div className="shrink-0 font-bold uppercase text-[10px] px-2.5 py-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs tracking-wider">
                          {block.tagType?.replace("_", " ")}
                        </div>
                        <div className="flex-1 w-full min-w-0">
                          {isReadOnlyState ? (
                            <p className="text-xs font-medium leading-relaxed whitespace-pre-wrap break-words">
                              {block.content}
                            </p>
                          ) : (
                            <AutoResizeTextarea
                              value={block.content}
                              onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                              minRows={2}
                              className="w-full text-xs font-medium bg-transparent focus:outline-none leading-relaxed break-words py-0.5"
                            />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bullet List */}
                    {block.type === "bullet_list" && (
                      <div className="space-y-1.5 pl-4 border-l-2 border-zinc-300 dark:border-zinc-700">
                        {block.items?.map((item, idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300 shrink-0 mt-1.5" />
                            {isReadOnlyState ? (
                              <span className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words py-0.5">{item}</span>
                            ) : (
                              <AutoResizeTextarea
                                value={item}
                                onChange={(e) => {
                                  const newItems = [...(block.items || [])];
                                  newItems[idx] = e.target.value;
                                  handleUpdateBlock(block.id, { items: newItems });
                                }}
                                className="w-full text-xs text-zinc-800 dark:text-zinc-200 bg-transparent focus:outline-none break-words py-0.5"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Code Block */}
                    {block.type === "code" && (
                      <div className="p-4 rounded-xl bg-zinc-900 text-zinc-100 font-mono text-xs space-y-2 border border-zinc-800">
                        <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-800 pb-2">
                          <span>{block.language || "code"}</span>
                          <span>Source Code</span>
                        </div>
                        {isReadOnlyState ? (
                          <pre className="overflow-x-auto text-xs font-mono text-zinc-200 whitespace-pre-wrap">{block.content}</pre>
                        ) : (
                          <AutoResizeTextarea
                            value={block.content}
                            onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                            minRows={4}
                            className="w-full bg-transparent focus:outline-none font-mono text-xs text-zinc-200"
                          />
                        )}
                      </div>
                    )}

                    {/* Numbered List */}
                    {block.type === "numbered_list" && (
                      <div className="space-y-1.5 pl-1">
                        {block.items?.map((item, idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 shrink-0 w-4 text-right mt-0.5">{idx + 1}.</span>
                            {isReadOnlyState ? (
                              <span className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words py-0.5">{item}</span>
                            ) : (
                              <AutoResizeTextarea
                                value={item}
                                onChange={(e) => {
                                  const newItems = [...(block.items || [])];
                                  newItems[idx] = e.target.value;
                                  handleUpdateBlock(block.id, { items: newItems });
                                }}
                                className="w-full text-xs text-zinc-800 dark:text-zinc-200 bg-transparent focus:outline-none break-words py-0.5"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Checklist */}
                    {block.type === "checklist" && (
                      <div className="space-y-1.5">
                        {block.items?.map((item, idx) => {
                          const checked = !!block.checkedItems?.[idx];
                          return (
                            <div key={idx} className="flex items-start space-x-2">
                              <button
                                type="button"
                                disabled={isReadOnlyState}
                                onClick={() => {
                                  const newChecked = block.items!.map((_, i) => !!block.checkedItems?.[i]);
                                  newChecked[idx] = !checked;
                                  handleUpdateBlock(block.id, { checkedItems: newChecked });
                                }}
                                className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                                  isReadOnlyState ? "cursor-default" : "cursor-pointer"
                                } ${
                                  checked
                                    ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100"
                                    : "border-zinc-300 dark:border-zinc-600"
                                }`}
                              >
                                {checked && <Check className="w-3 h-3 text-white dark:text-zinc-900" />}
                              </button>
                              {isReadOnlyState ? (
                                <span className={`text-xs whitespace-pre-wrap break-words py-0.5 ${checked ? "text-zinc-400 dark:text-zinc-500 line-through" : "text-zinc-800 dark:text-zinc-200"}`}>
                                  {item}
                                </span>
                              ) : (
                                <AutoResizeTextarea
                                  value={item}
                                  onChange={(e) => {
                                    const newItems = [...(block.items || [])];
                                    newItems[idx] = e.target.value;
                                    handleUpdateBlock(block.id, { items: newItems });
                                  }}
                                  className={`w-full text-xs bg-transparent focus:outline-none break-words py-0.5 ${
                                    checked ? "text-zinc-400 dark:text-zinc-500 line-through" : "text-zinc-800 dark:text-zinc-200"
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quote */}
                    {block.type === "quote" && (
                      <blockquote className="pl-4 border-l-4 border-zinc-900 dark:border-zinc-100 py-1">
                        {isReadOnlyState ? (
                          <p className="text-sm italic text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">"{block.content}"</p>
                        ) : (
                          <AutoResizeTextarea
                            value={block.content}
                            onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                            minRows={2}
                            className="w-full text-sm italic text-zinc-700 dark:text-zinc-300 bg-transparent focus:outline-none"
                          />
                        )}
                      </blockquote>
                    )}

                    {/* Callout */}
                    {block.type === "callout" && (
                      <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        {isReadOnlyState ? (
                          <p className="text-xs font-medium text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap flex-1">
                            {block.content}
                          </p>
                        ) : (
                          <AutoResizeTextarea
                            value={block.content}
                            onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                            minRows={2}
                            className="flex-1 text-xs font-medium text-amber-900 dark:text-amber-200 bg-transparent focus:outline-none leading-relaxed"
                          />
                        )}
                      </div>
                    )}

                    {/* Table */}
                    {block.type === "table" && (
                      <div className="space-y-2">
                        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
                          <table className="w-full text-xs border-collapse table-fixed">
                            <tbody>
                              {(block.tableData || []).map((row, rIdx) => {
                                const CellTag: any = rIdx === 0 ? "th" : "td";
                                const colCount = row.length || 1;
                                return (
                                  <tr key={rIdx} className={rIdx === 0 ? "bg-zinc-100 dark:bg-zinc-800" : "border-t border-zinc-200 dark:border-zinc-700"}>
                                    {row.map((cell, cIdx) => (
                                      <CellTag
                                        key={cIdx}
                                        style={{ width: `${100 / colCount}%` }}
                                        className={`relative px-3 py-2 text-left align-top border-r border-zinc-200 dark:border-zinc-700 last:border-r-0 ${
                                          rIdx === 0 ? "font-bold text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"
                                        }`}
                                      >
                                        {isReadOnlyState ? (
                                          <span className="whitespace-pre-wrap break-words">{cell}</span>
                                        ) : (
                                          <>
                                            <AutoResizeTextarea
                                              value={cell}
                                              onChange={(e) => {
                                                const newTableData = (block.tableData || []).map((r) => [...r]);
                                                newTableData[rIdx][cIdx] = e.target.value;
                                                handleUpdateBlock(block.id, { tableData: newTableData });
                                              }}
                                              className={`w-full bg-transparent focus:outline-none break-words ${rIdx === 0 ? "pr-4" : ""}`}
                                            />
                                            {rIdx === 0 && row.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveTableColumn(block, cIdx)}
                                                className="absolute top-1 right-1 p-0.5 rounded text-zinc-400 hover:text-red-600 hover:bg-white dark:hover:bg-zinc-900"
                                                title="Remove column"
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </CellTag>
                                    ))}
                                    {!isReadOnlyState && (
                                      <td className="w-7 px-1 align-top border-l border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40">
                                        {rIdx === 0 ? (
                                          <button
                                            type="button"
                                            onClick={() => handleAddTableColumn(block)}
                                            className="p-0.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                            title="Add column"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                          </button>
                                        ) : (
                                          (block.tableData?.length || 0) > 2 && (
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveTableRow(block, rIdx)}
                                              className="p-0.5 rounded text-zinc-400 hover:text-red-600 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                              title="Remove row"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {!isReadOnlyState && (
                          <button
                            type="button"
                            onClick={() => handleAddTableRow(block)}
                            className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-[11px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Row</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Block Delete Action */}
                    {!isReadOnlyState && (
                      <button
                        onClick={() => handleDeleteBlock(block.id)}
                        className="absolute -right-3 top-0 opacity-0 group-hover:opacity-100 p-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-red-600 transition-opacity"
                        title="Delete Block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Block Toolbar */}
              {!isReadOnlyState && (
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-[11px] font-bold uppercase text-zinc-400 mb-2">Insert New Block:</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleAddBlock("paragraph")}
                      className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Paragraph</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("student_tag", "important")}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 text-xs font-semibold flex items-center space-x-1"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Important</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("student_tag", "exam_point")}
                      className="px-2.5 py-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center space-x-1"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Exam Point</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("bullet_list")}
                      className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Bullet List</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("numbered_list")}
                      className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Numbered List</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("checklist")}
                      className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Checklist</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("quote")}
                      className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Quote</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("callout")}
                      className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Callout</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("table")}
                      className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>Table</span>
                    </button>
                    <button
                      onClick={() => handleAddBlock("code")}
                      className="px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-1"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Code Snippet</span>
                    </button>
                  </div>
                </div>
              )}

              {/* End of Topic Navigation Controls */}
              {activeSection && (() => {
                const activeIndex = sectionsList.findIndex((s) => s.id === activeSection.id);
                const prevTopic = activeIndex > 0 ? sectionsList[activeIndex - 1] : null;
                const nextTopic = activeIndex < sectionsList.length - 1 ? sectionsList[activeIndex + 1] : null;

                return (
                  <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center space-x-1">
                          <Compass className="w-3.5 h-3.5" />
                          <span>Topic Navigation ({activeIndex + 1} of {sectionsList.length})</span>
                        </span>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {activeSection.title}
                        </p>
                      </div>

                      {/* Topic Quick Jump Selector */}
                      <div className="flex items-center space-x-2">
                        <label htmlFor="topic-jump-select" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          Jump to topic:
                        </label>
                        <select
                          id="topic-jump-select"
                          value={activeSection.id}
                          onChange={(e) => setActiveSectionId(e.target.value)}
                          className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-medium focus:ring-1 focus:ring-zinc-500"
                        >
                          {sectionsList.map((s, idx) => (
                            <option key={s.id} value={s.id}>
                              Topic {idx + 1}: {s.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Prev / Next Buttons */}
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        disabled={!prevTopic}
                        onClick={() => prevTopic && setActiveSectionId(prevTopic.id)}
                        className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <div className="text-left">
                          <span className="text-[10px] block text-zinc-500 dark:text-zinc-400 font-normal">Previous Topic</span>
                          <span className="line-clamp-1">{prevTopic ? prevTopic.title : "None"}</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={!nextTopic}
                        onClick={() => nextTopic && setActiveSectionId(nextTopic.id)}
                        className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-xs"
                      >
                        <div className="text-right">
                          <span className="text-[10px] block opacity-80 font-normal">Next Topic</span>
                          <span className="line-clamp-1">{nextTopic ? nextTopic.title : "End of Notes"}</span>
                        </div>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          ) : (
            <div className="p-12 text-center text-zinc-500">Select a section to edit</div>
          )}
        </div>
      </div>

      {/* Floating Selection AI Action Menu */}
      {selectedText && selectionPos && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          style={{ top: Math.max(80, selectionPos.y - 60), left: Math.min(window.innerWidth - 320, Math.max(20, selectionPos.x - 150)) }}
          className="fixed z-50 bg-zinc-900 text-white rounded-2xl shadow-2xl border border-zinc-700 p-3 max-w-md w-80 space-y-2"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
            <span className="text-[10px] font-bold uppercase text-zinc-300 flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>AI Text Assistant</span>
            </span>
            <button
              onClick={() => { setSelectedText(""); setSelectionPos(null); }}
              className="text-xs text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              onClick={() => handleExecuteAiAction("explain_simply")}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left line-clamp-1"
            >
              💡 Explain Simply
            </button>
            <button
              onClick={() => handleExecuteAiAction("simplify")}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left line-clamp-1"
            >
              ⚡ Simplify
            </button>
            <button
              onClick={() => handleExecuteAiAction("give_example")}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left line-clamp-1"
            >
              📌 Give Example
            </button>
            <button
              onClick={() => handleExecuteAiAction("make_exam_answer")}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left line-clamp-1"
            >
              📝 Exam Answer
            </button>
            <button
              onClick={() => handleExecuteAiAction("create_analogy")}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left line-clamp-1"
            >
              🧠 Analogy
            </button>
            <button
              onClick={() => handleExecuteAiAction("translate")}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left line-clamp-1"
            >
              🌐 Translate
            </button>
          </div>

          {isAiExecuting && (
            <div className="py-2 text-center text-xs text-zinc-300 flex items-center justify-center space-x-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>AI is processing selection...</span>
            </div>
          )}

          {aiActionResult && (
            <div className="p-2.5 rounded-xl bg-zinc-800/90 text-xs text-zinc-200 space-y-2 max-h-40 overflow-y-auto border border-zinc-700">
              <p className="whitespace-pre-wrap">{aiActionResult}</p>
              <button
                onClick={handleInsertAiResult}
                className="w-full py-1 rounded bg-zinc-100 hover:bg-white text-zinc-900 font-semibold text-[11px]"
              >
                Insert Below Selection
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Publish Community Modal */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onSuccess={() => {
          setNote({ ...note, isCommunityPublished: true });
        }}
        preselectedNote={note}
      />

      {/* Collection Selector Modal */}
      <CollectionSelectorModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        itemTitle={note.title}
        currentCollectionId={note.collectionId}
        onSelectCollection={(colId) => {
          handleUpdateNote({ ...note, collectionId: colId || undefined });
          setShowCollectionModal(false);
        }}
      />

      {/* AI Flashcard Generator Modal */}
      <AIFlashcardGeneratorModal
        isOpen={showFlashcardModal}
        onClose={() => setShowFlashcardModal(false)}
        preselectedNote={note}
      />

      {/* Delete Note Confirm Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Study Note?"
        message={`Are you sure you want to delete "${note.title}"? This note and all nested flashcard decks and practice tests generated from it will be permanently deleted.`}
        confirmText="Delete Note"
        onConfirm={handleDeleteNote}
        onClose={() => setShowDeleteConfirm(false)}
      />

      {/* Full Screen View Overlay */}
      {isFullScreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden"
        >
          {/* Full Screen Minimal Header */}
          <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center space-x-3 min-w-0">
              <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shrink-0">
                {note.subject}
              </span>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {note.title}
                </h2>
                {activeSection && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    Topic {sectionsList.findIndex((s) => s.id === activeSection.id) + 1} of {sectionsList.length}: {activeSection.title}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsFullScreen(false)}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold flex items-center space-x-1.5 shadow-xs shrink-0 transition-colors"
              title="Exit Full Screen (Esc)"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Exit Full Screen</span>
            </button>
          </div>

          {/* Full Screen Pure Content Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
              {activeSection ? (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10 shadow-sm space-y-6">
                  <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                      {activeSection.title}
                    </h1>
                    {activeSection.summary && (
                      <p className="text-sm italic text-zinc-500 dark:text-zinc-400 mt-2">
                        Summary: {activeSection.summary}
                      </p>
                    )}
                  </div>

                  {/* Section Blocks */}
                  <div className="space-y-6">
                    {(activeSection.blocks || []).map((block) => (
                      <div key={block.id}>
                        {block.type === "heading" && (
                          <h3 className="font-bold text-lg sm:text-xl text-zinc-900 dark:text-zinc-100 py-1">
                            {block.content}
                          </h3>
                        )}

                        {block.type === "paragraph" && (
                          <p className="text-sm sm:text-base text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words py-1">
                            {block.content}
                          </p>
                        )}

                        {block.type === "student_tag" && (
                          <div className="p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100/90 dark:bg-zinc-800/90 text-zinc-900 dark:text-zinc-100 flex flex-col sm:flex-row items-start gap-3 w-full min-w-0">
                            <div className="shrink-0 font-bold uppercase text-[10px] px-2.5 py-1 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs tracking-wider">
                              {block.tagType?.replace("_", " ")}
                            </div>
                            <div className="flex-1 w-full min-w-0">
                              <p className="text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
                                {block.content}
                              </p>
                            </div>
                          </div>
                        )}

                        {block.type === "bullet_list" && (
                          <div className="space-y-2 pl-4 border-l-2 border-zinc-300 dark:border-zinc-700">
                            {block.items?.map((item, idx) => (
                              <div key={idx} className="flex items-start space-x-2.5 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 dark:bg-zinc-300 mt-2 shrink-0" />
                                <span className="whitespace-pre-wrap break-words">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {block.type === "code" && (
                          <div className="p-4 rounded-2xl bg-zinc-900 text-zinc-100 font-mono text-xs space-y-2 border border-zinc-800">
                            <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-800 pb-2">
                              <span>{block.language || "code"}</span>
                              <span>Source Code</span>
                            </div>
                            <pre className="overflow-x-auto text-xs font-mono text-zinc-200 whitespace-pre-wrap">{block.content}</pre>
                          </div>
                        )}

                        {block.type === "numbered_list" && (
                          <div className="space-y-2 pl-1">
                            {block.items?.map((item, idx) => (
                              <div key={idx} className="flex items-start space-x-2.5 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200">
                                <span className="font-bold text-zinc-500 dark:text-zinc-400 shrink-0 w-5 text-right">{idx + 1}.</span>
                                <span className="whitespace-pre-wrap break-words">{item}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {block.type === "checklist" && (
                          <div className="space-y-2">
                            {block.items?.map((item, idx) => {
                              const checked = !!block.checkedItems?.[idx];
                              return (
                                <div key={idx} className="flex items-center space-x-2.5 text-xs sm:text-sm">
                                  <span
                                    className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                                      checked
                                        ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100"
                                        : "border-zinc-300 dark:border-zinc-600"
                                    }`}
                                  >
                                    {checked && <Check className="w-3 h-3 text-white dark:text-zinc-900" />}
                                  </span>
                                  <span
                                    className={`whitespace-pre-wrap break-words ${
                                      checked ? "text-zinc-400 dark:text-zinc-500 line-through" : "text-zinc-800 dark:text-zinc-200"
                                    }`}
                                  >
                                    {item}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {block.type === "quote" && (
                          <blockquote className="pl-4 border-l-4 border-zinc-900 dark:border-zinc-100 py-1">
                            <p className="text-sm sm:text-base italic text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                              "{block.content}"
                            </p>
                          </blockquote>
                        )}

                        {block.type === "callout" && (
                          <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 flex items-start gap-3">
                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed whitespace-pre-wrap break-words">
                              {block.content}
                            </p>
                          </div>
                        )}

                        {block.type === "table" && (
                          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-700">
                            <table className="w-full text-xs sm:text-sm border-collapse table-fixed">
                              <tbody>
                                {(block.tableData || []).map((row, rIdx) => {
                                  const CellTag: any = rIdx === 0 ? "th" : "td";
                                  const colCount = row.length || 1;
                                  return (
                                    <tr key={rIdx} className={rIdx === 0 ? "bg-zinc-100 dark:bg-zinc-800" : "border-t border-zinc-200 dark:border-zinc-700"}>
                                      {row.map((cell, cIdx) => (
                                        <CellTag
                                          key={cIdx}
                                          style={{ width: `${100 / colCount}%` }}
                                          className={`px-3 py-2 text-left align-top border-r border-zinc-200 dark:border-zinc-700 last:border-r-0 whitespace-pre-wrap break-words ${
                                            rIdx === 0 ? "font-bold text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300"
                                          }`}
                                        >
                                          {cell}
                                        </CellTag>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-zinc-500">No topic content available.</div>
              )}
            </div>
          </div>

          {/* Full Screen Bottom Navigation Controls */}
          {activeSection && (() => {
            const activeIndex = sectionsList.findIndex((s) => s.id === activeSection.id);
            const prevTopic = activeIndex > 0 ? sectionsList[activeIndex - 1] : null;
            const nextTopic = activeIndex < sectionsList.length - 1 ? sectionsList[activeIndex + 1] : null;

            return (
              <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between gap-4 shadow-lg z-10">
                <button
                  type="button"
                  disabled={!prevTopic}
                  onClick={() => prevTopic && setActiveSectionId(prevTopic.id)}
                  className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-semibold flex items-center space-x-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous Topic</span>
                </button>

                <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  <span>Topic {activeIndex + 1} of {sectionsList.length}</span>
                </div>

                <button
                  type="button"
                  disabled={!nextTopic}
                  onClick={() => nextTopic && setActiveSectionId(nextTopic.id)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold flex items-center space-x-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="hidden sm:inline">Next Topic</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* Hidden Printable Container for Print / Save PDF */}
      <div className="hidden print:block font-sans text-black p-8 max-w-4xl mx-auto space-y-6">
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-3xl font-bold">{note.title}</h1>
          <p className="text-sm font-medium mt-1">
            Subject: {note.subject} | Learner Level: {note.learnerLevel} | Complexity: {note.complexity}
          </p>
        </div>
        {(note.sections || []).map((sec, idx) => (
          <div key={sec.id || idx} className="space-y-4 mb-8 page-break-inside-avoid">
            <h2 className="text-xl font-bold border-b border-gray-400 pb-1">
              Topic {idx + 1}: {sec.title}
            </h2>
            {sec.summary && <p className="text-sm italic text-gray-700">Summary: {sec.summary}</p>}
            {(sec.blocks || []).map((b) => (
              <div key={b.id} className="my-2">
                {b.type === "heading" && <h3 className="text-lg font-semibold mt-3">{b.content}</h3>}
                {b.type === "paragraph" && <p className="text-sm leading-relaxed">{b.content}</p>}
                {b.type === "student_tag" && (
                  <div className="p-3 bg-gray-100 border-l-4 border-black text-xs font-medium my-2">
                    <strong className="uppercase">{(b.tagType || "NOTE").replace("_", " ")}: </strong>
                    {b.content}
                  </div>
                )}
                {b.type === "bullet_list" && (
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {(b.items || []).map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                )}
                {b.type === "numbered_list" && (
                  <ol className="list-decimal pl-5 text-sm space-y-1">
                    {(b.items || []).map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ol>
                )}
                {b.type === "checklist" && (
                  <ul className="pl-5 text-sm space-y-1 list-none">
                    {(b.items || []).map((item, itemIdx) => (
                      <li key={itemIdx}>
                        [{b.checkedItems?.[itemIdx] ? "x" : " "}] {item}
                      </li>
                    ))}
                  </ul>
                )}
                {b.type === "quote" && (
                  <blockquote className="pl-4 border-l-4 border-black text-sm italic my-2">
                    "{b.content}"
                  </blockquote>
                )}
                {b.type === "callout" && (
                  <div className="p-3 bg-gray-100 border-l-4 border-black text-xs font-medium my-2">
                    <strong className="uppercase">Note: </strong>
                    {b.content}
                  </div>
                )}
                {b.type === "table" && (
                  <table className="w-full text-xs my-2" style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
                    <tbody>
                      {(b.tableData || []).map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => {
                            const CellTag: any = rIdx === 0 ? "th" : "td";
                            return (
                              <CellTag
                                key={cIdx}
                                style={{ width: `${100 / (row.length || 1)}%` }}
                                className={`border border-gray-400 px-2 py-1 text-left break-words whitespace-pre-wrap ${rIdx === 0 ? "font-bold bg-gray-100" : ""}`}
                              >
                                {cell}
                              </CellTag>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {b.type === "code" && (
                  <pre className="p-3 bg-gray-900 text-gray-100 font-mono text-xs rounded my-2 overflow-x-auto">
                    <code>{b.content}</code>
                  </pre>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
