import { describe, expect, it } from "vitest";
import {
  CLAUDE_HAIKU_45_PRICING_USD_PER_M,
  CLAUDE_SONNET_46_PRICING_USD_PER_M,
  FIREBASE_STORAGE_PRICING,
  IMAGE_PRICING_USD_PER_IMAGE,
  REALTIME_PRICING_USD_PER_M,
  WRITER_PRICING_USD_PER_M,
  computeHaikuCost,
  computeImageCost,
  computeRealtimeCost,
  computeStorageCost,
  computeTotalCost,
  computeWriterCost,
  roundCostUsd,
} from "./cost";

describe("Cost Computation", () => {
  describe("pricing constants (verified against published pricing 2026-05-22)", () => {
    it("matches OpenAI Realtime API audio rates", () => {
      // https://openai.com/api/pricing/ — gpt-realtime audio in $32/M, out $64/M, cached in $0.40/M
      expect(REALTIME_PRICING_USD_PER_M.input).toBe(32);
      expect(REALTIME_PRICING_USD_PER_M.cachedInput).toBe(0.4);
      expect(REALTIME_PRICING_USD_PER_M.output).toBe(64);
      expect(REALTIME_PRICING_USD_PER_M.textInput).toBe(4);
      expect(REALTIME_PRICING_USD_PER_M.textOutput).toBe(16);
    });

    it("matches Anthropic Claude Sonnet 4.6 rates", () => {
      // https://www.anthropic.com/pricing — Sonnet $3 input, $0.30 cached, $15 output per M
      expect(CLAUDE_SONNET_46_PRICING_USD_PER_M.input).toBe(3);
      expect(CLAUDE_SONNET_46_PRICING_USD_PER_M.cachedInput).toBe(0.3);
      expect(CLAUDE_SONNET_46_PRICING_USD_PER_M.output).toBe(15);
    });

    it("matches Anthropic Claude Haiku 4.5 rates", () => {
      // https://www.anthropic.com/pricing — Haiku $1 input, $0.10 cached, $5 output per M
      expect(CLAUDE_HAIKU_45_PRICING_USD_PER_M.input).toBe(1);
      expect(CLAUDE_HAIKU_45_PRICING_USD_PER_M.cachedInput).toBe(0.1);
      expect(CLAUDE_HAIKU_45_PRICING_USD_PER_M.output).toBe(5);
    });

    it("aliases WRITER_PRICING_USD_PER_M to Sonnet 4.6", () => {
      expect(WRITER_PRICING_USD_PER_M).toBe(CLAUDE_SONNET_46_PRICING_USD_PER_M);
    });

    it("matches gpt-image-1 + FLUX.1 schnell + Unsplash per-image rates", () => {
      // gpt-image-1 high-quality landscape ≈ $0.19/image (used in image-budget.ts)
      expect(IMAGE_PRICING_USD_PER_IMAGE.gptImage1).toBe(0.19);
      // FLUX.1 schnell @ ~$0.003/image on Replicate
      expect(IMAGE_PRICING_USD_PER_IMAGE.fluxSchnell).toBe(0.003);
      // Unsplash is free
      expect(IMAGE_PRICING_USD_PER_IMAGE.unsplash).toBe(0);
    });

    it("matches Firebase Cloud Storage standard rates", () => {
      expect(FIREBASE_STORAGE_PRICING.perGbMonth).toBe(0.026);
      expect(FIREBASE_STORAGE_PRICING.perGbEgress).toBe(0.12);
    });
  });

  describe("computeRealtimeCost", () => {
    it("returns 0 for zero tokens", () => {
      expect(computeRealtimeCost({ input: 0, output: 0 })).toBe(0);
    });

    it("computes cost for 1M input audio tokens at $32/M", () => {
      expect(computeRealtimeCost({ input: 1_000_000, output: 0 })).toBe(32);
    });

    it("computes cost for 1M output audio tokens at $64/M", () => {
      expect(computeRealtimeCost({ input: 0, output: 1_000_000 })).toBe(64);
    });

    it("bills cached input at the cache rate and remainder at fresh", () => {
      // 1M input, of which 800k cached → 200k fresh × $32 + 800k cached × $0.40
      const cost = computeRealtimeCost({
        input: 1_000_000,
        output: 0,
        cachedInput: 800_000,
      });
      // 200_000 × 32 / 1_000_000 = 6.4
      // 800_000 × 0.4 / 1_000_000 = 0.32
      expect(cost).toBeCloseTo(6.4 + 0.32, 6);
    });

    it("handles cachedInput larger than input safely (clamps to zero fresh)", () => {
      const cost = computeRealtimeCost({
        input: 1_000,
        output: 0,
        cachedInput: 10_000,
      });
      // freshInput floored at 0; only cached portion billed.
      expect(cost).toBeCloseTo((10_000 * 0.4) / 1_000_000, 6);
    });
  });

  describe("computeWriterCost (Claude Sonnet 4.6)", () => {
    it("returns 0 for zero tokens", () => {
      expect(computeWriterCost({ input: 0, cachedInput: 0, output: 0 })).toBe(0);
    });

    it("computes cost for 1M input at $3/M", () => {
      expect(computeWriterCost({ input: 1_000_000, cachedInput: 0, output: 0 })).toBe(3);
    });

    it("computes cost for 1M cached input at $0.30/M", () => {
      expect(computeWriterCost({ input: 0, cachedInput: 1_000_000, output: 0 })).toBe(0.3);
    });

    it("computes cost for 1M output at $15/M", () => {
      expect(computeWriterCost({ input: 0, cachedInput: 0, output: 1_000_000 })).toBe(15);
    });

    it("computes a mixed-token cost correctly", () => {
      // 500k × $3 + 200k × $0.30 + 100k × $15 = $1.50 + $0.06 + $1.50 = $3.06
      expect(
        computeWriterCost({ input: 500_000, cachedInput: 200_000, output: 100_000 }),
      ).toBeCloseTo(3.06, 6);
    });
  });

  describe("computeHaikuCost (Claude Haiku 4.5)", () => {
    it("returns 0 for zero tokens", () => {
      expect(computeHaikuCost({ input: 0, cachedInput: 0, output: 0 })).toBe(0);
    });

    it("computes cost at $1 input / $0.10 cached / $5 output per M", () => {
      // 1M input + 1M cached + 1M output = 1 + 0.1 + 5 = $6.10
      expect(
        computeHaikuCost({ input: 1_000_000, cachedInput: 1_000_000, output: 1_000_000 }),
      ).toBeCloseTo(6.1, 6);
    });
  });

  describe("computeImageCost", () => {
    it("bills gpt-image-1 at $0.19/image", () => {
      expect(computeImageCost("gptImage1")).toBe(0.19);
      expect(computeImageCost("gptImage1", 3)).toBeCloseTo(0.57, 6);
    });

    it("bills FLUX.1 schnell at $0.003/image", () => {
      expect(computeImageCost("fluxSchnell")).toBe(0.003);
      expect(computeImageCost("fluxSchnell", 10)).toBeCloseTo(0.03, 6);
    });

    it("bills Unsplash at $0", () => {
      expect(computeImageCost("unsplash", 100)).toBe(0);
    });
  });

  describe("computeStorageCost", () => {
    it("returns 0 for zero bytes", () => {
      expect(computeStorageCost(0)).toBe(0);
    });

    it("prorates Firebase storage at $0.026/GB-month", () => {
      // 1 GB × 1 month = $0.026
      expect(computeStorageCost(1024 * 1024 * 1024)).toBeCloseTo(0.026, 6);
    });

    it("multiplies by months", () => {
      // 1 GB × 6 months = $0.156
      expect(computeStorageCost(1024 * 1024 * 1024, 6)).toBeCloseTo(0.156, 6);
    });

    it("computes a small-recording realistic cost (10 MB × 1 month)", () => {
      // 10 MiB → (10 / 1024) GB × $0.026 ≈ $0.000254
      const tenMb = 10 * 1024 * 1024;
      expect(computeStorageCost(tenMb)).toBeCloseTo((10 / 1024) * 0.026, 6);
    });
  });

  describe("computeTotalCost", () => {
    it("sums realtime + writer at current rates", () => {
      // 100k realtime input × $32 + 50k realtime output × $64 = 3.2 + 3.2 = $6.40
      // 100k writer input × $3 + 100k cached × $0.30 + 10k output × $15
      //   = 0.3 + 0.03 + 0.15 = $0.48
      const realtime = { input: 100_000, output: 50_000 };
      const writer = { input: 100_000, cachedInput: 100_000, output: 10_000 };
      expect(computeTotalCost(realtime, writer)).toBeCloseTo(6.4 + 0.48, 6);
    });
  });

  describe("roundCostUsd", () => {
    it("rounds to 4 decimal places", () => {
      expect(roundCostUsd(0.123456)).toBe(0.1235);
      expect(roundCostUsd(0.123444)).toBe(0.1234);
      expect(roundCostUsd(0)).toBe(0);
      expect(roundCostUsd(1.00001)).toBe(1);
      expect(roundCostUsd(1.00005)).toBe(1.0001);
    });
  });
});
