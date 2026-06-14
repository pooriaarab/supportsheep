import { beforeEach, describe, expect, it } from "vitest";

import {
  AI_IMAGE_COST_USD,
  IMAGE_BUDGET_CAP_USD,
  clearImageBudget,
  getImageSpend,
  recordImageSpend,
  wouldExceedImageBudget,
} from "./image-budget";

describe("image-budget", () => {
  beforeEach(() => {
    clearImageBudget("int-A");
    clearImageBudget("int-B");
  });

  it("allows spend up to the cap", () => {
    expect(wouldExceedImageBudget("int-A")).toBe(false);
    recordImageSpend("int-A");
    expect(getImageSpend("int-A")).toBe(AI_IMAGE_COST_USD);
    expect(wouldExceedImageBudget("int-A")).toBe(false);
  });

  it("refuses once the next image would breach the cap", () => {
    const maxCalls = Math.floor(IMAGE_BUDGET_CAP_USD / AI_IMAGE_COST_USD);
    for (let i = 0; i < maxCalls; i++) {
      expect(wouldExceedImageBudget("int-A")).toBe(false);
      recordImageSpend("int-A");
    }
    // Next call would put us over.
    expect(wouldExceedImageBudget("int-A")).toBe(true);
  });

  it("budgets are isolated per interview", () => {
    for (let i = 0; i < 10; i++) recordImageSpend("int-A");
    expect(wouldExceedImageBudget("int-A")).toBe(true);
    expect(wouldExceedImageBudget("int-B")).toBe(false);
  });

  it("clearImageBudget resets state", () => {
    for (let i = 0; i < 10; i++) recordImageSpend("int-A");
    clearImageBudget("int-A");
    expect(getImageSpend("int-A")).toBe(0);
    expect(wouldExceedImageBudget("int-A")).toBe(false);
  });
});
