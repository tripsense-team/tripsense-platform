"use client";

import * as React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type ModalBackdropProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
  backdropClassName?: string;
};

export function ModalBackdrop({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-lg",
  backdropClassName,
}: ModalBackdropProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className={cn(
              "fixed inset-0 bg-black/10 backdrop-blur-[2px] dark:bg-black/40",
              backdropClassName
            )}
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative z-10 w-full overflow-hidden rounded-3xl bg-background border border-border/60 p-6 md:p-8 shadow-2xl",
              maxWidth
            )}
          >
            {/* Close Button top-left matching Mindtrip screenshot */}
            <button
              type="button"
              onClick={onClose}
              className="absolute left-6 top-6 p-1.5 rounded-full text-foreground/80 hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>

            {/* Header: Centered Title & Subtitle */}
            <div className="text-center mb-6 pt-1">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs md:text-sm text-muted-foreground mt-1 font-normal">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Content */}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
