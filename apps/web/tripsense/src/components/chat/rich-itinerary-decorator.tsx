"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Preprocesses markdown text to ensure Mindtrip itinerary formatting:
 * - Day milestones with icons and dividers
 * - Time-of-day emojis (☀️ Morning, 🌤️ Afternoon, 🌙 Evening)
 * - Place names with verified checkmark badges
 */
export function decorateItineraryMarkdown(raw: string): string {
  if (!raw) return "";

  let text = raw;

  // 1. Normalize time-of-day markers to standard bold format with emojis
  text = text.replace(
    /(?:^|\n)\s*(?:☀️\s*)?(?:Morning|Buổi sáng|Sáng)\s*[:：]/gi,
    "\n\n☀️ **Morning:**"
  );
  text = text.replace(
    /(?:^|\n)\s*(?:🌤️\s*)?(?:Afternoon|Buổi trưa|Buổi chiều|Chiều|Trưa)\s*[:：]/gi,
    "\n\n🌤️ **Afternoon:**"
  );
  text = text.replace(
    /(?:^|\n)\s*(?:🌙\s*)?(?:Evening|Buổi tối|Tối)\s*[:：]/gi,
    "\n\n🌙 **Evening:**"
  );

  // 2. Normalize Day headings: e.g. "Day 1 – ...", "### Day 1: ...", "Ngày 1: ..."
  const dayIcons = ["🏯", "🧧", "🏟️", "🌲", "🌊", "🛍️", "✈️"];
  const dayRegex = /(?:^|\n)(?:#{1,3}\s*)?(?:Day|Ngày)\s*(\d+)[\s:–-]+([^\n]+)/gi;

  text = text.replace(dayRegex, (match, dayNum, title) => {
    const num = parseInt(dayNum, 10);
    const cleanTitle = title.trim();
    // Check if title already contains an emoji
    const hasEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(cleanTitle);
    const icon = hasEmoji ? "" : `${dayIcons[(num - 1) % dayIcons.length]} `;
    const heading = `### Day ${num} – ${icon}${cleanTitle}`;
    // Add divider before Day 2, Day 3, etc. if not preceded by ---
    return num > 1 ? `\n\n---\n\n${heading}` : `\n\n${heading}`;
  });

  // Verification is authoritative UI state from Trip Service, never model text.
  text = text.replace(/\s*(?:✓|\[verified\])/gi, "");

  return text;
}

/**
 * Streamdown custom components for rich itinerary presentation
 */
export const richMarkdownComponents = {
  strong: ({ children, ...props }: ComponentProps<"strong">) => {
    return (
      <strong className="font-semibold text-foreground" {...props}>
        {children}
      </strong>
    );
  },

  h3: ({ children, ...props }: ComponentProps<"h3">) => (
    <h3
      className="text-[16px] sm:text-[17px] font-bold text-foreground mt-4 mb-1 flex items-center gap-1.5"
      {...props}
    >
      {children}
    </h3>
  ),

  em: ({ children, className, ...props }: ComponentProps<"em">) => (
    <em
      className={cn("italic text-muted-foreground", className)}
      {...props}
    >
      {children}
    </em>
  ),

  hr: ({ ...props }: ComponentProps<"hr">) => (
    <hr className="my-4 border-border/40" {...props} />
  ),
};
