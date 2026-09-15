import type { Elysia } from "elysia";
import { asc } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";

export const sampleBuildsController = (app: Elysia) =>
  app.get("/sample-builds", async ({ set }) => {
    if (!hasDb || !db) {
      set.status = 503;
      return { error: "database not configured" };
    }
    const rows = await db
      .select({
        id: schema.sampleBuilds.id,
        slug: schema.sampleBuilds.slug,
        name: schema.sampleBuilds.name,
        description: schema.sampleBuilds.description,
        accent: schema.sampleBuilds.accent,
        prompt: schema.sampleBuilds.prompt,
        image: schema.sampleBuilds.image,
      })
      .from(schema.sampleBuilds)
      .orderBy(asc(schema.sampleBuilds.sortOrder), asc(schema.sampleBuilds.createdAt));
    return { data: rows };
  });
