import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { backdropFade, scaleIn } from "../lib/motion";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra classes for the panel — max-width, padding, spacing, flex layout, etc. */
  panelClassName?: string;
  closeOnBackdropClick?: boolean;
}

// Shared modal shell: consistent backdrop/blur/radius, a real (not-a-no-op) fade+scale
// transition, Escape-to-close, and body-scroll-lock — owned once instead of reimplemented
// per modal. Safe to render unconditionally; nothing shows until isOpen is true.
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  panelClassName = "max-w-md",
  closeOnBackdropClick = true,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
          variants={backdropFade}
          initial="hidden"
          animate="show"
          exit="exit"
          onClick={closeOnBackdropClick ? onClose : undefined}
        >
          <motion.div
            className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-3xl w-full my-auto max-h-[85vh] overflow-y-auto ${panelClassName}`}
            variants={scaleIn}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
