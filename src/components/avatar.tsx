"use client";

import { useState } from "react";

type Props = {
  /** Steam profile avatar — first preference when present. */
  steamImage?: string | null;
  /** OAuth provider avatar — falls back to this if Steam image missing or fails to load. */
  image?: string | null;
  /** Used to derive the initial-letter placeholder when no image loads. */
  name?: string | null;
  className?: string;
  alt?: string;
};

/**
 * Renders the user's avatar with a Steam → OAuth → initial-letter
 * fallback chain. If an image URL returns an error (e.g. Google's
 * lh3.googleusercontent.com 429s), we walk to the next source on
 * the next render.
 */
export function Avatar({
  steamImage,
  image,
  name,
  className = "w-10 h-10 rounded-full ring-2 ring-violet-500/30",
  alt = "",
}: Props) {
  const sources = [steamImage, image].filter(
    (u): u is string => typeof u === "string" && u.length > 0
  );
  const [failedIndex, setFailedIndex] = useState(-1);
  const currentSrc = sources[failedIndex + 1];

  if (!currentSrc) {
    return <InitialPlaceholder name={name} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={currentSrc}
      src={currentSrc}
      alt={alt}
      className={`${className} object-cover`}
      onError={() => setFailedIndex((i) => i + 1)}
    />
  );
}

function InitialPlaceholder({
  name,
  className,
}: {
  name?: string | null;
  className: string;
}) {
  const initial = (name?.trim()[0] ?? "?").toUpperCase();
  // Pick a stable color from the name so the placeholder is consistent
  // across renders for the same user.
  const hue = name ? hashHue(name) : 240;
  const bg = `hsl(${hue}, 70%, 35%)`;

  return (
    <div
      className={`${className} flex items-center justify-center text-white font-semibold select-none`}
      style={{ backgroundColor: bg }}
      aria-label={name ?? "User avatar"}
    >
      {initial}
    </div>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h) % 360;
}
