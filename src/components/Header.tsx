import React, { useState } from "react";
import { motion } from "motion/react";
import {
  BookOpen,
  Sparkles,
  FolderKanban,
  Globe,
  Settings,
  Key,
  Moon,
  Sun,
  GraduationCap,
  FolderTree,
  Layers,
  Film,
  User as UserIcon,
  LogOut,
  CloudCheck,
  CloudUpload,
} from "lucide-react";
import { getAISettings } from "../lib/storage";
import { useAuth } from "../lib/AuthContext";

interface HeaderProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onOpenAuthModal: () => void;
}

const NAV_TABS: {
  id: string;
  tab: string;
  label: string;
  icon: React.ElementType;
  isActive: (activeTab: string) => boolean;
}[] = [
  { id: "nav-tab-home", tab: "home", label: "Create", icon: Sparkles, isActive: (t) => t === "home" },
  { id: "nav-tab-collections", tab: "collections", label: "Collections", icon: FolderTree, isActive: (t) => t === "collections" },
  {
    id: "nav-tab-notes",
    tab: "my_notes",
    label: "Notes",
    icon: FolderKanban,
    isActive: (t) => t === "notes_list" || t === "my_notes",
  },
  {
    id: "nav-tab-flashcards",
    tab: "flashcards",
    label: "Flashcards",
    icon: Layers,
    isActive: (t) => t === "flashcards" || t === "flashcard_editor" || t === "flashcard_study",
  },
  {
    id: "nav-tab-shorts",
    tab: "shorts_learning",
    label: "Shorts Learning",
    icon: Film,
    isActive: (t) => t === "shorts_setup" || t === "shorts_map" || t === "shorts_feed",
  },
  { id: "nav-tab-community", tab: "community", label: "Community", icon: Globe, isActive: (t) => t === "community" },
  { id: "nav-tab-teachback", tab: "teach_back", label: "Teach Back", icon: GraduationCap, isActive: (t) => t === "teach_back" },
  { id: "nav-tab-settings", tab: "settings", label: "Settings", icon: Settings, isActive: (t) => t === "settings" },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  onOpenAuthModal,
}) => {
  const { user, logout, syncing } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const aiSettings = getAISettings();
  const isBYOK = aiSettings.mode === "byok" && Boolean(aiSettings.userApiKey);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={() => onSelectTab("home")}
          id="brand-logo"
        >
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-base text-zinc-900 dark:text-zinc-100 tracking-tight">
                AI Note Maker
              </span>
              <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                AI Studio
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-light hidden sm:block">
              Smart AI Study Assistant
            </p>
          </div>
        </div>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {NAV_TABS.map(({ id, tab, label, icon: Icon, isActive }) => {
            const active = isActive(activeTab);
            return (
              <button
                key={id}
                id={id}
                onClick={() => onSelectTab(tab)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 ${
                  active
                    ? "text-white dark:text-zinc-900 font-bold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active-tab"
                    className="absolute inset-0 rounded-lg bg-zinc-900 dark:bg-zinc-100"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Utility Badge & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* AI Key Mode Badge */}
          <button
            id="btn-key-badge"
            onClick={() => onSelectTab("settings")}
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-light border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 transition-colors"
            title="Configure AI API Key settings"
          >
            <Key className="w-3.5 h-3.5 text-zinc-500" />
            <span>{isBYOK ? "Custom Key" : "Gemini Default"}</span>
          </button>

          {/* Cloud User Profile or Sign In Button */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="User"
                    className="w-6 h-6 rounded-lg object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                    {(user.displayName || user.email || "S")[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 max-w-[100px] truncate hidden lg:inline-block">
                  {user.displayName || user.email?.split("@")[0]}
                </span>
                {syncing ? (
                  <CloudUpload className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                ) : (
                  <CloudCheck className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl p-3 z-50 space-y-2">
                  <div className="px-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {user.displayName || "Scholar Account"}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {user.email || "No email — guest session"}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate font-mono mt-0.5" title="Compare this ID across devices to confirm they're really the same account">
                      ID: {user.uid}
                    </p>
                    {user.isAnonymous ? (
                      <div className="mt-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                        Guest sessions are unique to this device/browser — they never sync across
                        devices, even if you sign in as a guest on both. Sign in with Google or
                        Email instead to sync everywhere.
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center space-x-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <CloudCheck className="w-3 h-3" />
                        <span>Firebase Cloud Active</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      logout();
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center space-x-2 font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-semibold transition-all shadow-xs"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Cloud Sign In</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            id="btn-theme-toggle"
            onClick={onToggleTheme}
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Toggle Theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-zinc-200" />
            ) : (
              <Moon className="w-4 h-4 text-zinc-700" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 overflow-x-auto">
        <button
          onClick={() => onSelectTab("home")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            activeTab === "home"
              ? "text-zinc-900 dark:text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <Sparkles className="w-4 h-4 mb-0.5" />
          <span>Create</span>
        </button>
        <button
          onClick={() => onSelectTab("collections")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            activeTab === "collections"
              ? "text-zinc-900 dark:text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <FolderTree className="w-4 h-4 mb-0.5" />
          <span>Collections</span>
        </button>
        <button
          onClick={() => onSelectTab("my_notes")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            activeTab === "notes_list" || activeTab === "my_notes"
              ? "text-zinc-900 dark:text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <FolderKanban className="w-4 h-4 mb-0.5" />
          <span>Notes</span>
        </button>
        <button
          onClick={() => onSelectTab("flashcards")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            activeTab === "flashcards"
              ? "text-zinc-900 dark:text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span>Cards</span>
        </button>
        <button
          onClick={() => onSelectTab("community")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            activeTab === "community"
              ? "text-zinc-900 dark:text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <Globe className="w-4 h-4 mb-0.5" />
          <span>Library</span>
        </button>
        <button
          onClick={() => onSelectTab("shorts_learning")}
          className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium ${
            activeTab === "shorts_setup" || activeTab === "shorts_map" || activeTab === "shorts_feed"
              ? "text-zinc-900 dark:text-white font-semibold"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <Film className="w-4 h-4 mb-0.5" />
          <span>Shorts</span>
        </button>
      </div>
    </header>
  );
};
