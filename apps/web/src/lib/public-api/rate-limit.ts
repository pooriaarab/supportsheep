type Bucket = { count: number; resetAt: number };

export function createMemoryRateLimiter(input: {
  limit: number;
  windowMs: number;
}) {
  const store = new Map<string, Bucket>();

  return {
    check(key: string) {
      const now = Date.now();
      const current = store.get(key);

      if (!current || current.resetAt <= now) {
        const bucket: Bucket = { count: 1, resetAt: now + input.windowMs };
        store.set(key, bucket);
        return {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: bucket.resetAt,
        };
      }

      if (current.count >= input.limit) {
        return {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: current.resetAt,
        };
      }

      current.count += 1;
      return {
        allowed: true,
        limit: input.limit,
        remaining: Math.max(0, input.limit - current.count),
        resetAt: current.resetAt,
      };
    },
  };
}
