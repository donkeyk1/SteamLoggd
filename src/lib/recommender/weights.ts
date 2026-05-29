// "Quality" weights — how good a pick is *before* the vibe/genre lenses are
// applied. These sum to 1.0; pausedPenalty subtracts on top. priority is
// deliberately low — it's a hint, not a command.
export const WEIGHTS = {
  priority: 0.12, // a hint, not a command
  lengthFit: 0.24, // how well the game's total length matches the desired commitment
  sessionFit: 0.10, // soft bonus for fitting today's session (never penalises)
  genreAffinity: 0.24, // taste from your ratings + playtime on games you've engaged with
  currentContext: 0.18, // overlap with the genres of what you're currently playing
  recency: 0.12,
  pausedPenalty: 0.15,
};

// Vibe and genre are NOT summed terms — each is a multiplicative GATE applied to
// the quality score (see scoreGames). A game that doesn't fit keeps only
// GATE_FLOOR of its quality, so a horror game can't win a "chill" request no
// matter how high its priority or length-fit.
export const GATE_FLOOR = 0.2;

/* ============ Vibe (tone) ============ */

export const VIBES = ["chill", "intense", "story", "dark", "happy"] as const;
export type Vibe = (typeof VIBES)[number];

// Vibe = tone, scored over a game's combined IGDB genres + themes. `include`
// tags lift the fit; an `exclude` tag is a hard tonal conflict that disqualifies
// the game from that vibe (this is what keeps Resident Evil out of "chill").
export const VIBE_TAGS: Record<Vibe, { include: string[]; exclude: string[] }> = {
  chill: {
    include: ["Puzzle", "Simulator", "Indie", "Point-and-click", "Music", "Card & Board Game", "Sandbox", "Kids", "Party"],
    exclude: ["Horror", "Survival", "Thriller", "Warfare"],
  },
  intense: {
    include: ["Shooter", "Fighting", "Hack and slash/Beat 'em up", "Racing", "Arcade", "Action", "Warfare", "Survival"],
    exclude: [],
  },
  story: {
    include: ["Role-playing (RPG)", "Visual Novel", "Adventure", "Point-and-click", "Drama", "Mystery", "Romance", "Historical"],
    exclude: [],
  },
  dark: {
    include: ["Horror", "Thriller", "Survival", "Mystery", "Stealth"],
    exclude: ["Comedy", "Party", "Kids"],
  },
  happy: {
    include: ["Comedy", "Party", "Kids", "Music", "Sport", "Card & Board Game"],
    exclude: ["Horror", "Thriller", "Survival", "Drama"],
  },
};

/* ============ Genre (mechanics) ============ */

export const GENRES = [
  "rpg",
  "shooter",
  "action-adventure",
  "strategy",
  "platformer",
  "racing",
  "simulation",
  "horror",
] as const;
export type Genre = (typeof GENRES)[number];

// Genre = mechanics, scored over a game's IGDB genres (Horror is theme-backed).
export const GENRE_TAGS: Record<Genre, string[]> = {
  rpg: ["Role-playing (RPG)"],
  shooter: ["Shooter"],
  "action-adventure": ["Adventure", "Hack and slash/Beat 'em up"],
  strategy: ["Strategy", "Real Time Strategy (RTS)", "Turn-based strategy (TBS)", "Tactical", "MOBA", "4X (explore, expand, exploit, and exterminate)"],
  platformer: ["Platform"],
  racing: ["Racing", "Sport"],
  simulation: ["Simulator"],
  horror: ["Horror"], // IGDB theme, not a genre
};

/* ============ Session / length ============ */

// Desired total game length the user wants to commit to — distinct from how
// much time they have for today's session.
export const GAME_LENGTHS = ["quick", "medium", "long", "any"] as const;
export type GameLength = (typeof GAME_LENGTHS)[number];
