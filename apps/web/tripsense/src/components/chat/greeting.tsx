"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useAuthStore } from "@/features/auth";
import { useAiDrawerStore } from "@/stores/use-ai-drawer-store";

export function Greeting() {
  const user = useAuthStore((state) => state.user);
  const toggleDrawer = useAiDrawerStore((state) => state.toggleDrawer);

  const firstName = user?.name ? user.name.trim().split(" ").pop() : null;
  const heading = firstName ? `Where to today, ${firstName}?` : "Where to today?";

  return (
    <div className="flex flex-col items-center justify-center px-4 max-w-xl mx-auto py-4 select-none">
      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-6 flex items-center justify-center select-none pointer-events-none"
      >
        <Image
          src="/images/new-chat-graphic.webp"
          alt="TripSense AI Assistant"
          width={150}
          height={100}
          priority
          className="w-36 sm:w-40 h-auto object-contain select-none"
        />
      </motion.div>

      <motion.h1
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="text-center font-bold text-3xl sm:text-4xl tracking-tight text-foreground"
      >
        {heading}
      </motion.h1>

      <motion.p
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 text-center text-sm md:text-base text-muted-foreground/90 max-w-md leading-relaxed font-normal"
      >
        Hey there, I&apos;m here to assist you in planning your experience.
        <br />
        Ask me anything travel related.
      </motion.p>

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-5 pointer-events-auto"
      >
        <button
          type="button"
          onClick={() => {
            toggleDrawer();
          }}
          className="px-4 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold border border-border/40 transition-colors shadow-2xs hover:shadow-xs cursor-pointer"
        >
          Update my assistant
        </button>
      </motion.div>
    </div>
  );
}
