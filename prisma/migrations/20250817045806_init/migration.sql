-- DropIndex
DROP INDEX "public"."Project_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Project_status_position_idx";

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Project_status_pinned_position_createdAt_idx" ON "public"."Project"("status", "pinned", "position", "createdAt");
