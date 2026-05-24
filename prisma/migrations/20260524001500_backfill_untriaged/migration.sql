-- Change the default for new rows
ALTER TABLE "UserGame" ALTER COLUMN "status" SET DEFAULT 'UNTRIAGED';

-- Backfill: every existing row was inserted by the Steam sync with the old
-- UNPLAYED default. The user hasn't classified anything yet, so move them to
-- UNTRIAGED so the UI distinguishes "you haven't decided" from "you've
-- decided you won't play this".
UPDATE "UserGame" SET "status" = 'UNTRIAGED' WHERE "status" = 'UNPLAYED';
