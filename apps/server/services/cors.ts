import type { Elysia } from "elysia";

const clientOrigin = () => process.env.CLIENT_ORIGIN?.trim() || "http://localhost:5173";

export const withCors = (app: Elysia) =>
  app
    .onRequest(({ request, set }) => {
      const origin = request.headers.get("origin");
      const allowed = clientOrigin();
      if (origin && origin === allowed) {
        set.headers["access-control-allow-origin"] = origin;
        set.headers["access-control-allow-credentials"] = "true";
        set.headers["vary"] = "Origin";
      }
      if (request.method === "OPTIONS") {
        set.headers["access-control-allow-methods"] = "GET,POST,PUT,DELETE,OPTIONS";
        set.headers["access-control-allow-headers"] =
          request.headers.get("access-control-request-headers") || "content-type";
        set.headers["access-control-max-age"] = "600";
        set.status = 204;
        return "";
      }
    });
