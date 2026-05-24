export const PLATFORMS = [
  "PlayStation",
  "Xbox",
  "Epic Games",
  "Nintendo Switch",
  "GOG",
  "Wishlist",
  "Other",
] as const;

export type Platform = (typeof PLATFORMS)[number];
