import React, { useState, useEffect, useRef } from "react";
import { NoteDocument } from "../../types";
import { PodcastPlayer } from "./PodcastPlayer";
import {
  Play, Pause, Square, SkipBack, SkipForward, ShieldAlert,
  Car, Radio, ArrowLeft
} from "lucide-react";

interface AudioLearningViewProps {
  note: NoteDocument;
  onBack: () => void;
}

export const AudioLearningView: React.FC<AudioLearningViewProps> = ({ note, onBack }) => {
  const [activeTab, setActiveTab] = useState<"standard" | "focus" | "podcast">("standard");
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(0);

  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        setVoices(available);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const sectionsList = note?.sections || [];
  const currentSection = sectionsList[activeSectionIndex] || sectionsList[0];

  const getSectionSpeechText = (): string => {
    if (!currentSection) return note?.title || "";
    let text = `${currentSection.title}. `;
    if (currentSection.summary) text += `${currentSection.summary}. `;
    (currentSection.blocks || []).forEach((b) => {
      text += `${b.content}. `;
    });
    return text;
  };

  const handlePlay = () => {
    if (!synthRef.current) {
      alert("Speech synthesis is not supported on this browser.");
      return;
    }

    if (synthRef.current.paused) {
      synthRef.current.resume();
      setIsPlaying(true);
      return;
    }

    synthRef.current.cancel();

    const text = getSectionSpeechText();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = playbackSpeed;
    if (voices[selectedVoiceIndex]) {
      utterance.voice = voices[selectedVoiceIndex];
    }

    utterance.onend = () => {
      setIsPlaying(false);
      if (activeTab === "standard" && activeSectionIndex < sectionsList.length - 1) {
        setActiveSectionIndex((prev) => prev + 1);
      }
    };

    utterance.onerror = () => setIsPlaying(false);

    synthRef.current.speak(utterance);
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (synthRef.current) {
      synthRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsPlaying(false);
    }
  };

  const handleNextSection = () => {
    handleStop();
    if (activeSectionIndex < sectionsList.length - 1) {
      setActiveSectionIndex(activeSectionIndex + 1);
    }
  };

  const handlePrevSection = () => {
    handleStop();
    if (activeSectionIndex > 0) {
      setActiveSectionIndex(activeSectionIndex - 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
            title="Back to Note"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              Audio Learning Studio
            </span>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
              {note.title}
            </h1>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => { handleStop(); setActiveTab("standard"); }}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "standard" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Standard Player
          </button>
          <button
            type="button"
            onClick={() => { handleStop(); setActiveTab("focus"); }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "focus" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>Focus / Driving</span>
          </button>
          <button
            type="button"
            onClick={() => { handleStop(); setActiveTab("podcast"); }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === "podcast" ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>AI Podcast</span>
          </button>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 flex items-center space-x-3 text-xs">
        <ShieldAlert className="w-4 h-4 shrink-0 text-zinc-500" />
        <span>
          <strong>Hands-Free Audio:</strong> Designed for clear listening during study, commutes, or workouts.
        </span>
      </div>

      {/* FOCUS / DRIVING MODE */}
      {activeTab === "focus" ? (
        <div className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-2xl p-8 sm:p-12 text-center space-y-8 shadow-sm">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800">
              Focus / Driving Mode
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold line-clamp-2">
              {currentSection?.title || note.title}
            </h2>
            <p className="text-xs opacity-70">
              Section {activeSectionIndex + 1} of {sectionsList.length}
            </p>
          </div>

          {/* Large Play/Pause Control Button */}
          <div className="flex items-center justify-center space-x-6 py-6">
            <button
              type="button"
              onClick={handlePrevSection}
              disabled={activeSectionIndex === 0}
              className="w-16 h-16 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:opacity-80 flex items-center justify-center disabled:opacity-30"
              title="Previous Section"
            >
              <SkipBack className="w-8 h-8" />
            </button>

            <button
              type="button"
              onClick={isPlaying ? handlePause : handlePlay}
              className="w-24 h-24 rounded-full bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
            </button>

            <button
              type="button"
              onClick={handleNextSection}
              disabled={activeSectionIndex === sectionsList.length - 1}
              className="w-16 h-16 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:opacity-80 flex items-center justify-center disabled:opacity-30"
              title="Next Section"
            >
              <SkipForward className="w-8 h-8" />
            </button>
          </div>

          {/* Speed Indicator */}
          <div className="flex items-center justify-center space-x-2 pt-4 border-t border-zinc-800 dark:border-zinc-200">
            <span className="text-xs opacity-70 mr-2">Speed:</span>
            {[0.75, 1, 1.25, 1.5, 2].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlaybackSpeed(s)}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  playbackSpeed === s
                    ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white"
                    : "bg-zinc-800 text-zinc-300 dark:bg-zinc-200 dark:text-zinc-700"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      ) : activeTab === "podcast" ? (
        /* AI PODCAST MODE */
        <PodcastPlayer note={note} />
      ) : (
        /* STANDARD PLAYER */
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-sm">
          {/* Active Section Info */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Section {activeSectionIndex + 1} of {sectionsList.length}
            </span>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {currentSection?.title}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">
              {currentSection?.summary || currentSection?.blocks?.[0]?.content}
            </p>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handlePrevSection}
                disabled={activeSectionIndex === 0}
                className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={isPlaying ? handlePause : handlePlay}
                className="w-12 h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center shadow-sm"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={handleStop}
                className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <Square className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleNextSection}
                disabled={activeSectionIndex === sectionsList.length - 1}
                className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* Speed & Voice Options */}
            <div className="flex items-center space-x-4 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="text-zinc-500 font-medium">Speed:</span>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-zinc-900 dark:text-zinc-100 font-medium"
                >
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
              </div>

              {voices.length > 0 && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-zinc-500 font-medium">Voice:</span>
                  <select
                    value={selectedVoiceIndex}
                    onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
                    className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-zinc-900 dark:text-zinc-100 max-w-[150px] truncate font-medium"
                  >
                    {voices.map((v, i) => (
                      <option key={i} value={i}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
