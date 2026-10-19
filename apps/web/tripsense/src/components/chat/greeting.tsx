"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useAuthStore } from "@/features/auth";
import { useTranslation } from "@/i18n";

export function Greeting() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);

  const firstName = user?.name ? user.name.trim().split(" ").pop() : null;
  const heading = firstName
    ? t("aiPlanner.greetingHeadingWithUser", { name: firstName })
    : t("aiPlanner.greetingHeadingDefault");

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
        {t("aiPlanner.greetingDesc1")}
        <br />
        {t("aiPlanner.greetingDesc2")}
      </motion.p>
    </div>
  );
}
