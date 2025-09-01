// src/server/api/routers/tasks.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { TaskStatus, TaskActivityType } from "@prisma/client";

export const tasksRouter = createTRPCRouter({
	listByProject: publicProcedure
	  .input(z.object({ projectId: z.string() }))
	  .query(({ ctx, input }) =>
	    ctx.db.task.findMany({
	      where: { projectId: input.projectId },
	      orderBy: { createdAt: "asc" },
	    }),
	  ),

  getActivities: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.taskActivity.findMany({
        where: { taskId: input.taskId },
        orderBy: { at: "asc" },
      }),
    ),

  create: publicProcedure
    .input(z.object({ projectId: z.string(), title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
        },
      });
      await ctx.db.taskActivity.create({
        data: {
          taskId: task.id,
          type: TaskActivityType.CREATED,
        },
      });
      return task;
    }),

  updateTitle: publicProcedure
    .input(z.object({ id: z.string(), title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.update({
        where: { id: input.id },
        data: { title: input.title },
      });
      await ctx.db.taskActivity.create({
        data: {
          taskId: input.id,
          type: TaskActivityType.TITLE_UPDATED,
          data: { title: input.title },
        },
      });
      return task;
    }),

  updateNotes: publicProcedure
    .input(z.object({ id: z.string(), notesJson: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.update({
        where: { id: input.id },
        data: { notesJson: input.notesJson },
      });
      await ctx.db.taskActivity.create({
        data: {
          taskId: input.id,
          type: TaskActivityType.NOTES_UPDATED,
        },
      });
      return task;
    }),

  updateStatus: publicProcedure
    .input(z.object({ id: z.string(), to: z.nativeEnum(TaskStatus) }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.task.findUniqueOrThrow({
        where: { id: input.id },
        select: { status: true },
      });
      const updated = await ctx.db.$transaction(async (tx) => {
        const t = await tx.task.update({
          where: { id: input.id },
          data: { status: input.to },
        });
        await tx.taskStatusEvent.create({
          data: { taskId: input.id, from: current.status, to: input.to },
        });
        await tx.taskActivity.create({
          data: {
            taskId: input.id,
            type:
              input.to === TaskStatus.COMPLETED
                ? TaskActivityType.COMPLETED
                : TaskActivityType.STATUS_CHANGED,
            data: { from: current.status, to: input.to },
          },
        });
        return t;
      });
      return updated;
    }),
});