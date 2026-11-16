"use client";

import * as React from "react";
import type { ComponentProps } from "react";
import { MapPin } from "lucide-react";
import { normalizeSearchText } from "@/features/trip-management/utils/search";
import { cn } from "@/lib/utils";
import type { PlaceMentionTarget } from "./chat-place-resolver";
import { usePlaceDetailAction } from "./place-detail-action-context";

const HAS_EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;
const LEADING_EMOJI_RE =
  /^(?:(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\uFE0F|\u200D(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}))*\s*)+/u;

const TIP_SECTION_HEADING_RE =
  /^(?:[-*•]\s+)?(?:#{1,4}\s+)?(?:\*\*|__)?((?:Một số )?(?:Lưu ý(?: thực tế| quan trọng| hữu ích)?(?: cho chuyến đi)?|Mẹo hay(?: cho chuyến đi)?|Practical tips|Travel tips)(?:\s*cho chuyến đi)?)\s*[:：]?(?:\*\*|__)?\s*$/i;

const TIP_TOPIC_RULES: ReadonlyArray<{ icon: string; pattern: RegExp }> = [
  {
    icon: "🥾",
    pattern:
      /^(?:Di chuyển(?:\s*[&và,/]\s*Tham quan)?|Tham quan|Phương tiện|Getting around|Transport(?:ation)?(?:\s*[&and,/]\s*Sightseeing)?|Sightseeing)$/i,
  },
  {
    icon: "🌤️",
    pattern:
      /^(?:Thời tiết(?:\s*[&và,/]\s*Trang phục)?|Trang phục|Hành lý|Weather(?:\s*[&and,/]\s*Packing)?|Packing|Clothing)$/i,
  },
  {
    icon: "🍜",
    pattern:
      /^(?:Thưởng thức ẩm thực|Ẩm thực(?:\s*[&và,/]\s*Đặt bàn)?|Ăn uống|Đặc sản|Đặt bàn|Food(?:\s*[&and,/]\s*Dining)?|Dining|Cuisine)$/i,
  },
  {
    icon: "🏨",
    pattern: /^(?:Lưu trú|Khách sạn|Nhận\/trả phòng|Check-in|Accommodation|Stay)$/i,
  },
  {
    icon: "💳",
    pattern: /^(?:Ngân sách|Chi phí|Tiết kiệm|Thanh toán|Vé tham quan|Budget|Cost|Tickets?)$/i,
  },
  {
    icon: "💡",
    pattern: /^(?:Lưu ý(?: nhỏ| thêm| chung)?|Mẹo nhỏ|Tip|Note)$/i,
  },
];

function parseLeadingLabeledLine(trimmed: string): {
  emoji?: string;
  label: string;
  body: string;
} | null {
  let rest = trimmed.replace(/^[-*•]\s+/, "").trim();
  const leadEmojiMatch = rest.match(LEADING_EMOJI_RE);
  const emoji = leadEmojiMatch?.[0].trim() || undefined;
  if (leadEmojiMatch) {
    rest = rest.slice(leadEmojiMatch[0].length).trim();
  }

  // Case A: **Label:** body or **Label**: body
  const boldMatch = rest.match(/^(?:\*\*|__)([^*\n]+?)(?:\*\*|__)\s*[:：]?\s*(.+)$/);
  if (boldMatch) {
    const rawLabel = boldMatch[1].trim();
    const hasTrailingColonInBold = /[:：]\s*$/.test(rawLabel);
    const hasColonBetween = /^(?:\*\*|__)[^*\n]+?(?:\*\*|__)\s*[:：]/.test(rest);
    if (hasTrailingColonInBold || hasColonBetween) {
      const innerEmoji = rawLabel.match(LEADING_EMOJI_RE)?.[0].trim() || undefined;
      return {
        emoji: emoji || innerEmoji,
        label: rawLabel.replace(LEADING_EMOJI_RE, "").replace(/[:：\s]+$/, "").trim(),
        body: boldMatch[2].trim(),
      };
    }
  }

  // Case B: Plain Label: body
  const plainMatch = rest.match(/^([^:\n*_{}\[\]]+?)\s*[:：]\s*(.+)$/);
  if (!plainMatch) {
    return null;
  }
  const rawLabel = plainMatch[1].trim();
  const innerEmoji = rawLabel.match(LEADING_EMOJI_RE)?.[0].trim() || undefined;
  return {
    emoji: emoji || innerEmoji,
    label: rawLabel.replace(LEADING_EMOJI_RE, "").trim(),
    body: plainMatch[2].trim(),
  };
}

function decorateTipLines(text: string): string {
  const lines = text.split("\n");
  let inCodeFence = false;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        inCodeFence = !inCodeFence;
        return line;
      }
      if (inCodeFence || !trimmed) {
        return line;
      }

      const headingMatch = trimmed.match(TIP_SECTION_HEADING_RE);
      if (headingMatch) {
        const cleanHeading = headingMatch[1].replace(/[:：\s]+$/, "").trim();
        if (HAS_EMOJI_RE.test(trimmed)) {
          return line;
        }
        return `\n✨ **${cleanHeading}:**\n`;
      }

      const parsed = parseLeadingLabeledLine(trimmed);
      if (!parsed) {
        return line;
      }

      const matchedRule = TIP_TOPIC_RULES.find((rule) =>
        rule.pattern.test(parsed.label),
      );
      if (!matchedRule) {
        return line;
      }

      const icon = parsed.emoji || matchedRule.icon;
      return `- ${icon} **${parsed.label}:** ${parsed.body}`;
    })
    .join("\n");
}

export interface DecorateItineraryOptions {
  placeTargets?: ReadonlyArray<PlaceMentionTarget>;
  excludedNames?: ReadonlyArray<string>;
  isStreaming?: boolean;
}

const PLACE_HREF_PREFIX = "#place:";
const PLACE_ID_HREF_PREFIX = "#place-id:";

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function encodePlaceHref(
  rawTarget: string,
  prefix: typeof PLACE_HREF_PREFIX | typeof PLACE_ID_HREF_PREFIX = PLACE_HREF_PREFIX,
): string {
  return `${prefix}${encodeURIComponent(rawTarget.trim())}`;
}

export function parsePlaceHref(
  href?: string | null,
): { nameHint?: string; placeIdHint?: string } | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (trimmed.startsWith(PLACE_ID_HREF_PREFIX)) {
    const rawId = trimmed.slice(PLACE_ID_HREF_PREFIX.length);
    const decoded = safeDecodeURIComponent(rawId).trim();
    return decoded ? { placeIdHint: decoded } : null;
  }
  if (trimmed.startsWith(PLACE_HREF_PREFIX)) {
    const rawName = trimmed.slice(PLACE_HREF_PREFIX.length);
    const decoded = safeDecodeURIComponent(rawName).trim();
    return decoded ? { nameHint: decoded } : null;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePlaceLinksInLine(line: string): string {
  let out = "";
  let i = 0;

  while (i < line.length) {
    const openMarker = line.indexOf("](#place", i);
    if (openMarker === -1) {
      out += line.slice(i);
      break;
    }

    const prefixStart = openMarker + 2;
    const isIdPrefix = line.startsWith("#place-id:", prefixStart);
    const isNamePrefix = !isIdPrefix && line.startsWith("#place:", prefixStart);
    if (!isIdPrefix && !isNamePrefix) {
      out += line.slice(i, prefixStart);
      i = prefixStart;
      continue;
    }

    const prefix = isIdPrefix ? PLACE_ID_HREF_PREFIX : PLACE_HREF_PREFIX;
    const valueStart = prefixStart + prefix.length;

    let depth = 1;
    let cursor = valueStart;
    while (cursor < line.length && depth > 0) {
      const ch = line[cursor];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      if (depth > 0) cursor += 1;
    }

    if (depth !== 0) {
      // Incomplete link while streaming: keep untouched until closing paren arrives
      out += line.slice(i);
      break;
    }

    const rawValue = line.slice(valueStart, cursor);
    const decoded = safeDecodeURIComponent(rawValue).trim();
    out += line.slice(i, openMarker + 2);
    out += decoded ? encodePlaceHref(decoded, prefix) : rawValue;
    out += ")";
    i = cursor + 1;
  }

  return out;
}

const PROTECTED_MARKDOWN_SEGMENT_RE =
  /(`[^`]+`|\[[^\]]+\]\((?:[^()\n]|\([^()\n]*\))+\)|https?:\/\/[^\s)>\]]+)/g;

/**
 * Safely wraps known grounded place names inside markdown prose into internal
 * `#place:` links while skipping headings, code blocks, inline code, URLs,
 * existing markdown links, short generic nouns, and destination city names.
 */
export function linkKnownPlacesInMarkdown(
  raw: string,
  targets: ReadonlyArray<PlaceMentionTarget>,
  options?: { excludedNames?: ReadonlyArray<string> },
): string {
  if (!raw || !targets || targets.length === 0) return raw;

  const excludedNorm = new Set<string>();
  for (const name of options?.excludedNames ?? []) {
    for (const part of name.split(/[,–—|]/)) {
      const norm = normalizeSearchText(part).replace(/\s+/g, " ").trim();
      if (norm) excludedNorm.add(norm);
    }
  }

  const canonicalByLower = new Map<string, string>();
  for (const target of targets) {
    const trimmed = target.name?.trim();
    if (!trimmed || trimmed.length < 4) continue;
    const norm = normalizeSearchText(trimmed).replace(/\s+/g, " ").trim();
    if (!norm || norm.length < 4 || excludedNorm.has(norm)) continue;

    const lowerKey = trimmed.toLocaleLowerCase("vi");
    if (!canonicalByLower.has(lowerKey)) {
      canonicalByLower.set(lowerKey, trimmed);
    }
  }

  const sortedNames = Array.from(canonicalByLower.values()).sort(
    (a, b) => b.length - a.length,
  );
  if (sortedNames.length === 0) return raw;

  const matcher = new RegExp(
    `(?<![\\p{L}\\p{N}_])(${sortedNames.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`,
    "giu",
  );

  const lines = raw.split("\n");
  let inCodeFence = false;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        inCodeFence = !inCodeFence;
        return line;
      }
      if (
        inCodeFence ||
        !trimmed ||
        /^#{1,6}\s/.test(trimmed) ||
        /^[-*_]{3,}$/.test(trimmed)
      ) {
        return line;
      }

      const normalizedLine = normalizePlaceLinksInLine(line);
      const parts = normalizedLine.split(PROTECTED_MARKDOWN_SEGMENT_RE);
      return parts
        .map((segment, idx) => {
          // Odd indices are protected code/links/URLs captured by split group
          if (idx % 2 === 1 || !segment) {
            return segment;
          }
          return segment.replace(matcher, (matched) => {
            const canonical =
              canonicalByLower.get(matched.toLocaleLowerCase("vi")) ?? matched;
            return `[${matched}](${encodePlaceHref(canonical)})`;
          });
        })
        .join("");
    })
    .join("\n");
}

function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).join("");
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractTextFromReactNode(node.props.children);
  }
  return "";
}

function RichMarkdownLink({
  href,
  children,
  className,
  ...props
}: ComponentProps<"a">) {
  const { openPlaceDetail } = usePlaceDetailAction();
  const parsed = parsePlaceHref(href);

  if (parsed) {
    const labelText = extractTextFromReactNode(children).trim();
    const resolvedNameHint = parsed.nameHint || labelText || undefined;
    return (
      <button
        type="button"
        data-place-link="true"
        data-place-name={resolvedNameHint}
        data-place-id={parsed.placeIdHint}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openPlaceDetail?.({
            nameHint: resolvedNameHint,
            placeIdHint: parsed.placeIdHint,
          });
        }}
        className={cn(
          "inline items-baseline text-left font-semibold text-foreground underline decoration-primary/45 decoration-[1.5px] underline-offset-[3px] transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xs cursor-pointer",
          className,
        )}
      >
        <span>{children}</span>
        <MapPin
          className="ml-0.5 inline size-3 -translate-y-[1px] text-primary/75 shrink-0"
          aria-hidden="true"
        />
      </button>
    );
  }

  const domProps = { ...props } as ComponentProps<"a"> & { node?: unknown };
  delete domProps.node;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors",
        className,
      )}
      {...domProps}
    >
      {children}
    </a>
  );
}

/**
 * Preprocesses markdown text to ensure Mindtrip itinerary formatting:
 * - Day milestones with icons and dividers
 * - Time-of-day emojis (☀️ Morning, 🌤️ Afternoon, 🌙 Evening)
 * - Topic icons on practical travel tip headings and bullet points
 * - Strips model-authored verification badges
 * - Normalizes `#place:` links and optionally auto-links grounded places when settled
 */
export function decorateItineraryMarkdown(
  raw: string,
  options?: DecorateItineraryOptions,
): string {
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
    const hasEmoji = HAS_EMOJI_RE.test(cleanTitle);
    const icon = hasEmoji ? "" : `${dayIcons[(num - 1) % dayIcons.length]} `;
    const heading = `### Day ${num} – ${icon}${cleanTitle}`;
    // Add divider before Day 2, Day 3, etc. if not preceded by ---
    return num > 1 ? `\n\n---\n\n${heading}` : `\n\n${heading}`;
  });

  // 3. Decorate practical tip headings and topic bullets idempotently
  text = decorateTipLines(text);

  // Verification is authoritative UI state from Trip Service, never model text.
  text = text.replace(/\s*(?:✓|\[verified\])/gi, "");

  // 4. Normalize model-emitted `#place:` URLs and auto-link grounded entities post-stream
  text = text
    .split("\n")
    .map((line) => normalizePlaceLinksInLine(line))
    .join("\n");

  if (!options?.isStreaming && options?.placeTargets?.length) {
    text = linkKnownPlacesInMarkdown(text, options.placeTargets, {
      excludedNames: options.excludedNames,
    });
  }

  return text;
}

/**
 * Streamdown custom components for rich itinerary presentation
 */
export const richMarkdownComponents = {
  p: ({ children, className, ...props }: ComponentProps<"p">) => (
    <p
      className={cn("my-1.5 text-[15px] leading-[1.65] text-foreground/95", className)}
      {...props}
    >
      {children}
    </p>
  ),

  ul: ({ children, className, ...props }: ComponentProps<"ul">) => (
    <ul
      className={cn("my-2.5 space-y-1.5 pl-5 list-disc text-foreground/95", className)}
      {...props}
    >
      {children}
    </ul>
  ),

  ol: ({ children, className, ...props }: ComponentProps<"ol">) => (
    <ol
      className={cn("my-2.5 space-y-1.5 pl-5 list-decimal text-foreground/95", className)}
      {...props}
    >
      {children}
    </ol>
  ),

  li: ({ children, className, ...props }: ComponentProps<"li">) => (
    <li
      className={cn("text-[15px] leading-[1.6] marker:text-primary/60", className)}
      {...props}
    >
      {children}
    </li>
  ),

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

  a: RichMarkdownLink,
};
