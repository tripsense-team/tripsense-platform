import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "../components/onboarding-wizard";
import { onboardingApi } from "../services/onboarding-api";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
  t: (key: string, options?: Record<string, unknown>) => key === "onboarding.progress"
    ? `${options?.current}/${options?.total}` : key,
  user: { id: "u1", name: "Traveler" },
  completed: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span>{alt}</span> }));
vi.mock("@/i18n", () => ({ useTranslation: () => ({ t: mocks.t }) }));
vi.mock("@/features/auth", () => ({
  useAuth: () => ({ user: mocks.user }),
  useAuthStore: { getState: () => ({ setOnboardingCompleted: mocks.completed }) },
}));
vi.mock("@/features/profile", () => ({ profileService: { updateProfile: vi.fn() } }));
vi.mock("../services/onboarding-api", () => ({ onboardingApi: {
  get: vi.fn(), start: vi.fn(), save: vi.fn(), complete: vi.fn(), markProfileComplete: vi.fn(),
} }));

describe("required daily budget in the existing onboarding step", () => {
  let root: Root;
  let container: HTMLDivElement;
  const button = (key: string) => Array.from(container.querySelectorAll("button"))
    .find((node) => node.textContent?.includes(key))!;
  const budgetInput = () => container.querySelector<HTMLInputElement>("#daily-budget")!;
  async function click(key: string) { await act(async () => button(key).click()); }
  async function enter(value: string) {
    const input = container.querySelector('input[aria-label="onboarding.dailyBudget.label"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  beforeEach(async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.mocked(onboardingApi.get).mockResolvedValue({ version: 1, status: "IN_PROGRESS",
      selections: { TRAVEL_PARTY: ["SOLO"], BUDGET_TIER: ["MID_RANGE"],
        STAY_STYLE: ["HOTEL"], FOOD_STYLE: ["CAFE"], ACTIVITY_INTEREST: ["BEACH"] },
      places: {}, attributes: { PRESERVE_ME: "{}" } });
    vi.mocked(onboardingApi.save).mockResolvedValue({ version: 2, status: "IN_PROGRESS", selections: {}, places: {} });
    vi.mocked(onboardingApi.complete).mockResolvedValue({ version: 3, status: "COMPLETED", selections: {}, places: {} });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
    await act(async () => root.render(<OnboardingWizard />));
    for (let i = 0; i < 5; i++) await click("auth.continue");
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

  it("groups English keyboard input live and preserves the caret while typing each digit", async () => {
    const input = budgetInput();
    await act(async () => input.focus());
    for (const amount of ["500000", "700000"]) {
      await enter("");
      let typed = "";
      for (const digit of amount) {
        typed += digit;
        await enter(input.value + digit);
        expect(input.value).toBe(new Intl.NumberFormat("vi-VN").format(Number(typed)));
        expect(input.selectionStart).toBe(input.value.length);
      }
    }
    expect(button("auth.continue").disabled).toBe(false);
    await act(async () => input.blur());
    expect(input.value).toBe("700.000");
    await act(async () => input.focus());
    expect(input.value).toBe("700.000");
    for (let i = 0; i < 4; i++) await click("auth.continue");
    await click("onboarding.finish");
    expect(vi.mocked(onboardingApi.save).mock.calls[0][0].selections.DAILY_BUDGET_VND)
      .toEqual(["700000"]);
  });

  it("keeps Vietnamese IME composition text intact and validates after composition ends", async () => {
    const input = budgetInput();
    await act(async () => {
      input.focus();
      input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    });
    for (const value of ["7", "70", "700", "7000", "70000", "700000"]) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new InputEvent("input", {
          bubbles: true, data: "0", isComposing: true, inputType: "insertCompositionText",
        }));
      });
      expect(input.value).toBe(value);
      expect(container.querySelector("#daily-budget-composition-view")?.textContent)
        .toBe(new Intl.NumberFormat("vi-VN").format(Number(value)));
      expect(input.style.color).toBe("transparent");
      expect(container.querySelector("#daily-budget-error")).toBeNull();
      expect(button("auth.continue").disabled).toBe(true);
    }
    await act(async () => input.dispatchEvent(new CompositionEvent("compositionend", {
      bubbles: true, data: "700000",
    })));
    expect(input.value).toBe("700.000");
    expect(button("auth.continue").disabled).toBe(false);
    expect(container.querySelector("#daily-budget-composition-view")).toBeNull();
    expect(input.style.color).toBe("");
    await act(async () => input.blur());
    expect(input.value).toBe("700.000");
  });

  it("supports middle edits, Backspace, grouped paste and clearing without corrupting the value", async () => {
    const input = budgetInput();
    await act(async () => input.focus());
    await enter("700000");
    await act(async () => {
      input.setSelectionRange(1, 1);
      input.setRangeText("2", 1, 1, "end");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "2", inputType: "insertText" }));
    });
    expect(input.value).toBe("7.200.000");
    expect(input.selectionStart).toBe(3);
    await act(async () => {
      input.setRangeText("", 2, 3, "end");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    });
    expect(input.value).toBe("700.000");
    expect(input.selectionStart).toBe(1);
    await enter("700.000");
    expect(button("auth.continue").disabled).toBe(false);
    await act(async () => input.blur());
    expect(input.value).toBe("700.000");
    await act(async () => input.focus());
    expect(input.value).toBe("700.000");
    await enter("");
    expect(input.value).toBe("");
    expect(button("auth.continue").disabled).toBe(true);
  });

  it("handles Backspace across a grouping mark and rejects decimal paste into a grouped amount", async () => {
    const input = budgetInput();
    await act(async () => input.focus());
    await enter("500000");
    await act(async () => {
      input.setRangeText("", 3, 4, "end");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    });
    expect(input.value).toBe("50.000");
    expect(input.selectionStart).toBe(2);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1.5");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "1.5", inputType: "insertFromPaste" }));
    });
    expect(input.value).toBe("1.5");
    expect(button("auth.continue").disabled).toBe(true);
  });

  it("does not rewrite existing grouping at Vietnamese composition start", async () => {
    const input = budgetInput();
    await act(async () => input.focus());
    await enter("500000");
    await act(async () => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    expect(input.value).toBe("500.000");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "500.0000");
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "0", isComposing: true, inputType: "insertCompositionText" }));
    });
    expect(input.value).toBe("500.0000");
    expect(container.querySelector("#daily-budget-composition-view")?.textContent).toBe("5.000.000");
    await act(async () => input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "0" })));
    expect(input.value).toBe("5.000.000");
    expect(input.selectionStart).toBe(input.value.length);
    expect(button("auth.continue").disabled).toBe(false);
  });

  it("keeps ten steps, requires an amount and preserves it through Back and final save", async () => {
    expect(button("auth.continue").disabled).toBe(true);
    expect(container.textContent).toContain("6/10");
    expect(container.textContent).not.toContain("onboarding.customOption.add");
    for (const value of ["", "0", "-1", "1.5", "1e6", "1000000001"]) {
      await enter(value); expect(button("auth.continue").disabled).toBe(true);
    }
    await enter("700000");
    expect(button("auth.continue").disabled).toBe(false);
    await click("auth.continue"); await click("common.back");
    expect((container.querySelector('input[aria-label="onboarding.dailyBudget.label"]') as HTMLInputElement).value).toBe("700.000");
    for (let i = 0; i < 4; i++) await click("auth.continue");
    await click("onboarding.finish");
    const payload = vi.mocked(onboardingApi.save).mock.calls[0][0];
    expect(payload.selections.DAILY_BUDGET_VND).toEqual(["700000"]);
    expect(payload.selections.BUDGET_TIER).toEqual(["MID_RANGE"]);
    expect(payload.attributes?.PRESERVE_ME).toBe("{}");
  });
});
