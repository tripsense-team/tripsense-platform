import * as React from "react";
import { CircleHelp, ListChecks } from "lucide-react";
import type { AiPlaceEvidence } from "./types";

const INLINE = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\([^)]*\))/g;
const HEADING = /^#{2,3}\s+(.+)$/;
const BULLET = /^[-*]\s+(.+)$/;
const NUMBERED = /^\d+[.)]\s+(.+)$/;
const TABLE_SEPARATOR_CELL = /^:?-{3,}:?$/;

type Section = { heading?: string; lines: string[] };

function sections(content: string): Section[] {
  const result: Section[] = [{ lines: [] }];
  for (const line of content.split(/\r?\n/)) {
    const heading = HEADING.exec(line.trim());
    if (heading) result.push({ heading: heading[1], lines: [] });
    else result[result.length - 1].lines.push(line);
  }
  return result.filter((section) => section.heading || section.lines.some((line) => line.trim()));
}

export function RichAnswer({ content, places, onSelectPlace }: {
  content: string;
  places: AiPlaceEvidence[];
  onSelectPlace: (id: string) => void;
}) {
  const byName = new Map(places.filter((place) => place.location)
    .map((place) => [place.title.trim().toLocaleLowerCase(), place.canonicalPlaceId]));

  function inline(value: string, keyPrefix = "inline"): React.ReactNode[] {
    const output: React.ReactNode[] = [];
    let cursor = 0;
    let matchIdx = 0;
    for (const match of value.matchAll(INLINE)) {
      const index = match.index ?? 0;
      if (index > cursor) output.push(value.slice(cursor, index));
      const label = match[2] || match[4] || "";
      const placeId = byName.get(label.trim().toLocaleLowerCase());
      const childKey = `${keyPrefix}-m${matchIdx++}-${index}`;
      output.push(placeId
        ? <button key={childKey} type="button" className="font-semibold text-primary underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => onSelectPlace(placeId)}>{label}</button>
        : match[2] ? <strong key={childKey} className="font-semibold">{label}</strong> : <span key={childKey}>{label}</span>);
      cursor = index + match[0].length;
    }
    if (cursor < value.length) output.push(value.slice(cursor));
    return output;
  }

  function body(lines: string[], sectionPrefix = "sec"): React.ReactNode[] {
    const output: React.ReactNode[] = [];
    let index = 0;
    let blockCount = 0;
    while (index < lines.length) {
      const line = lines[index].trim();
      if (!line) { index++; continue; }
      if (line.includes("|") && index + 1 < lines.length) {
        const cells = (value: string) => value.trim().replace(/^\|/, "").replace(/\|$/, "")
          .split("|").map((cell) => cell.trim());
        const headers = cells(line);
        const separator = cells(lines[index + 1]);
        if (headers.length > 1 && separator.length === headers.length
          && separator.every((cell) => TABLE_SEPARATOR_CELL.test(cell))) {
          const rows: string[][] = [];
          index += 2;
          while (index < lines.length && lines[index].includes("|")) {
            const row = cells(lines[index]);
            if (row.length !== headers.length) break;
            rows.push(row);
            index++;
          }
          const tableId = `${sectionPrefix}-table-${index}-${blockCount++}`;
          output.push(
            <div key={tableId} className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead className="bg-muted/60">
                  <tr>{headers.map((header, column) => <th key={`${tableId}-h-${column}`} className="border-b border-border px-3 py-2 font-semibold">{inline(header, `${tableId}-h-${column}`)}</th>)}</tr>
                </thead>
                <tbody>{rows.map((row, rowIndex) => <tr key={`${tableId}-r-${rowIndex}`} className="border-b border-border/60 last:border-b-0">
                  {row.map((cell, column) => <td key={`${tableId}-r-${rowIndex}-c-${column}`} className="px-3 py-2 align-top">{inline(cell, `${tableId}-r-${rowIndex}-c-${column}`)}</td>)}
                </tr>)}</tbody>
              </table>
            </div>,
          );
          continue;
        }
      }
      const kind = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
      if (kind) {
        const listStartIndex = index;
        const items: string[] = [];
        while (index < lines.length) {
          const match = kind.exec(lines[index].trim());
          if (!match) break;
          items.push(match[1]);
          index++;
        }
        const blockId = `${sectionPrefix}-list-${listStartIndex}-${blockCount++}`;
        const listItems = items.map((item, itemIndex) => (
          <li key={`${blockId}-item-${itemIndex}`} className="pl-1 leading-relaxed">
            {inline(item, `${blockId}-item-${itemIndex}`)}
          </li>
        ));
        output.push(kind === BULLET
          ? <ul key={blockId} className="ml-5 list-disc space-y-1.5 marker:text-primary">{listItems}</ul>
          : <ol key={blockId} className="ml-5 list-decimal space-y-1.5 marker:font-semibold marker:text-primary">{listItems}</ol>);
        continue;
      }
      const pBlockId = `${sectionPrefix}-p-${index}-${blockCount++}`;
      output.push(<p key={pBlockId} className="leading-relaxed">{inline(line, pBlockId)}</p>);
      index++;
    }
    return output;
  }

  return <div className="space-y-3 break-words text-sm text-foreground">
    {sections(content).map((section, sectionIndex) => {
      const isQuestion = Boolean(section.heading && /(?:cần bạn|câu hỏi|để chốt|hoàn thiện)/i.test(section.heading));
      const secKey = `sec-${sectionIndex}`;
      return <section key={secKey} className={section.heading
        ? `rounded-xl border p-4 shadow-xs ${isQuestion ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`
        : "space-y-2 px-1 py-1"}>
        {section.heading && <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          {isQuestion ? <CircleHelp className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            : <ListChecks className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
          {inline(section.heading, `${secKey}-h`)}
        </h3>}
        <div className="space-y-2.5">{body(section.lines, secKey)}</div>
      </section>;
    })}
  </div>;
}
