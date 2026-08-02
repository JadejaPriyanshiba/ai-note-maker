import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

// One canonical empty-state treatment, flexible enough to cover everything from a bare
// one-line message to icon + title + message + CTA — replacing the 4-5 divergent inline
// variants that had accumulated across the app's list/grid views.
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, message, action, className = "" }) => {
  return (
    <div
      className={`p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 space-y-2 ${className}`}
    >
      {Icon && <Icon className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700" />}
      {title && <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</p>}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
