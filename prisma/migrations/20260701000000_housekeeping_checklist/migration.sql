-- AlterTable
ALTER TABLE "Room" ADD COLUMN "housekeepingChecklist" JSONB;

-- AlterTable
ALTER TABLE "HousekeepingTask" ADD COLUMN "checklistState" JSONB;
