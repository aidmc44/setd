// src/server/api/trpc.ts
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { db } from "../db";

export const createTRPCContext = () => ({ db });

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;