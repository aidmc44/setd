// src/server/api/root.ts
import { createTRPCRouter } from "./trpc";
import { projectsRouter } from "./routers/projects";
import { tasksRouter } from "./routers/tasks";
import { flowRouter } from "./routers/flow";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  tasks: tasksRouter,
  flow: flowRouter,
});

export type AppRouter = typeof appRouter;