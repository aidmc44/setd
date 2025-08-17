/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."TaskActivityType" AS ENUM ('CREATED', 'TITLE_UPDATED', 'NOTES_UPDATED', 'STATUS_CHANGED', 'COMPLETED', 'REORDERED');

-- DropTable
DROP TABLE "public"."Post";

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notesJson" JSONB NOT NULL DEFAULT '{}',
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskStatusEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "from" "public"."TaskStatus",
    "to" "public"."TaskStatus" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" "public"."TaskActivityType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FlowNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" JSONB,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "colorHex" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FlowEdge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "bendPoints" JSONB,
    "label" TEXT,

    CONSTRAINT "FlowEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_status_position_idx" ON "public"."Project"("status", "position");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "public"."Project"("createdAt");

-- CreateIndex
CREATE INDEX "Task_projectId_status_updatedAt_idx" ON "public"."Task"("projectId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "TaskStatusEvent_taskId_at_idx" ON "public"."TaskStatusEvent"("taskId", "at");

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_at_idx" ON "public"."TaskActivity"("taskId", "at");

-- CreateIndex
CREATE INDEX "FlowNode_projectId_idx" ON "public"."FlowNode"("projectId");

-- CreateIndex
CREATE INDEX "FlowEdge_projectId_idx" ON "public"."FlowEdge"("projectId");

-- CreateIndex
CREATE INDEX "FlowEdge_sourceNodeId_idx" ON "public"."FlowEdge"("sourceNodeId");

-- CreateIndex
CREATE INDEX "FlowEdge_targetNodeId_idx" ON "public"."FlowEdge"("targetNodeId");

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskStatusEvent" ADD CONSTRAINT "TaskStatusEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FlowNode" ADD CONSTRAINT "FlowNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FlowEdge" ADD CONSTRAINT "FlowEdge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FlowEdge" ADD CONSTRAINT "FlowEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "public"."FlowNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FlowEdge" ADD CONSTRAINT "FlowEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "public"."FlowNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
