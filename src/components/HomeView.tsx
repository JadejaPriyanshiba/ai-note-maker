import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fadeInUp, staggerContainer } from "../lib/motion";
import { LearnerLevel, Complexity, Depth, NoteLanguage, NoteDocument } from "../types";
import { generateRoadmap } from "../lib/aiService";
import { getSavedNotes, getCommunityNotes, getTestAttempts, getFlashcardDecks } from "../lib/storage";
import { EmptyState } from "./EmptyState";
import {
  BookOpen,
  AlertTriangle,
  ArrowRight,
  Layers,
  Globe,
  Wand2,
  SlidersHorizontal,
  ChevronDown,
  Loader2,
  CheckCircle2,
  TrendingUp,
  PlayCircle,
} from "lucide-react";

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
  onContinueGeneration: (note: NoteDocument) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onStartRoadmap,
  onOpenNoteStudio,
  onOpenCommunity,
  onOpenTests,
  onContinueGeneration,
}) => {
  const [subject, setSubject] = useState<string>("");
  const [mainTopic, setMainTopic] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

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
  const decks = getFlashcardDecks();

  // Find recent weak topics if any from recent test attempts
  const recentAttempt = testAttempts[0];
  const weakTopics = recentAttempt?.weakTopicTitles || [];

  const stats = useMemo(() => {
    const topicsCompleted = savedNotes.reduce(
      (sum, n) => sum + (n.roadmap || []).filter((t) => t.status === "completed").length,
      0
    );
    const avgScore =
      testAttempts.length > 0
        ? Math.round(testAttempts.reduce((s, a) => s + a.percentage, 0) / testAttempts.length)
        : null;

    return [
      { label: "Study Notes", value: savedNotes.length, icon: BookOpen },
      { label: "Topics Mastered", value: topicsCompleted, icon: CheckCircle2 },
      { label: "Flashcard Decks", value: decks.length, icon: Layers },
      { label: "Avg. Test Score", value: avgScore !== null ? `${avgScore}%` : "—", icon: TrendingUp },
    ];
  }, [savedNotes, decks, testAttempts]);

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

  const selectClass =
    "w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-shadow";
  const customInputClass =
    "w-full p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10 sm:space-y-14">
      {/* Hero Learning Roadmap Generator Section */}
      <motion.section
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 sm:px-12 py-10 sm:py-16 shadow-sm"
      >
        {/* Decorative ambient gradient blobs — purely cosmetic, layered behind content */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-emerald-200/40 dark:bg-emerald-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-zinc-200/70 dark:bg-zinc-700/20 blur-3xl"
        />

        <div className="relative z-10 max-w-2xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span>AI Study Assistant</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.08] text-zinc-900 dark:text-white">
            What do you want to{" "}
            <span className="text-zinc-400 dark:text-zinc-500">learn</span> today?
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Drop in any subject or course syllabus — we'll draft a roadmap you approve, then build
            structured study notes topic by topic.
          </p>
        </div>

        {/* Generator Form */}
        <form onSubmit={handleGenerateRoadmap} className="relative z-10 max-w-2xl mx-auto mt-8 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 focus-within:ring-2 focus-within:ring-zinc-900/10 dark:focus-within:ring-white/10 transition-shadow">
            <div className="flex-1 flex items-center gap-2 px-3">
              <Wand2 className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Computer Networks, Organic Chemistry..."
                required
                className="w-full bg-transparent py-3 text-sm font-semibold text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isGeneratingRoadmap}
              className="shrink-0 px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingRoadmap ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Building roadmap…</span>
                </>
              ) : (
                <>
                  <span>Create Roadmap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors py-1"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showAdvanced ? "Hide" : "Customize"} level, depth &amp; language</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="pt-1 space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Specific Topic Focus (Optional)
                    </label>
                    <input
                      type="text"
                      value={mainTopic}
                      onChange={(e) => setMainTopic(e.target.value)}
                      placeholder="e.g. OSI Model, Reactions mechanism..."
                      className={customInputClass + " py-3"}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {/* Learner Level */}
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300">Learner Level</label>
                      <select
                        value={learnerLevelSelect}
                        onChange={(e) => setLearnerLevelSelect(e.target.value)}
                        className={selectClass}
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
                          className={customInputClass}
                        />
                      )}
                    </div>

                    {/* Complexity */}
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300">Complexity</label>
                      <select
                        value={complexitySelect}
                        onChange={(e) => setComplexitySelect(e.target.value)}
                        className={selectClass}
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
                          className={customInputClass}
                        />
                      )}
                    </div>

                    {/* Depth */}
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300">Depth</label>
                      <select
                        value={depthSelect}
                        onChange={(e) => setDepthSelect(e.target.value)}
                        className={selectClass}
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
                          className={customInputClass}
                        />
                      )}
                    </div>

                    {/* Language */}
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300">Language</label>
                      <select
                        value={languageSelect}
                        onChange={(e) => setLanguageSelect(e.target.value)}
                        className={selectClass}
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
                          className={customInputClass}
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Custom Instructions (Optional)
                    </label>
                    <input
                      type="text"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. Focus on practical exam answers, include code examples & mnemonics..."
                      className={customInputClass + " py-3"}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.section>

      {/* Quick Stats Strip */}
      <motion.div
        variants={staggerContainer()}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
      >
        {stats.map(({ label, value, icon: Icon }) => (
          <motion.div
            key={label}
            variants={fadeInUp}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
          >
            <Icon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 mb-2.5" />
            <p className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight">{value}</p>
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">{label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Weak Topics Review Alert (if any from recent test) */}
      {weakTopics.length > 0 && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Weak Topic Revision Alert
              </h4>
              <p className="text-xs text-amber-900 dark:text-amber-200/90 mt-0.5">
                You scored below 60% on <strong className="font-bold">{weakTopics.join(", ")}</strong> in your recent test.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenTests}
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <span>Review Weak Areas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}

      {/* Continue Learning / Recent Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500" />
            <span>Continue Learning</span>
          </h2>
          {savedNotes.length > 0 && (
            <span className="text-xs font-semibold text-zinc-400">{savedNotes.length} note{savedNotes.length === 1 ? "" : "s"}</span>
          )}
        </div>

        {savedNotes.length > 0 ? (
          <motion.div
            variants={staggerContainer()}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {savedNotes.slice(0, 3).map((note) => {
              const completedCount = (note.roadmap || []).filter((t) => t.status === "completed").length;
              const skippedCount = (note.roadmap || []).filter((t) => t.status === "skipped").length;
              const totalCount = (note.roadmap || []).length;
              const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
              // Left incomplete by a closed tab, reload, or navigating away mid-generation — no
              // background job is tracking it anymore, so surface an explicit way to resume.
              const isIncomplete = totalCount > 0 && completedCount + skippedCount < totalCount;

              return (
                <motion.div
                  key={note.id}
                  variants={fadeInUp}
                  onClick={() => onOpenNoteStudio(note)}
                  className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:shadow-lg hover:-translate-y-0.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wide">
                      {note.subject}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 group-hover:translate-x-0.5 transition-all" />
                  </div>

                  <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug min-h-[2.5em]">
                    {note.title}
                  </h3>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                      <span>{completedCount}/{totalCount} topics</span>
                      <span className="font-bold text-zinc-600 dark:text-zinc-300">{percent}%</span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {isIncomplete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onContinueGeneration(note);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors"
                      title="Resume generating the remaining topics"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Continue Generating</span>
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <EmptyState
            icon={BookOpen}
            message="No notes generated yet. Type a subject above to start your first roadmap!"
          />
        )}
      </div>

      {/* Recommended Community Notes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Globe className="w-4.5 h-4.5 text-zinc-400 dark:text-zinc-500" />
            <span>Recommended Community Notes</span>
          </h2>
          <button
            onClick={onOpenCommunity}
            className="text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>Explore Library</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {communityNotes.length > 0 ? (
          <motion.div
            variants={staggerContainer()}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {communityNotes.slice(0, 2).map((comm) => (
              <motion.div
                key={comm.id}
                variants={fadeInUp}
                onClick={onOpenCommunity}
                className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-xs hover:shadow-lg hover:-translate-y-0.5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wide">
                    {comm.subject}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                    <div className="w-4.5 h-4.5 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-600 dark:text-zinc-300">
                      {comm.authorName?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span>@{comm.authorName}</span>
                  </div>
                </div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-1">
                  {comm.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {comm.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <EmptyState
            icon={Globe}
            message="No community notes published yet. Be the first to share your study notes with the community!"
          />
        )}
      </div>
    </div>
  );
};
