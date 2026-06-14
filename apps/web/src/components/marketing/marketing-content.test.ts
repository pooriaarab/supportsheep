import { describe, expect, it } from "vitest";

import { AUDIENCES, FAQS, FEATURES, STEPS } from "./marketing-content";

describe("marketing content", () => {
  it("ships six features, each with a title and description", () => {
    expect(FEATURES).toHaveLength(6);
    for (const feature of FEATURES) {
      expect(feature.title.trim().length).toBeGreaterThan(0);
      expect(feature.description.trim().length).toBeGreaterThan(0);
      expect(typeof feature.icon).toBe("object");
    }
  });

  it("describes three ordered, distinctly-numbered steps", () => {
    expect(STEPS).toHaveLength(3);
    const numbers = STEPS.map((step) => step.step);
    expect(new Set(numbers).size).toBe(STEPS.length);
    for (const step of STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("lists audiences with non-empty copy", () => {
    expect(AUDIENCES.length).toBeGreaterThan(0);
    for (const audience of AUDIENCES) {
      expect(audience.title.trim().length).toBeGreaterThan(0);
      expect(audience.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("provides 5-7 FAQs, each a unique non-empty question with an answer", () => {
    expect(FAQS.length).toBeGreaterThanOrEqual(5);
    expect(FAQS.length).toBeLessThanOrEqual(7);

    const questions = FAQS.map((faq) => faq.question);
    expect(new Set(questions).size).toBe(FAQS.length);

    for (const faq of FAQS) {
      expect(faq.question.trim().length).toBeGreaterThan(0);
      expect(faq.answer.trim().length).toBeGreaterThan(0);
    }
  });
});
