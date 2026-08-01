import React, { useState } from "react";
import { Question, QuestionType, TestConfig } from "../../types";
import { generateTestQuestions } from "../../lib/aiService";
import { Edit2, Trash2, ArrowUp, ArrowDown, Sparkles, Plus, Check, Play, Save, FileText, X } from "lucide-react";

interface QuestionPreviewEditorProps {
  initialQuestions: Question[];
  config: TestConfig;
  onSaveTest: (questions: Question[]) => void;
  onStartTest: (questions: Question[]) => void;
  onBack: () => void;
}

export const QuestionPreviewEditor: React.FC<QuestionPreviewEditorProps> = ({
  initialQuestions,
  config,
  onSaveTest,
  onStartTest,
  onBack,
}) => {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // New question form state
  const [newType, setNewType] = useState<QuestionType>("mcq");
  const [newTopicTitle, setNewTopicTitle] = useState(config.subject || "General");
  const [newText, setNewText] = useState("");
  const [newOptions, setNewOptions] = useState<string[]>(["Option A", "Option B", "Option C", "Option D"]);
  const [newAnswer, setNewAnswer] = useState("");
  const [newExplanation, setNewExplanation] = useState("");

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const copy = [...questions];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    setQuestions(copy);
  };

  const handleMoveDown = (index: number) => {
    if (index === questions.length - 1) return;
    const copy = [...questions];
    const temp = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = temp;
    setQuestions(copy);
  };

  const handleDelete = (id: string) => {
    if (questions.length <= 1) {
      alert("A test must have at least 1 question.");
      return;
    }
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleStartEdit = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditingQuestion({ ...q });
  };

  const handleSaveEdit = () => {
    if (!editingQuestion) return;
    setQuestions(questions.map((q) => (q.id === editingQuestion.id ? editingQuestion : q)));
    setEditingQuestionId(null);
    setEditingQuestion(null);
  };

  const handleRegenerateSingle = async (q: Question) => {
    setRegeneratingId(q.id);
    try {
      const result = await generateTestQuestions({
        subject: config.subject,
        topics: [{ id: q.topicId || "top_1", title: q.topicTitle || "General Topic" }],
        questionCount: 1,
        difficulty: config.difficulty,
        questionTypes: [q.type],
      });

      if (result && result.length > 0) {
        const replacement = {
          ...result[0],
          id: q.id,
          topicId: q.topicId,
          topicTitle: q.topicTitle,
        };
        setQuestions(questions.map((orig) => (orig.id === q.id ? replacement : orig)));
      }
    } catch (err: any) {
      alert("Failed to regenerate question: " + err.message);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleAddManualQuestion = () => {
    if (!newText.trim() || !newAnswer.trim()) {
      alert("Please provide question text and correct answer.");
      return;
    }

    const created: Question = {
      id: `q_manual_${Date.now()}`,
      topicId: `top_${Date.now()}`,
      topicTitle: newTopicTitle.trim() || config.subject,
      type: newType,
      question: newText.trim(),
      options: newType === "mcq" ? newOptions : undefined,
      correctAnswer: newAnswer.trim(),
      explanation: newExplanation.trim() || "Manual question.",
    };

    setQuestions([...questions, created]);
    setIsAddModalOpen(false);
    // Reset form
    setNewText("");
    setNewAnswer("");
    setNewExplanation("");
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 max-w-4xl mx-auto space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Assessment Preview & Customization
          </span>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
            Review Questions ({questions.length})
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question</span>
          </button>
          <button
            type="button"
            onClick={() => onSaveTest(questions)}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center space-x-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>Save Test</span>
          </button>
          <button
            type="button"
            onClick={() => onStartTest(questions)}
            className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center space-x-1.5 shadow-sm"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Test Now</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
        {questions.map((q, idx) => {
          const isEditing = editingQuestionId === q.id;

          if (isEditing && editingQuestion) {
            return (
              <div
                key={q.id}
                className="p-5 rounded-2xl border border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Editing Question #{idx + 1}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditingQuestionId(null)}
                      className="text-xs text-zinc-500 font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-3 py-1 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Topic Title</label>
                    <input
                      type="text"
                      value={editingQuestion.topicTitle}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, topicTitle: e.target.value })
                      }
                      className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Question Prompt</label>
                    <textarea
                      rows={2}
                      value={editingQuestion.question}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, question: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  {editingQuestion.type === "mcq" && editingQuestion.options && (
                    <div className="space-y-1.5">
                      <label className="block font-bold text-zinc-700 dark:text-zinc-300">MCQ Options (A, B, C, D)</label>
                      {editingQuestion.options.map((opt, oIdx) => (
                        <input
                          key={oIdx}
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...(editingQuestion.options || [])];
                            newOpts[oIdx] = e.target.value;
                            setEditingQuestion({ ...editingQuestion, options: newOpts });
                          }}
                          className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                        />
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Correct Answer</label>
                    <input
                      type="text"
                      value={editingQuestion.correctAnswer}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, correctAnswer: e.target.value })
                      }
                      className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Explanation</label>
                    <textarea
                      rows={2}
                      value={editingQuestion.explanation}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, explanation: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={q.id}
              className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">#{idx + 1}</span>
                  <span className="px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[10px] uppercase">
                    {q.type}
                  </span>
                  <span className="text-zinc-500 font-medium">• {q.topicTitle}</span>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => handleMoveUp(idx)}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveDown(idx)}
                    disabled={idx === questions.length - 1}
                    className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRegenerateSingle(q)}
                    disabled={regeneratingId === q.id}
                    className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    title="Regenerate Question using AI"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartEdit(q)}
                    className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    title="Edit Question"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    className="p-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
                    title="Delete Question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 leading-snug">
                {q.question}
              </h4>

              {q.type === "mcq" && q.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {q.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`p-2 rounded-xl border text-xs ${
                        opt === q.correctAnswer || q.correctAnswer.startsWith(opt)
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 font-bold"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              )}

              {q.type !== "mcq" && (
                <div className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs">
                  <span className="font-bold text-zinc-500 uppercase text-[10px]">Correct Answer:</span>{" "}
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{q.correctAnswer}</span>
                </div>
              )}

              {q.explanation && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                  Explanation: {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Manual Question Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-base">Add Custom Question</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Question Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as QuestionType)}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="true_false">True / False</option>
                  <option value="fill_blank">Fill in the Blank</option>
                  <option value="one_word">One Word</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Topic Name</label>
                <input
                  type="text"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Question Prompt</label>
                <textarea
                  rows={2}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="e.g. Which protocol operates at the Transport layer?"
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              {newType === "mcq" && (
                <div className="space-y-1.5">
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300">MCQ Options</label>
                  {newOptions.map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const copy = [...newOptions];
                        copy[idx] = e.target.value;
                        setNewOptions(copy);
                      }}
                      className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                    />
                  ))}
                </div>
              )}

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Correct Answer {newType === "mcq" ? "(e.g. Option A or full text)" : newType === "true_false" ? "(True or False)" : ""}
                </label>
                <input
                  type="text"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Enter exact correct answer..."
                  className="w-full p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Explanation</label>
                <textarea
                  rows={2}
                  value={newExplanation}
                  onChange={(e) => setNewExplanation(e.target.value)}
                  placeholder="Reason why this answer is correct..."
                  className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddManualQuestion}
                className="px-5 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs"
              >
                Add Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
