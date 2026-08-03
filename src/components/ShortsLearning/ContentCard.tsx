import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bookmark,
  BookmarkCheck,
  SkipForward,
  StickyNote,
  Clock,
  User,
  Tag,
  Plus,
  X,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Share2,
  Check,
} from "lucide-react";
import { LearningContent, LearningNode } from "../../types";
import { loadYouTubeIframeAPI } from "../../lib/youtubePlayerLoader";

interface ContentCardProps {
  content: LearningContent;
  node: LearningNode;
  breadcrumb: string;
  isSaved: boolean;
  isActive: boolean; // whether this is the currently focused card (mounts the live player)
  muted: boolean;
  onToggleMute: () => void;
  notesValue: string;
  timestampNotes: { time: string; note: string }[];
  onSave: () => void;
  onNotesChange: (value: string) => void;
  onAddTimestampNote: (time: string, note: string) => void;
  onSkipNode: () => void;
}

const RailButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  icon: React.ReactNode;
  label: string;
}> = ({ onClick, active, icon, label }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 text-white drop-shadow">
    <span
      className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
        active ? "bg-white text-zinc-900" : "bg-black/35 hover:bg-black/50 text-white"
      }`}
    >
      {icon}
    </span>
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);

export const ContentCard: React.FC<ContentCardProps> = ({
  content,
  node,
  breadcrumb,
  isSaved,
  isActive,
  muted,
  onToggleMute,
  notesValue,
  timestampNotes,
  onSave,
  onNotesChange,
  onAddTimestampNote,
  onSkipNode,
}) => {
  const [showNotes, setShowNotes] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const [justShared, setJustShared] = useState(false);
  const [tsTime, setTsTime] = useState("");
  const [tsNote, setTsNote] = useState("");

  // This wrapper is ALWAYS rendered by React (never conditionally swapped out), so React's
  // reconciler never tries to diff it. The YouTube IFrame API replaces whatever element you
  // give it with its own <iframe>, entirely outside React's tracking — if you hand it a node
  // that React itself later tries to unmount/replace (e.g. a div that toggles with isActive),
  // React's removeChild crashes because the node it expects is already gone. Instead we hand
  // the API a plain child div we create/destroy ourselves via direct DOM calls, and only ever
  // touch this wrapper's innerHTML manually — React never looks inside it.
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    loadYouTubeIframeAPI().then((YT) => {
      if (cancelled || !playerWrapperRef.current) return;
      const playerDiv = document.createElement("div");
      // The YT API sizes its generated <iframe> from these width/height options (defaulting to
      // a small fixed pixel box otherwise) — both the mount point and the option need to be 100%
      // for the player to actually fill the full-screen card.
      playerDiv.style.width = "100%";
      playerDiv.style.height = "100%";
      playerWrapperRef.current.appendChild(playerDiv);

      const player = new YT.Player(playerDiv, {
        width: "100%",
        height: "100%",
        videoId: content.providerContentId,
        playerVars: {
          autoplay: 1,
          mute: muted ? 1 : 0,
          controls: 1, // keep YouTube's native controls (speed/quality/captions/share/fullscreen)
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: (e: any) => {
            if (muted) e.target.mute();
            else e.target.unMute();
            e.target.playVideo();
          },
        },
      });
      playerRef.current = player;
    });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // player may already be torn down by the API itself
      }
      playerRef.current = null;
      if (playerWrapperRef.current) {
        playerWrapperRef.current.innerHTML = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, content.providerContentId]);

  // Keep the live player's mute state in sync with the persisted preference (e.g. user
  // taps unmute once and every subsequent video in the feed respects it).
  useEffect(() => {
    if (!isActive || !playerRef.current) return;
    if (muted) playerRef.current.mute?.();
    else playerRef.current.unMute?.();
  }, [muted, isActive]);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: content.title, url: content.url });
      } catch {
        // user cancelled the native share sheet — not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(content.url);
      setJustShared(true);
      setTimeout(() => setJustShared(false), 2000);
    } catch {
      // clipboard unavailable; nothing more we can do without a server round-trip
    }
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Video: the wrapper is always mounted (see effect above for why); the thumbnail
          sits on top of it until this card becomes active. */}
      <div ref={playerWrapperRef} className="absolute inset-0 w-full h-full" />
      {!isActive && <img src={content.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}

      {/* Dedicated, always-reachable toggle for our overlay (title/save/note/skip). Tapping
          the video itself is left entirely to YouTube's own native controls (speed, quality,
          captions, share, fullscreen) — we never intercept that gesture. */}
      <button
        type="button"
        aria-label={showChrome ? "Hide video details" : "Show video details"}
        onClick={() => setShowChrome((v) => !v)}
        className="absolute top-16 right-3 z-20 p-2 rounded-full bg-black/35 hover:bg-black/50 text-white backdrop-blur-sm"
      >
        {showChrome ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>

      {/* Gradient overlays for legibility */}
      <div
        className={`absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent pointer-events-none transition-opacity duration-300 ${
          showChrome ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none transition-opacity duration-300 ${
          showChrome ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Bottom-left info */}
      <div
        className={`absolute left-4 right-20 bottom-8 z-10 text-white space-y-1.5 pointer-events-none transition-opacity duration-300 ${
          showChrome ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="inline-flex items-center gap-1 text-[11px] bg-black/35 backdrop-blur px-2 py-0.5 rounded-full">
          <Tag className="w-3 h-3" />
          <span className="truncate">{breadcrumb}</span>
        </span>
        <h3 className="text-sm font-semibold line-clamp-2 drop-shadow-sm">{content.title}</h3>
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/85">
          <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{content.channelName}</span>
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{content.duration}</span>
          <span className="px-1.5 py-0.5 rounded bg-white/15">YouTube</span>
        </div>
        <p className="text-[10px] text-white/60">Matched: "{content.matchedKeyword}"</p>
      </div>

      {/* Right action rail */}
      <div
        className={`absolute right-3 bottom-8 z-10 flex flex-col items-center gap-4 transition-opacity duration-300 ${
          showChrome ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <RailButton
          onClick={onToggleMute}
          active={!muted}
          icon={muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          label={muted ? "Muted" : "Sound"}
        />
        <RailButton
          onClick={onSave}
          active={isSaved}
          icon={isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          label={isSaved ? "Saved" : "Save"}
        />
        <RailButton onClick={() => setShowNotes(true)} icon={<StickyNote className="w-5 h-5" />} label="Note" />
        <RailButton
          onClick={handleShare}
          active={justShared}
          icon={justShared ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
          label={justShared ? "Copied" : "Share"}
        />
        <RailButton onClick={onSkipNode} icon={<SkipForward className="w-5 h-5" />} label="Skip" />
      </div>

      {/* Notes bottom sheet */}
      <AnimatePresence>
        {showNotes && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 flex items-end bg-black/40"
            onClick={() => setShowNotes(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full bg-white dark:bg-zinc-900 rounded-t-3xl p-4 space-y-3 max-h-[75%] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">My Notes</h4>
                <button onClick={() => setShowNotes(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={notesValue}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder="My notes... e.g. Centroid = center of a cluster"
                rows={3}
                autoFocus
                className="w-full text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 resize-none"
              />
              <p className="text-[10px] text-zinc-400">Saving a note also saves this video under "{node.title}".</p>

              {timestampNotes.length > 0 && (
                <div className="space-y-1">
                  {timestampNotes.map((t, i) => (
                    <div key={i} className="text-[11px] text-zinc-600 dark:text-zinc-400 flex gap-2">
                      <span className="font-mono font-semibold text-zinc-500">{t.time}</span>
                      <span>→ {t.note}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={tsTime}
                  onChange={(e) => setTsTime(e.target.value)}
                  placeholder="mm:ss"
                  className="w-16 text-[11px] px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                />
                <input
                  type="text"
                  value={tsNote}
                  onChange={(e) => setTsNote(e.target.value)}
                  placeholder="Timestamp note (optional)"
                  className="flex-1 text-[11px] px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10"
                />
                <button
                  onClick={() => {
                    if (!tsTime.trim() || !tsNote.trim()) return;
                    onAddTimestampNote(tsTime.trim(), tsNote.trim());
                    setTsTime("");
                    setTsNote("");
                  }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => setShowNotes(false)}
                className="w-full py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
