import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appDirectory = resolve(process.cwd(), "src/app");
const sourceDirectory = resolve(process.cwd(), "src");

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;

    if (entry.isDirectory() && entry.name !== "__tests__") {
      return collectSourceFiles(path);
    }

    if (entry.isDirectory()) return [];

    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("web typography contract", () => {
  it("loads both official local Inter variable faces from the root layout", () => {
    const layout = readFileSync(`${appDirectory}/layout.tsx`, "utf8");

    expect(layout).toContain('import localFont from "next/font/local"');
    expect(layout).toContain("./fonts/InterVariable.woff2");
    expect(layout).toContain("./fonts/InterVariable-Italic.woff2");
    expect(layout).toContain('variable: "--font-inter"');
    expect(existsSync(`${appDirectory}/fonts/OFL.txt`)).toBe(true);
  });

  it("exposes the approved semantic type roles", () => {
    const styles = readFileSync(`${appDirectory}/globals.css`, "utf8");

    for (const role of [
      "display",
      "page-title",
      "section-title",
      "heading",
      "body-lg",
      "body",
      "control",
      "label",
      "caption",
      "micro",
      "overline",
    ]) {
      expect(styles).toContain(`--text-${role}:`);
    }

    expect(styles).toContain("--font-weight-normal: 450");
    expect(styles).toContain("--font-weight-medium: 550");
    expect(styles).toContain("--font-weight-semibold: 650");
    expect(styles).toContain("--font-weight-bold: 700");
  });

  it("does not reintroduce undersized or excessively heavy product text", () => {
    const productSource = collectSourceFiles(sourceDirectory)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(productSource).not.toMatch(/text-\[(?:9|10)px\]/);
    expect(productSource).not.toContain("font-black");
    expect(productSource).not.toContain("font-extrabold");
  });
});
