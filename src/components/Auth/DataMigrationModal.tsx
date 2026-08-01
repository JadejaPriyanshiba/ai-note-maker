import React, { useState, useEffect } from "react";
import { CloudUpload, HardDrive, ShieldCheck, Check, AlertCircle } from "lucide-react";
import { useAuth } from "../../lib/AuthContext";
import { migrateLocalDataToCloud } from "../../lib/storage";

interface DataMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DataMigrationModal: React.FC<DataMigrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [migrating, setMigrating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleUploadToAccount = async () => {
    setMigrating(true);
    setStatusMsg("Creating local safety backup...");
    setErrorMsg(null);

    try {
      setStatusMsg("Migrating notes, collections, flashcards, and tests to Cloud Database...");
      const result = await migrateLocalDataToCloud(user.uid);

      if (result.total === 0) {
        setStatusMsg("Nothing to migrate — this device has no local data yet.");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else if (result.failed.length === 0) {
        setStatusMsg(`All ${result.uploaded} item${result.uploaded === 1 ? "" : "s"} synced successfully to Cloud.`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMsg(
          `Synced ${result.uploaded} of ${result.total} items. ${result.failed.length} failed: ` +
            result.failed
              .slice(0, 3)
              .map((f) => `${f.type} "${f.title}"`)
              .join(", ") +
            (result.failed.length > 3 ? `, and ${result.failed.length - 3} more.` : ".")
        );
        onSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "An error occurred during cloud migration. Local data is preserved.");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 space-y-5 text-left my-auto max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-3 text-amber-500">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/50">
            <CloudUpload className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              Local Data Detected
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              We found study resources created on this device.
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
          Would you like to sync and upload your local study notes, folders, flashcard decks, and practice tests to your Cloud Account (<strong>{user.email}</strong>)?
        </p>

        {statusMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/50 flex items-start space-x-2 text-xs text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 flex items-start space-x-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <button
            onClick={handleUploadToAccount}
            disabled={migrating}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <CloudUpload className="w-4 h-4" />
            <span>{migrating ? "Migrating Data..." : "Upload to My Cloud Account"}</span>
          </button>

          <button
            onClick={() => {
              onClose();
            }}
            disabled={migrating}
            className="w-full py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-all flex items-center justify-center space-x-2"
          >
            <HardDrive className="w-4 h-4" />
            <span>Keep Local Cache Only</span>
          </button>
        </div>
      </div>
    </div>
  );
};
