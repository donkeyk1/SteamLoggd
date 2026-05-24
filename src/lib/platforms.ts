export const PLATFORMS = [
  "PlayStation",
  "Xbox",
  "Epic Games",
  "Nintendo Switch",
  "GOG",
  "Other",
] as const;

export type Platform = (typeof PLATFORMS)[number];
