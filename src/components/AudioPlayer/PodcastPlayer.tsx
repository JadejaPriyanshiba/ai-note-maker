import React, { useEffect, useMemo, useRef, useState } from "react";
import { NoteDocument, PodcastEpisode } from "../../types";
import { generatePodcastScript } from "../../lib/aiService";
import { getPodcastForNote, savePodcastEpisode, deletePodcastEpisode } from "../../lib/storage";
import { ConfirmModal } from "../ConfirmModal";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Radio,
  Sparkles,
  Loader2,
  Trash2,
  Captions,
  Mic2,
} from "lucide-react";

interface PodcastPlayerProps {
  note: NoteDocument;
}

const SEEK_SECONDS = 10;
const WORDS_PER_MINUTE = 155; // rough spoken-word rate at 1x, used only to estimate durations for the scrubber/seek math — the Web Speech API doesn't expose real audio timing.
const SPEAKER_ACCENTS = [
  { badge: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60", avatar: "bg-emerald-600" },
  { badge: "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60", avatar: "bg-amber-600" },
  { badge: "bg-sky-100 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-900/60", avatar: "bg-sky-600" },
  { badge: "bg-violet-100 dark:bg-violet-950/50 text-violet-800 dark:text-violet-300 border-violet-200 dark:border-violet-900/60", avatar: "bg-violet-600" },
];

function estimateSeconds(text: string, speed: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerSecond = (WORDS_PER_MINUTE / 60) * speed;
  return wordsPerSecond > 0 ? Math.max(0.4, words / wordsPerSecond) : 0.4;
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

// A queue-based, multi-voice podcast player built on the browser's Web Speech API — there's no
// server-side TTS/audio pipeline in this app, so "audio" here is synthesized turn-by-turn client
// side rather than a real seekable media file. To still deliver play/pause, 10s skip, and
// captions, we speak one utterance per dialogue turn (never narrating the speaker name out loud),
// assign each speaker a distinct voice/pitch, and estimate a virtual timeline from word counts to
// drive the scrubber and seek math — restarting the current utterance from a computed text offset
// is how "seeking" is approximated, since SpeechSynthesis itself has no seek API.
export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({ note }) => {
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [turnIndex, setTurnIndex] = useState(0);
  const [elapsedWithinTurn, setElapsedWithinTurn] = useState(0);
  const [captionCharIndex, setCaptionCharIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  // User-picked voice per speaker, keyed by speaker label (e.g. "Alex (Host)") — deliberately not
  // reset when switching notes, since the same two speaker roles recur across episodes and a
  // voice pick is really "which voice do I want for the Host", not a per-note setting.
  const [voiceOverrides, setVoiceOverrides] = useState<Record<string, number>>({});

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const transcriptRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Loaded fresh whenever the note changes — this is the "saved in the cloud" episode, not
  // in-memory-only state, so navigating away and coming back (or opening on another device)
  // shows the same podcast instead of an empty generator.
  useEffect(() => {
    setEpisode(getPodcastForNote(note.id));
    resetPlaybackState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    synthRef.current = window.speechSynthesis;
    const updateVoices = () => setVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      synthRef.current?.cancel();
    };
  }, []);

  const resetPlaybackState = () => {
    synthRef.current?.cancel();
    setIsPlaying(false);
    setTurnIndex(0);
    setElapsedWithinTurn(0);
    setCaptionCharIndex(0);
    setIsFinished(false);
  };

  const dialogue = episode?.dialogue || [];
  const currentTurn = dialogue[turnIndex];
  const uniqueSpeakers = useMemo(() => Array.from(new Set(dialogue.map((d) => d.speaker))), [dialogue]);

  // Spread the default voice pick evenly across the available system voices (rather than adjacent
  // indices) so two speakers land on more distinct-sounding voices by default; pitch offset is the
  // fallback differentiator when the browser only exposes one or two voices. A user override for a
  // speaker (see the Voices picker below) always wins over this default.
  const speakerVoice = useMemo(() => {
    const map: Record<string, { voiceIndex: number; pitch: number }> = {};
    uniqueSpeakers.forEach((speaker, i) => {
      const defaultIndex = voices.length > 0 ? Math.floor((i * voices.length) / Math.max(1, uniqueSpeakers.length)) : -1;
      const voiceIndex = voiceOverrides[speaker] !== undefined ? voiceOverrides[speaker] : defaultIndex;
      const pitch = uniqueSpeakers.length > 1 && voices.length < uniqueSpeakers.length ? (i % 2 === 0 ? 1 : 1.35) : 1;
      map[speaker] = { voiceIndex, pitch };
    });
    return map;
  }, [uniqueSpeakers, voices, voiceOverrides]);

  const speakerAccent = (speaker: string) => SPEAKER_ACCENTS[uniqueSpeakers.indexOf(speaker) % SPEAKER_ACCENTS.length];

  const turnDurations = useMemo(() => dialogue.map((d) => estimateSeconds(d.text, speed)), [dialogue, speed]);
  const totalDuration = useMemo(() => turnDurations.reduce((a, b) => a + b, 0), [turnDurations]);
  const elapsedBeforeTurn = useMemo(
    () => turnDurations.slice(0, turnIndex).reduce((a, b) => a + b, 0),
    [turnDurations, turnIndex]
  );
  const currentTurnDuration = turnDurations[turnIndex] || 0.4;
  const elapsedTotal = Math.min(totalDuration, elapsedBeforeTurn + elapsedWithinTurn);
  const progressPercent = totalDuration > 0 ? Math.min(100, (elapsedTotal / totalDuration) * 100) : 0;

  // Ticks the "now playing" clock forward while speaking — used for the scrubber and to know
  // where within the current turn to resume from after a pause. Not tied to onboundary since
  // word-boundary events are unreliable across browsers/engines; a wall clock is good enough for
  // an estimate-based timeline.
  useEffect(() => {
    if (!isPlaying) return;
    const iv = window.setInterval(() => {
      setElapsedWithinTurn((prev) => Math.min(currentTurnDuration, prev + 0.25));
    }, 250);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, turnIndex]);

  // Always call the latest version (fresh speed/voices/episode) even from inside an
  // utterance's onend handler, which closes over whatever this function looked like when
  // the utterance was created.
  const speakFromRef = useRef<(index: number, charOffset: number) => void>(() => {});

  const speakFrom = (index: number, charOffset: number) => {
    if (!synthRef.current || !episode) return;
    synthRef.current.cancel();
    const turn = episode.dialogue[index];
    if (!turn) {
      setIsPlaying(false);
      return;
    }

    const snappedOffset = Math.min(charOffset, Math.max(0, turn.text.length - 1));
    const textToSpeak = turn.text.slice(snappedOffset) || turn.text;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speed;
    const voiceInfo = speakerVoice[turn.speaker];
    if (voiceInfo?.voiceIndex !== undefined && voices[voiceInfo.voiceIndex]) {
      utterance.voice = voices[voiceInfo.voiceIndex];
    }
    if (voiceInfo) utterance.pitch = voiceInfo.pitch;

    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (typeof e.charIndex === "number") setCaptionCharIndex(snappedOffset + e.charIndex);
    };
    utterance.onend = () => {
      const nextIndex = index + 1;
      if (episode.dialogue[nextIndex]) {
        setTurnIndex(nextIndex);
        setElapsedWithinTurn(0);
        setCaptionCharIndex(0);
        speakFromRef.current(nextIndex, 0);
      } else {
        setIsPlaying(false);
        setIsFinished(true);
        setElapsedWithinTurn(turnDurations[index] || 0);
      }
    };
    utterance.onerror = () => setIsPlaying(false);

    setTurnIndex(index);
    setCaptionCharIndex(snappedOffset);
    setIsFinished(false);
    synthRef.current.speak(utterance);
    setIsPlaying(true);
  };
  speakFromRef.current = speakFrom;

  const handlePlayPause = () => {
    if (!synthRef.current || !episode || dialogue.length === 0) return;
    if (isFinished) {
      speakFrom(0, 0);
      return;
    }
    if (isPlaying) {
      synthRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (synthRef.current.paused && synthRef.current.speaking) {
      synthRef.current.resume();
      setIsPlaying(true);
      return;
    }
    // Fresh start — reconstruct the text offset for the current turn from the
    // elapsed-within-turn estimate.
    const turn = episode.dialogue[turnIndex];
    if (!turn) return;
    const fraction = currentTurnDuration > 0 ? elapsedWithinTurn / currentTurnDuration : 0;
    const charOffset = snapToWordBoundary(turn.text, Math.floor(fraction * turn.text.length));
    speakFrom(turnIndex, charOffset);
  };

  // Changing a speaker's voice takes effect immediately: if that speaker is the one currently
  // speaking, restart the current utterance (from the same estimated position) with the new
  // voice so the user hears the change right away instead of only on the next turn. The
  // setTimeout lets the voiceOverrides state update flow through the speakerVoice memo and into
  // a fresh speakFromRef.current before we call it.
  const handleVoiceChange = (speaker: string, voiceIndex: number) => {
    setVoiceOverrides((prev) => ({ ...prev, [speaker]: voiceIndex }));
    if (currentTurn?.speaker === speaker && (isPlaying || synthRef.current?.speaking)) {
      setTimeout(() => speakFromRef.current(turnIndex, captionCharIndex), 0);
    }
  };

  const snapToWordBoundary = (text: string, index: number): number => {
    let i = Math.max(0, Math.min(index, text.length - 1));
    while (i > 0 && text[i] !== " ") i--;
    return i === 0 ? 0 : i + 1;
  };

  const seekBy = (deltaSeconds: number) => {
    if (!episode || dialogue.length === 0 || totalDuration === 0) return;
    const wasPlaying = isPlaying || Boolean(synthRef.current?.speaking);
    const target = Math.max(0, Math.min(totalDuration - 0.1, elapsedTotal + deltaSeconds));

    let acc = 0;
    let targetIndex = turnDurations.length - 1;
    let offsetSeconds = 0;
    for (let i = 0; i < turnDurations.length; i++) {
      if (target < acc + turnDurations[i]) {
        targetIndex = i;
        offsetSeconds = target - acc;
        break;
      }
      acc += turnDurations[i];
      offsetSeconds = 0;
    }

    const turnText = episode.dialogue[targetIndex].text;
    const fraction = turnDurations[targetIndex] > 0 ? offsetSeconds / turnDurations[targetIndex] : 0;
    const charOffset = snapToWordBoundary(turnText, Math.floor(fraction * turnText.length));

    setTurnIndex(targetIndex);
    setElapsedWithinTurn(offsetSeconds);
    setCaptionCharIndex(charOffset);
    setIsFinished(false);

    if (wasPlaying) {
      speakFrom(targetIndex, charOffset);
    } else {
      synthRef.current?.cancel();
      setIsPlaying(false);
    }
  };

  // Auto-scroll the transcript so the active line stays in view, like captions on a real player.
  useEffect(() => {
    transcriptRefs.current[turnIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turnIndex]);

  const buildFullNoteText = (): string => {
    return (note.sections || [])
      .map((sec) => {
        let text = `${sec.title}. `;
        if (sec.summary) text += `${sec.summary}. `;
        (sec.blocks || []).forEach((b) => {
          if (b.content) text += `${b.content} `;
          if (b.items?.length) text += `${b.items.join(". ")}. `;
        });
        return text;
      })
      .join("\n\n");
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const textContent = buildFullNoteText() || note.title;
      const dialogueResult = await generatePodcastScript(note.title, note.subject, textContent);
      const saved = savePodcastEpisode({
        id: episode?.id || `pod_${Date.now()}`,
        noteId: note.id,
        noteTitle: note.title,
        dialogue: dialogueResult,
        createdAt: episode?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setEpisode(saved);
      resetPlaybackState();
    } catch (err: any) {
      alert("Failed to generate podcast script: " + (err.message || "Please try again."));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = () => {
    if (!episode) return;
    deletePodcastEpisode(episode.id);
    setEpisode(null);
    resetPlaybackState();
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <Radio className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            <span>AI Conversational Podcast</span>
          </h2>
          <p className="text-xs text-zinc-500">
            {episode
              ? "Saved to your account — pick up right where you left off, on any device."
              : "Turns this whole note into an engaging two-voice dialogue you can save and replay."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {episode && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="p-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-900 transition-colors"
              title="Delete saved episode"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold flex items-center space-x-2 shadow-sm disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{episode ? "Regenerate Episode" : "Generate Podcast"}</span>
          </button>
        </div>
      </div>

      {!episode ? (
        <div className="py-12 text-center text-zinc-500 text-xs space-y-2">
          <Radio className="w-10 h-10 text-zinc-400 mx-auto opacity-40" />
          <p>Click "Generate Podcast" to turn this note into a saved audio discussion!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Voice Picker — lets the user assign a specific system voice to each speaker instead
              of only the auto-picked default. */}
          {voices.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
              <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                <Mic2 className="w-3.5 h-3.5" />
                <span>Voices:</span>
              </span>
              {uniqueSpeakers.map((speaker) => {
                const accent = speakerAccent(speaker);
                const selectedIndex = speakerVoice[speaker]?.voiceIndex ?? -1;
                return (
                  <label key={speaker} className="flex items-center gap-1.5 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${accent.badge}`}>{speaker}</span>
                    <select
                      value={selectedIndex}
                      onChange={(e) => handleVoiceChange(speaker, Number(e.target.value))}
                      className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-zinc-900 dark:text-zinc-100 max-w-[160px] truncate font-medium"
                    >
                      {voices.map((v, i) => (
                        <option key={i} value={i}>
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          )}

          {/* Now Playing / Caption Card */}
          <div className="rounded-2xl bg-zinc-900 dark:bg-zinc-950 text-white p-5 sm:p-6 space-y-4 border border-zinc-800">
            {currentTurn && !isFinished && (
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${speakerAccent(currentTurn.speaker).avatar}`}>
                  {currentTurn.speaker.charAt(0)}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">{currentTurn.speaker}</span>
                <Captions className="w-3.5 h-3.5 text-zinc-500 ml-auto" />
              </div>
            )}

            <p className="text-sm sm:text-base leading-relaxed min-h-[3.5em]">
              {isFinished || !currentTurn ? (
                "Episode finished — press play to listen again."
              ) : (
                <>
                  <span className="text-white">{currentTurn.text.slice(0, captionCharIndex)}</span>
                  <span className="text-zinc-400">{currentTurn.text.slice(captionCharIndex)}</span>
                </>
              )}
            </p>

            {/* Scrubber */}
            <div className="space-y-1.5">
              <div
                className="w-full bg-zinc-700 h-1.5 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const fraction = (e.clientX - rect.left) / rect.width;
                  seekBy(fraction * totalDuration - elapsedTotal);
                }}
              >
                <div className="h-full bg-emerald-500 rounded-full transition-[width] duration-200" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
                <span>{formatTime(elapsedTotal)}</span>
                <span>{formatTime(totalDuration)}</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="flex items-center justify-center gap-4 pt-1">
              <button
                type="button"
                onClick={() => seekBy(-SEEK_SECONDS)}
                className="w-11 h-11 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center relative"
                title="Back 10 seconds"
              >
                <RotateCcw className="w-5 h-5" />
                <span className="absolute text-[8px] font-bold mt-6">10s</span>
              </button>

              <button
                type="button"
                onClick={handlePlayPause}
                className="w-16 h-16 rounded-full bg-white text-zinc-900 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => seekBy(SEEK_SECONDS)}
                className="w-11 h-11 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center relative"
                title="Forward 10 seconds"
              >
                <RotateCw className="w-5 h-5" />
                <span className="absolute text-[8px] font-bold mt-6">10s</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-2">
              {[0.75, 1, 1.25, 1.5, 2].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    speed === s ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Full Transcript / Captions List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Captions className="w-3.5 h-3.5" />
              <span>Full Transcript</span>
            </p>
            {dialogue.map((d, idx) => {
              const accent = speakerAccent(d.speaker);
              const isActive = idx === turnIndex;
              return (
                <div
                  key={idx}
                  ref={(el) => { transcriptRefs.current[idx] = el; }}
                  onClick={() => {
                    setTurnIndex(idx);
                    setElapsedWithinTurn(0);
                    setCaptionCharIndex(0);
                    setIsFinished(false);
                    if (isPlaying || synthRef.current?.speaking) {
                      speakFrom(idx, 0);
                    }
                  }}
                  className={`p-3.5 rounded-xl border space-y-1 cursor-pointer transition-colors ${
                    isActive
                      ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/80"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${accent.badge}`}>
                    {d.speaker}
                  </span>
                  <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">{d.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        title="Delete Saved Episode?"
        message="This removes the generated podcast script from your account. You can always regenerate a new one from this note."
        confirmText="Delete Episode"
        onConfirm={handleDelete}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
};
