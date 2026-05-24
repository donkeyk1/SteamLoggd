-- AlterEnum
-- (Postgres won't let us USE this new value in the same migration transaction,
--  so the default change + backfill live in the next migration.)
ALTER TYPE "GameStatus" ADD VALUE 'UNTRIAGED';
