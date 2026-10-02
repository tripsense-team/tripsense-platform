"use client";

import { useArtifact } from "@/hooks/use-artifact";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItineraryArtifactContent } from "./itinerary-artifact";
import { useWindowSize } from "usehooks-ts";

export function ChatArtifact() {
  const { artifact, closeArtifact, isVisible } = useArtifact();
  const { width = 1024 } = useWindowSize();
  const isMobile = width < 768;

  if (!isVisible || !artifact.proposal?.proposalId) {
    return null;
  }

  const header = (
    <div className="flex h-12 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Map className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-foreground truncate">
            {artifact.proposal.title || "Kế hoạch Lịch trình"}
          </h3>
          <p className="text-micro text-muted-foreground truncate">
            Bảng chi tiết chuyến đi tương tác
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={closeArtifact}
          title="Đóng bảng chi tiết"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 flex h-dvh flex-col bg-background"
        >
          {header}
          <div className="flex-1 overflow-hidden">
            <ItineraryArtifactContent proposal={artifact.proposal} />
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: "50%", opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-full shrink-0 flex-col overflow-hidden border-l border-border/60 bg-background shadow-xl"
      >
        {header}
        <div className="flex-1 overflow-hidden">
          <ItineraryArtifactContent proposal={artifact.proposal} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
