import React, { useState } from "react";
import { LearnerLevel, Complexity, Depth, NoteLanguage, NoteDocument } from "../types";
import { generateRoadmap } from "../lib/aiService";
import { getSavedNotes, getCommunityNotes, getTestAttempts } from "../lib/storage";
import { Sparkles, BookOpen, Clock, AlertTriangle, ArrowRight, Layers, FileText, Globe } from "lucide-react";

interface HomeViewProps {
  onStartRoadmap: (
    subject: string,
    learnerLevel: LearnerLevel,
    complexity: Complexity,
    depth: Depth,
    language: NoteLanguage,
    instructions: string,
    initialTopics: { title: string; description: string; estimatedMinutes?: number }[]
  ) => void;
  onOpenNoteStudio: (note: NoteDocument) => void;
  onOpenCommunity: () => void;
  onOpenTests: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onStartRoadmap,
  onOpenNoteStudio,
  onOpenCommunity,
  onOpenTests,
}) => {
  const [subject, setSubject] = useState<string>("");
  const [mainTopic, setMainTopic] = useState<string>("");
  
  // Learner Level
  const [learnerLevelSelect, setLearnerLevelSelect] = useState<string>("Undergraduate");
  const [learnerLevelCustom, setLearnerLevelCustom] = useState<string>("");

  // Complexity
  const [complexitySelect, setComplexitySelect] = useState<string>("Medium");
  const [complexityCustom, setComplexityCustom] = useState<string>("");

  // Depth
  const [depthSelect, setDepthSelect] = useState<string>("Standard notes");
  const [depthCustom, setDepthCustom] = useState<string>("");

  // Language
  const [languageSelect, setLanguageSelect] = useState<string>("English");
  const [languageCustom, setLanguageCustom] = useState<string>("");

  const [instructions, setInstructions] = useState<string>("");
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState<boolean>(false);

  const savedNotes = getSavedNotes();
  const communityNotes = getCommunityNotes();
  const testAttempts = getTestAttempts();

  // Find recent weak topics if any from recent test attempts
  const recentAttempt = testAttempts[0];
  const weakTopics = recentAttempt?.weakTopicTitles || [];

  const handleGenerateRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      alert("Please enter a subject or topic to learn.");
      return;
    }

    const finalLearnerLevel = learnerLevelSelect === "Other" ? (learnerLevelCustom.trim() || "General learner") : learnerLevelSelect;
    const finalComplexity = complexitySelect === "Other" ? (complexityCustom.trim() || "Medium") : complexitySelect;
    const finalDepth = depthSelect === "Other" ? (depthCustom.trim() || "Standard notes") : depthSelect;
    const finalLanguage = languageSelect === "Other" ? (languageCustom.trim() || "English") : languageSelect;

    setIsGeneratingRoadmap(true);
    try {
      const topics = await generateRoadmap({
        subject: subject.trim(),
        mainTopic: mainTopic.trim() || subject.trim(),
        learnerLevel: finalLearnerLevel,
        complexity: finalComplexity,
        depth: finalDepth,
        language: finalLanguage,
        instructions: instructions.trim(),
      });

      onStartRoadmap(
        subject.trim(),
        finalLearnerLevel,
        finalComplexity,
        finalDepth,
        finalLanguage,
        instructions.trim(),
        topics
      );
    } catch (err: any) {
      alert("Failed to generate study roadmap: " + (err.message || "Please try again."));
    } finally {
      setIsGeneratingRoadmap(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero Learning Roadmap Generator Section */}
      <div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6 relative overflow-hidden">
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium border border-zinc-200 dark:border-zinc-700">
            <Sparkles className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
            <span>AI Study Assistant</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-zinc-900 dark:text-white">
            What do you want to learn today?
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 font-light leading-relaxed">
            Enter any subject or course syllabus. Our AI will craft an editable step-by-step roadmap and generate structured study notes topic by topic.
          </p>
        </div>

        {/* Generator Form */}
        <form onSubmit={handleGenerateRoadmap} className="space-y-4 relative z-10 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Computer Networks, Organic Chemistry..."
                required
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-sm font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Specific Topic Focus (Optional)
              </label>
              <input
                type="text"
                value={mainTopic}
                onChange={(e) => setMainTopic(e.target.value)}
                placeholder="e.g. OSI Model, Reactions mechanism..."
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-sm font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>

          {/* Options Grid with 'Other' text input support */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* Learner Level */}
            <div className="space-y-1.5">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">Learner Level</label>
              <select
                value={learnerLevelSelect}
                onChange={(e) => setLearnerLevelSelect(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="School">School</option>
                <option value="Diploma">Diploma</option>
                <option value="Undergraduate">Undergraduate</option>
                <option value="Postgraduate">Postgraduate</option>
                <option value="Professional">Professional</option>
                <option value="General learner">General learner</option>
                <option value="Other">Other (Custom)...</option>
              </select>
              {learnerLevelSelect === "Other" && (
                <input
                  type="text"
                  placeholder="Enter custom learner level..."
                  value={learnerLevelCustom}
                  onChange={(e) => setLearnerLevelCustom(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-xs font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              )}
            </div>

            {/* Complexity */}
            <div className="space-y-1.5">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">Complexity</label>
              <select
                value={complexitySelect}
                onChange={(e) => setComplexitySelect(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="Beginner">Beginner</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
                <option value="Other">Other (Custom)...</option>
              </select>
              {complexitySelect === "Other" && (
                <input
                  type="text"
                  placeholder="Enter custom complexity..."
                  value={complexityCustom}
                  onChange={(e) => setComplexityCustom(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-xs font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              )}
            </div>

            {/* Depth */}
            <div className="space-y-1.5">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">Depth</label>
              <select
                value={depthSelect}
                onChange={(e) => setDepthSelect(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="Quick revision">Quick revision</option>
                <option value="Standard notes">Standard notes</option>
                <option value="Detailed notes">Detailed notes</option>
                <option value="Exam preparation">Exam preparation</option>
                <option value="Other">Other (Custom)...</option>
              </select>
              {depthSelect === "Other" && (
                <input
                  type="text"
                  placeholder="Enter custom depth..."
                  value={depthCustom}
                  onChange={(e) => setDepthCustom(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-xs font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              )}
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label className="block font-medium text-zinc-700 dark:text-zinc-300">Language</label>
              <select
                value={languageSelect}
                onChange={(e) => setLanguageSelect(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Gujarati">Gujarati</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Other">Other (Custom)...</option>
              </select>
              {languageSelect === "Other" && (
                <input
                  type="text"
                  placeholder="Enter custom language..."
                  value={languageCustom}
                  onChange={(e) => setLanguageCustom(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-xs font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Custom Instructions (Optional)
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Focus on practical exam answers, include code examples & mnemonics..."
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-xs font-light focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isGeneratingRoadmap}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 font-medium text-sm shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>{isGeneratingRoadmap ? "Creating Study Roadmap..." : "Create Learning Roadmap"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Weak Topics Review Alert (if any from recent test) */}
      {weakTopics.length > 0 && (
        <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-zinc-800 dark:text-zinc-200 shrink-0" />
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Weak Topic Revision Alert</h4>
              <p className="text-xs text-zinc-800 dark:text-zinc-200 font-light">
                You scored below 60% on: <strong className="font-semibold">{weakTopics.join(", ")}</strong> in your recent test.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenTests}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium shrink-0"
          >
            Review Weak Areas
          </button>
        </div>
      )}

      {/* Continue Learning / Recent Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <span>Recent Study Notes ({savedNotes.length})</span>
          </h2>
        </div>

        {savedNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {savedNotes.slice(0, 3).map((note) => {
              const completedCount = (note.roadmap || []).filter((t) => t.status === "completed").length;
              const totalCount = (note.roadmap || []).length;
              const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <div
                  key={note.id}
                  onClick={() => onOpenNoteStudio(note)}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                      {note.subject}
                    </span>
                    <span className="text-zinc-400 font-light">{note.learnerLevel}</span>
                  </div>

                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1">
                    {note.title}
                  </h3>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-500 font-light">
                      <span>Progress</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center text-zinc-500 text-xs font-light">
            No notes generated yet. Type a subject above to start your first roadmap!
          </div>
        )}
      </div>

      {/* Recommended Community Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <Globe className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <span>Recommended Community Notes</span>
          </h2>
          <button
            onClick={onOpenCommunity}
            className="text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:underline flex items-center space-x-1"
          >
            <span>Explore Library</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {communityNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communityNotes.slice(0, 2).map((comm) => (
              <div
                key={comm.id}
                onClick={onOpenCommunity}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
                  <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                    {comm.subject}
                  </span>
                  <span className="text-zinc-400 font-light">by @{comm.authorName}</span>
                </div>
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1">
                  {comm.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-light line-clamp-2">
                  {comm.description}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center text-zinc-500 text-xs font-light">
            No community notes published yet. Be the first to share your study notes with the community!
          </div>
        )}
      </div>
    </div>
  );
};
