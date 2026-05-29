-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "themes" TEXT[] DEFAULT ARRAY[]::TEXT[];
