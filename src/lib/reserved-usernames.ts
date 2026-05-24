// Usernames that would conflict with route names or look like service accounts.
// Compared against the user's input with .toLowerCase(), so case variants
// (Admin, ADMIN, aDmIn) are all caught.
export const RESERVED_USERNAMES = new Set<string>([
  "admin",
  "api",
  "auth",
  "dashboard",
  "backlog",
  "recommend",
  "settings",
  "onboarding",
  "steam",
  "steamloggd",
  "support",
  "help",
  "root",
  "system",
]);

export const USERNAME_FORMAT = /^[A-Za-z][A-Za-z0-9_-]{2,23}$/;

export type UsernameCheckResult =
  | { available: true }
  | { available: false; reason: "invalid" | "reserved" | "taken" };

export function validateUsernameFormat(input: string): boolean {
  return USERNAME_FORMAT.test(input);
}

export function isReservedUsername(input: string): boolean {
  return RESERVED_USERNAMES.has(input.toLowerCase());
}
