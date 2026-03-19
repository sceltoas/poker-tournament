-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "chipDenominations" JSONB;

-- AlterTable
ALTER TABLE "TournamentPlayer" ADD COLUMN     "chipStack" INTEGER;
