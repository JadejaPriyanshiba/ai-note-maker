import React, { useState } from "react";
import { motion } from "motion/react";
import { fadeInUp, staggerContainer } from "../../lib/motion";
import {
  getAISettings,
  saveAISettings,
  clearAllLocalWebCache,
  fetchPublicCommunityCloudData,
  migrateLocalDataToCloud,
  syncAllCloudDataToLocal,
} from "../../lib/storage";
import { testApiKey } from "../../lib/aiService";
import { useAuth } from "../../lib/AuthContext";
import { Key, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Trash2, Database, CloudUpload } from "lucide-react";

export const SettingsView: React.FC = () => {
  const { user, syncing, setSyncing } = useAuth();
  const [settings, setSettings] = useState(getAISettings());
  const [mode, setMode] = useState<"default" | "byok">(settings.mode || "default");
  const [apiKeyInput, setApiKeyInput] = useState<string>(settings.userApiKey || "");
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleManualSync = async () => {
    if (!user) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      // Push everything currently on this device (including any Shorts Learning trees/sessions/
      // saved videos created before cloud sync existed, or created while offline) up to the
      // cloud, then pull back down so this device also reflects anything from other devices.
      const upload = await migrateLocalDataToCloud(user.uid);
      const download = await syncAllCloudDataToLocal(user.uid);

      const downloadedTotal = Object.values(download.counts).reduce((sum, n) => sum + n, 0);
      const parts = [`Uploaded ${upload.uploaded}/${upload.total} items from this device.`];
      parts.push(
        downloadedTotal > 0
          ? `Pulled ${downloadedTotal} items from the cloud (${Object.entries(download.counts)
              .filter(([, n]) => n > 0)
              .map(([k, n]) => `${n} ${k}`)
              .join(", ")}).`
          : "No data found in the cloud for this account yet."
      );
      if (upload.failed.length > 0) {
        parts.push(
          `${upload.failed.length} item(s) failed to upload: ` +
            upload.failed
              .slice(0, 3)
              .map((f) => `${f.type} "${f.title}"`)
              .join(", ") +
            (upload.failed.length > 3 ? `, and ${upload.failed.length - 3} more.` : ".")
        );
      }

      setSyncResult({
        success: upload.failed.length === 0 && download.success,
        message: parts.join(" "),
      });
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || "Sync failed. Please check your connection and try again." });
    } finally {
      setSyncing(false);
    }
  };

  const handleTestKey = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const keyToTest = mode === "byok" ? apiKeyInput : undefined;
      const res = await testApiKey(keyToTest);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || "Connection failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const updated = {
      mode,
      userApiKey: apiKeyInput.trim(),
      aiRequestsCount: settings.aiRequestsCount || 0,
    };
    saveAISettings(updated);
    setSettings(updated);
    alert("AI Settings updated successfully!");
  };

  return (
    <motion.div variants={staggerContainer()} initial="hidden" animate="show" className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <motion.div variants={fadeInUp} className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Preferences
        </span>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
          AI Provider & Storage Settings
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Manage your Gemini API key mode, usage statistics, and local application data.
        </p>
      </motion.div>

      {/* Mode Radio Choice */}
      <motion.div variants={fadeInUp} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center space-x-2">
          <Key className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
          <span>AI Service Mode</span>
        </h3>

        <div className="space-y-3">
          <label className={`p-4 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
            mode === "default"
              ? "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-400/20"
              : "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700"
          }`}>
            <input
              type="radio"
              name="aimode"
              checked={mode === "default"}
              onChange={() => setMode("default")}
              className="mt-1 accent-zinc-900 dark:accent-zinc-100 focus:ring-zinc-400"
            />
            <div>
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                App Default Gemini Service
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Uses the pre-configured system Gemini API key. Recommended for most students.
              </p>
            </div>
          </label>

          <label className={`p-4 rounded-xl border flex items-start space-x-3 cursor-pointer transition-all ${
            mode === "byok"
              ? "bg-zinc-100 dark:bg-zinc-800/60 border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-400/20"
              : "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700"
          }`}>
            <input
              type="radio"
              name="aimode"
              checked={mode === "byok"}
              onChange={() => setMode("byok")}
              className="mt-1 accent-zinc-900 dark:accent-zinc-100 focus:ring-zinc-400"
            />
            <div className="flex-1">
              <span className="font-bold text-xs text-zinc-900 dark:text-white block">
                Bring Your Own Key (BYOK) - Gemini API Key
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Use your personal Google AI Studio / Gemini API key.
              </p>
            </div>
          </label>
        </div>

        {/* BYOK Input Field */}
        {mode === "byok" && (
          <div className="pt-2 space-y-3">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Personal Gemini API Key
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
              <button
                type="button"
                onClick={handleTestKey}
                disabled={isTesting || !apiKeyInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200 border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 flex items-center space-x-1"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Test Key</span>
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
              "Using your own API key means AI requests are made using your provider account and subject to their usage limits."
            </p>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-400 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Privacy Guarantee: Your API key is stored ONLY in your browser's local storage and is never saved in central databases.</span>
            </div>
          </div>
        )}

        {/* Test Result Feedback */}
        {testResult && (
          <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
            testResult.success
              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200"
              : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200 border border-red-200"
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{testResult.success ? `Success: ${testResult.message}` : `Error: ${testResult.error}`}</span>
          </div>
        )}

        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs shadow-sm"
          >
            Save Settings
          </button>
        </div>
      </motion.div>

      {/* Usage Stats Card */}
      <motion.div variants={fadeInUp} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-2 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
          <span>AI Request Telemetry</span>
        </h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Total AI Requests Processed: <strong>{settings.aiRequestsCount || 0}</strong>
        </p>
      </motion.div>

      {/* Manual Cloud Sync */}
      <motion.div variants={fadeInUp} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-3 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center space-x-2">
          <CloudUpload className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
          <span>Cloud Sync</span>
        </h3>
        {user ? (
          <>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 text-xs">
              <p className="text-zinc-700 dark:text-zinc-300">
                Signed in as <strong>{user.email || (user.isAnonymous ? "Guest (no email)" : user.displayName)}</strong>
              </p>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5" title="Compare this exact ID on your other device">
                Account ID: {user.uid}
              </p>
            </div>

            {user.isAnonymous && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <strong>You're signed in as a Guest.</strong> Guest sessions are tied to this device/browser only —
                each device gets a completely different Account ID, so nothing will ever sync between them no matter
                how many times you press sync. Sign out and sign back in with Google or Email on every device you
                want to share data with — the Account ID above must match exactly across devices.
              </div>
            )}

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Data normally syncs automatically as you use the app. If something was created on this device before
              cloud sync was available (or while offline) and isn't showing up on your other devices, use this to
              push everything on this device to the cloud right now.
            </p>
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-semibold text-xs flex items-center space-x-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
              <span>{syncing ? "Syncing..." : "Sync This Device to Cloud"}</span>
            </button>
            {syncResult && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start space-x-2 ${
                  syncResult.success
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-200"
                    : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200 border border-red-200"
                }`}
              >
                {syncResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{syncResult.message}</span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Sign in with a cloud account to back up and sync your notes, flashcards, tests, and Shorts Learning
            content across devices.
          </p>
        )}
      </motion.div>

      {/* Local Web Data & Cache Storage */}
      <motion.div variants={fadeInUp} className="bg-white dark:bg-zinc-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-6 space-y-3 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center space-x-2 text-red-600 dark:text-red-400">
          <Database className="w-4 h-4" />
          <span>Clear Web Storage & Local Cache</span>
        </h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Clears local browser cache including sample community items and local offline copies. Clean cloud data from Firebase will be fetched afresh upon sync.
        </p>
        <button
          onClick={async () => {
            if (window.confirm("Are you sure you want to clear all local web app data and cache?")) {
              clearAllLocalWebCache();
              await fetchPublicCommunityCloudData();
              alert("Local web data and cache have been cleared! The web app will now reload.");
              window.location.reload();
            }
          }}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center space-x-2 shadow-sm transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Local Web Cache & Data</span>
        </button>
      </motion.div>
    </motion.div>
  );
};
