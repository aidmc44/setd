// src/server/api/routers/projects.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { ProjectStatus } from "@prisma/client";

export const projectsRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z
        .object({
          includeArchived: z.boolean().default(false),
          q: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const includeArchived = input?.includeArchived ?? false;
      const q = input?.q?.trim();
      return ctx.db.project.findMany({
        where: {
          ...(includeArchived ? {} : { status: ProjectStatus.ACTIVE }),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [
          { pinned: "desc" },
          { position: "asc" },
          { createdAt: "desc" },
        ],
      });
    }),

  get: publicProcedure
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db.project.findUnique({ where: { id: input } }),
    ),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const maxPos =
        (await ctx.db.project.aggregate({ _max: { position: true } }))._max
          .position ?? 0;
      return ctx.db.project.create({
        data: {
          title: input.title,
          description: input.description,
          position: maxPos + 1,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.project.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description ?? null,
        },
      }),
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async (tx) => {
        const tasks = await tx.task.findMany({
          where: { projectId: input.id },
          select: { id: true },
        });
        const taskIds = tasks.map((t) => t.id);

        if (taskIds.length) {
          await tx.taskActivity.deleteMany({
            where: { taskId: { in: taskIds } },
          });
          await tx.taskStatusEvent.deleteMany({
            where: { taskId: { in: taskIds } },
          });
        }

        await tx.task.deleteMany({ where: { projectId: input.id } });
        await tx.flowEdge.deleteMany({ where: { projectId: input.id } });
        await tx.flowNode.deleteMany({ where: { projectId: input.id } });
        await tx.project.delete({ where: { id: input.id } });
      });
      return { ok: true };
    }),

  reorder: publicProcedure
    .input(z.array(z.object({ id: z.string(), position: z.number() })))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(
        input.map((p) =>
          ctx.db.project.update({
            where: { id: p.id },
            data: { position: p.position },
          }),
        ),
      );
      return { ok: true };
    }),

  setArchived: publicProcedure
    .input(z.object({ id: z.string(), archived: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.project.update({
        where: { id: input.id },
        data: {
          status: input.archived
            ? ProjectStatus.ARCHIVED
            : ProjectStatus.ACTIVE,
        },
      }),
    ),

  setPinned: publicProcedure
    .input(z.object({ id: z.string(), pinned: z.boolean() }))
    .mutation(({ ctx, input }) =>
      ctx.db.project.update({
        where: { id: input.id },
        data: {
          pinned: input.pinned,
          pinnedAt: input.pinned ? new Date() : null,
        },
      }),
    ),
});