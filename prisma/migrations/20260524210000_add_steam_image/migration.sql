-- Add steamImage to User. Avatar render priority will be:
--   steamImage > image (OAuth) > initial-letter placeholder
--
-- Populated by the Steam link callback when the Steam profile fetch
-- succeeds; cleared by the Steam unlink route.
--
-- Existing users with linked Steam have steamImage = NULL until they
-- unlink and re-link, which is fine because the Avatar component
-- gracefully falls back to `image`.
ALTER TABLE "User" ADD COLUMN "steamImage" TEXT;
