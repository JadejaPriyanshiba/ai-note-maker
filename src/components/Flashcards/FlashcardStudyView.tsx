import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RotateCw,
  HelpCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Award,
  Volume2
} from "lucide-react";
import { Flashcard, FlashcardDeck } from "../../types";
import { recordCardReview } from "../../lib/storage";
import { fadeInUp, scaleIn } from "../../lib/motion";

interface FlashcardStudyViewProps {
  deckTitle: string;
  cards: Flashcard[];
  onBack: () => void;
  onFinishStudy?: () => void;
}

export const FlashcardStudyView: React.FC<FlashcardStudyViewProps> = ({
  deckTitle,
  cards,
  onBack,
  onFinishStudy,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Session Statistics
  const [sessionResults, setSessionResults] = useState<{
    againCount: number;
    hardCount: number;
    goodCount: number;
    easyCount: number;
  }>({
    againCount: 0,
    hardCount: 0,
    goodCount: 0,
    easyCount: 0,
  });

  const [isCompleted, setIsCompleted] = useState(false);

  const currentCard = cards[currentIndex];

  useEffect(() => {
    setIsFlipped(false);
    setShowHint(false);
    setShowExplanation(false);
  }, [currentIndex]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;

      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "SELECT" ||
          activeElement.tagName === "TEXTAREA")
      ) {
        return;
      }

      if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (isFlipped) {
        if (e.key === "1") handleRate("again");
        else if (e.key === "2") handleRate("hard");
        else if (e.key === "3") handleRate("good");
        else if (e.key === "4") handleRate("easy");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, isCompleted, currentIndex, cards]);

  const handleRate = (rating: "again" | "hard" | "good" | "easy") => {
    if (!currentCard) return;

    recordCardReview(currentCard.id, rating);

    // Update Session Results
    setSessionResults((prev) => ({
      againCount: prev.againCount + (rating === "again" ? 1 : 0),
      hardCount: prev.hardCount + (rating === "hard" ? 1 : 0),
      goodCount: prev.goodCount + (rating === "good" ? 1 : 0),
      easyCount: prev.easyCount + (rating === "easy" ? 1 : 0),
    }));

    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!cards || cards.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-sm font-bold text-zinc-600 dark:text-zinc-400">No cards to study in this deck.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-colors"
        >
          Return to Deck
        </button>
      </div>
    );
  }

  if (isCompleted) {
    const total = cards.length;
    const mastered = sessionResults.goodCount + sessionResults.easyCount;
    const percentage = Math.round((mastered / total) * 100);

    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="show"
        className="max-w-md mx-auto px-4 py-12 space-y-6 text-center"
      >
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-900 dark:text-white">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Session Complete!</h2>
            <p className="text-xs text-zinc-500">You reviewed all {total} cards in "{deckTitle}".</p>
          </div>

          {/* Mastered percentage */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-1">
            <span className="text-3xl font-black text-zinc-900 dark:text-white">{percentage}%</span>
            <p className="text-xs font-semibold text-zinc-500">Retention Score</p>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <p className="font-bold text-red-700 dark:text-red-400">{sessionResults.againCount}</p>
              <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">Again</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <p className="font-bold text-amber-700 dark:text-amber-400">{sessionResults.hardCount}</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Hard</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <p className="font-bold text-emerald-700 dark:text-emerald-400">{sessionResults.goodCount}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Good</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <p className="font-bold text-blue-700 dark:text-blue-400">{sessionResults.easyCount}</p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Easy</p>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setIsCompleted(false);
                setSessionResults({ againCount: 0, hardCount: 0, goodCount: 0, easyCount: 0 });
              }}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold transition-colors"
            >
              Study Deck Again
            </button>
            <button
              onClick={onBack}
              className="w-full py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Return to Library
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Session</span>
        </button>

        <span className="text-xs font-bold text-zinc-900 dark:text-white truncate max-w-[180px] sm:max-w-[260px]">
          {deckTitle}
        </span>

        {/* Card Selector Dropdown */}
        <div className="flex items-center space-x-1">
          <select
            value={currentIndex}
            onChange={(e) => setCurrentIndex(Number(e.target.value))}
            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-2.5 py-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 cursor-pointer focus:outline-hidden"
            aria-label="Jump to card"
          >
            {cards.map((card, idx) => (
              <option key={card.id || idx} value={idx}>
                Card {idx + 1} / {cards.length}
                {card.front ? `: ${card.front.slice(0, 20)}...` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Bar & Quick Navigation */}
      <div className="space-y-3">
        <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
          />
        </div>

        {/* Navigation Toolbar (Prev / Quick Numbers / Next) */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-semibold text-xs flex items-center space-x-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
            title="Previous Card (← Arrow Left)"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Quick Card Pill Picker */}
          <div className="flex items-center space-x-1 overflow-x-auto max-w-[200px] sm:max-w-[320px] scrollbar-none py-1 px-1">
            {cards.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-7 h-7 rounded-lg text-xs font-bold shrink-0 transition-all ${
                  idx === currentIndex
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs"
                    : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
                title={`Go to Card ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={currentIndex === cards.length - 1}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-semibold text-xs flex items-center space-x-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
            title="Next Card (→ Arrow Right)"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Flip Flashcard Container */}
      <div className="perspective-1000 min-h-[320px] relative">
        <motion.div
          key={currentCard.id || currentIndex}
          variants={scaleIn}
          initial="hidden"
          animate="show"
          onClick={() => setIsFlipped((prev) => !prev)}
          className={`w-full min-h-[320px] rounded-3xl bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 p-8 shadow-xl transition-colors duration-300 cursor-pointer flex flex-col justify-between select-none ${
            isFlipped ? "border-zinc-400 dark:border-zinc-600 shadow-2xl" : ""
          }`}
        >
          {/* Card Top Row */}
          <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
            <span className="uppercase tracking-wider">
              {isFlipped ? "Answer (Back)" : "Question (Front)"}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speakText(isFlipped ? currentCard.back : currentCard.front);
                }}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
                title="Read aloud"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-semibold text-zinc-400">
                [Space to flip • ← → to navigate]
              </span>
            </div>
          </div>

          {/* Card Main Text */}
          <div className="my-6 space-y-3">
            <p className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white leading-relaxed">
              {isFlipped ? currentCard.back : currentCard.front}
            </p>

            {/* Hint Accordion (Front) */}
            {!isFlipped && currentCard.hint && (
              <div className="pt-2">
                {!showHint ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHint(true);
                    }}
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center space-x-1"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Show Hint</span>
                  </button>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 italic">
                    💡 Hint: {currentCard.hint}
                  </p>
                )}
              </div>
            )}

            {/* Explanation & Example Accordion (Back) */}
            {isFlipped && (currentCard.explanation || currentCard.example) && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                {currentCard.explanation && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    📖 <strong className="text-zinc-900 dark:text-white">Explanation:</strong> {currentCard.explanation}
                  </p>
                )}
                {currentCard.example && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                    🔍 <strong className="text-zinc-800 dark:text-zinc-200">Example:</strong> {currentCard.example}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Flip Prompt Footer */}
          <div className="flex items-center justify-center pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-400 font-semibold space-x-1.5">
            <RotateCw className="w-3.5 h-3.5" />
            <span>Click card or press Space to {isFlipped ? "flip back" : "reveal answer"}</span>
          </div>
        </motion.div>
      </div>

      {/* Rating Buttons (Available when card is flipped) */}
      <AnimatePresence mode="wait">
        {isFlipped ? (
          <motion.div key="rating" variants={fadeInUp} initial="hidden" animate="show" className="space-y-2">
            <p className="text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">
              How well did you know this? (Keys 1 - 4)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => handleRate("again")}
                className="p-3 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 font-bold text-xs flex flex-col items-center justify-center space-y-0.5 transition-all"
              >
                <span>1. Again</span>
                <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">&lt; 15 mins</span>
              </button>

              <button
                onClick={() => handleRate("hard")}
                className="p-3 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 font-bold text-xs flex flex-col items-center justify-center space-y-0.5 transition-all"
              >
                <span>2. Hard</span>
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">1 day</span>
              </button>

              <button
                onClick={() => handleRate("good")}
                className="p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold text-xs flex flex-col items-center justify-center space-y-0.5 transition-all"
              >
                <span>3. Good</span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">3 days</span>
              </button>

              <button
                onClick={() => handleRate("easy")}
                className="p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 font-bold text-xs flex flex-col items-center justify-center space-y-0.5 transition-all"
              >
                <span>4. Easy</span>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">7 days</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="show-answer" variants={fadeInUp} initial="hidden" animate="show" className="text-center py-2">
            <button
              onClick={() => setIsFlipped(true)}
              className="px-6 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-bold shadow-xs transition-colors"
            >
              Show Answer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
