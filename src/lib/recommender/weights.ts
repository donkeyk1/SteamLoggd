export const WEIGHTS = {
  priority: 0.30,
  timeFit: 0.20,
  moodMatch: 0.20,
  recency: 0.10,
  genreAffinity: 0.15, // based on your ratings of previously-beat games
  pausedPenalty: 0.15,
};

export const MOODS = [
  "chill",
  "intense",
  "story",
  "multiplayer",
  "short-session",
] as const;

export type Mood = (typeof MOODS)[number];

// IGDB genre names (exact strings returned by the API)
export const MOOD_GENRES: Record<Mood, string[]> = {
  chill: ["Indie", "Puzzle", "Adventure", "Simulator", "Strategy", "Platform", "Music"],
  intense: ["Shooter", "Fighting", "Racing", "Hack and slash/Beat 'em up", "Arcade"],
  story: ["Role-playing (RPG)", "Adventure", "Visual Novel", "Point-and-click"],
  multiplayer: ["Sport", "Strategy", "Shooter", "Fighting", "Racing", "Card & Board Game"],
  "short-session": [], // handled via timeFit weight boost
};
