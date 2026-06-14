const SIX_DIGIT_HEX = /^#?[0-9A-Fa-f]{6}$/;

export function normalizeTopBannerHex(value: string): string | null {
  const trimmed = value.trim();
  if (!SIX_DIGIT_HEX.test(trimmed)) {
    return null;
  }

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return withHash.toUpperCase();
}

export function isValidTopBannerHex(value: string): boolean {
  return normalizeTopBannerHex(value) !== null;
}
