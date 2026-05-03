import type { Elysia } from "elysia";

export const projectController = (app: Elysia) =>
  app
    .get("/projects", async () => {
      return { data: [] };
    })
    .get("/projects/:id", async ({ params }) => {
      return { data: { id: params.id } };
    })
    .post("/projects", async ({ body }) => {
      return { data: body };
    })
    .put("/projects/:id", async ({ params, body }) => {
      return { data: { id: params.id, ...body } };
    })
    .delete("/projects/:id", async ({ params }) => {
      return { data: { id: params.id, deleted: true } };
    });
