// src/server/api/routers/flow.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

function getStableColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h}deg 60% 55%)`;
}

export const flowRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [nodes, edges] = await Promise.all([
        ctx.db.flowNode.findMany({ where: { projectId: input.projectId } }),
        ctx.db.flowEdge.findMany({ where: { projectId: input.projectId } }),
      ]);
      return { nodes, edges };
    }),

  addNode: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        subtitle: z.string().optional(),
        description: z.any().optional(),
        x: z.number().default(0),
        y: z.number().default(0),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.flowNode.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          subtitle: input.subtitle,
          description: input.description ?? null,
          x: input.x,
          y: input.y,
          colorHex: getStableColor(input.title),
        },
      }),
    ),

  quickAddNextTo: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        existingNodeId: z.string(),
        title: z.string().min(1),
        subtitle: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const base = await ctx.db.flowNode.findUniqueOrThrow({
        where: { id: input.existingNodeId },
      });
      const newNode = await ctx.db.flowNode.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          subtitle: input.subtitle,
          x: base.x + 320,
          y: base.y,
          colorHex: getStableColor(input.title),
        },
      });
      await ctx.db.flowEdge.create({
        data: {
          projectId: input.projectId,
          sourceNodeId: base.id,
          targetNodeId: newNode.id,
        },
      });
      return newNode;
    }),

  updateNode: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        subtitle: z.string().optional().nullable(),
        description: z.any().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        colorHex: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.flowNode.update({
        where: { id: input.id },
        data: {
          title: input.title,
          subtitle: input.subtitle ?? undefined,
          description: input.description ?? undefined,
          x: input.x,
          y: input.y,
          colorHex: input.colorHex,
        },
      }),
    ),

  deleteNode: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction([
        ctx.db.flowEdge.deleteMany({
          where: { OR: [{ sourceNodeId: input.id }, { targetNodeId: input.id }] },
        }),
        ctx.db.flowNode.delete({ where: { id: input.id } }),
      ]);
      return { ok: true };
    }),

  connect: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        sourceNodeId: z.string(),
        targetNodeId: z.string(),
        bendPoints: z
          .array(z.object({ x: z.number(), y: z.number() }))
          .optional(),
        label: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.flowEdge.create({
        data: {
          projectId: input.projectId,
          sourceNodeId: input.sourceNodeId,
          targetNodeId: input.targetNodeId,
          bendPoints: input.bendPoints ?? undefined,
          label: input.label,
        },
      }),
    ),

  updateEdge: publicProcedure
    .input(
      z.object({
        id: z.string(),
        bendPoints: z
          .array(z.object({ x: z.number(), y: z.number() }))
          .optional(),
        label: z.string().optional().nullable(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.flowEdge.update({
        where: { id: input.id },
        data: {
          bendPoints: input.bendPoints ?? undefined,
          label: input.label ?? undefined,
        },
      }),
    ),

  deleteEdge: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.flowEdge.delete({ where: { id: input.id } })),
});