-- CreateEnum
CREATE TYPE "GameSource" AS ENUM ('STEAM', 'MANUAL');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('UNPLAYED', 'PLAYING', 'PAUSED', 'BEAT', 'DROPPED');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "steamId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "igdbId" INTEGER,
    "steamAppId" INTEGER,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "releaseYear" INTEGER,
    "hltbMainHours" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGame" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "source" "GameSource" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'UNPLAYED',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "mood" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "steamPlaytimeMinutes" INTEGER,
    "manualPlaytimeMinutes" INTEGER,
    "rating" INTEGER,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "lastPlayedAt" TIMESTAMP(3),

    CONSTRAINT "UserGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_igdbId_key" ON "Game"("igdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_steamAppId_key" ON "Game"("steamAppId");

-- CreateIndex
CREATE INDEX "Game_title_idx" ON "Game"("title");

-- CreateIndex
CREATE INDEX "UserGame_userId_status_idx" ON "UserGame"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserGame_userId_gameId_key" ON "UserGame"("userId", "gameId");

-- CreateIndex
CREATE INDEX "SyncJob_userId_startedAt_idx" ON "SyncJob"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGame" ADD CONSTRAINT "UserGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
