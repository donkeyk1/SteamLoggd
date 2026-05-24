-- OAuth migration: replace Steam OpenID as primary identity with
-- Auth.js (NextAuth v5) standard schema, preserving legacy User rows
-- so they can be reclaimed via Steam-link merge.
--
-- Order is load-bearing:
--   1. Add new columns + create new tables.
--   2. Backfill name/image from displayName/avatarUrl.
--   3. Insert stub Account rows so legacy users can be merged on Steam-link.
--   4. Drop old columns LAST.
--
-- See specs/oauth-migration/spec.md §6, §7.

-- ============================================================
-- Step 1: add new User columns + create Auth.js tables
-- ============================================================

-- New User columns. Old columns (steamId, displayName, avatarUrl) stay until step 4.
ALTER TABLE "User"
  ADD COLUMN "email"         TEXT,
  ADD COLUMN "emailVerified" TIMESTAMP(3),
  ADD COLUMN "username"      TEXT,
  ADD COLUMN "name"          TEXT,
  ADD COLUMN "image"         TEXT;

CREATE TABLE "Account" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "type"              TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token"     TEXT,
    "access_token"      TEXT,
    "expires_at"        INTEGER,
    "token_type"        TEXT,
    "scope"             TEXT,
    "id_token"          TEXT,
    "session_state"     TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id"           TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "expires"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expires"    TIMESTAMP(3) NOT NULL
);

-- ============================================================
-- Step 2: backfill display fields from legacy columns
-- ============================================================

UPDATE "User"
SET "name"  = "displayName",
    "image" = "avatarUrl";
-- username stays NULL on legacy rows; middleware will force them
-- through /onboarding before they reach the app.

-- ============================================================
-- Step 3: insert stub Steam Account rows for legacy users so
-- merge-user.ts can resolve them on Steam-link.
-- gen_random_uuid() is built into PG 13+; no extension needed.
-- ============================================================

INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId")
SELECT
  gen_random_uuid()::text,
  u.id,
  'openid',
  'steam',
  u."steamId"
FROM "User" u
WHERE u."steamId" IS NOT NULL;

-- ============================================================
-- Step 4: drop legacy columns and their constraints
-- ============================================================

DROP INDEX "User_steamId_key";

ALTER TABLE "User"
  DROP COLUMN "steamId",
  DROP COLUMN "displayName",
  DROP COLUMN "avatarUrl";

-- ============================================================
-- Step 5: indexes + foreign keys
-- ============================================================

CREATE INDEX        "Account_userId_idx"                       ON "Account"("userId");
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key"   ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key"                 ON "Session"("sessionToken");
CREATE UNIQUE INDEX "VerificationToken_token_key"              ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key"   ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX "User_email_key"                           ON "User"("email");
CREATE UNIQUE INDEX "User_username_key"                        ON "User"("username");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
