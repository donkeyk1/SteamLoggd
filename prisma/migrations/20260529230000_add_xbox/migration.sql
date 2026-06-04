-- AlterEnum
ALTER TYPE "GameSource" ADD VALUE 'XBOX';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "xboxTitleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Game_xboxTitleId_key" ON "Game"("xboxTitleId");
