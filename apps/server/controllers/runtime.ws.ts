import type { Elysia } from "elysia";
import { Orchestrator } from "../services/orchestrator";
import { isAuthorized } from "../services/auth";

type RuntimeMessage =
  | { type: "spawn"; projectId: string; command: string[]; files: Array<{ path: string; content: string }> }
  | { type: "stop"; processId: string };

export const runtimeWsController = (app: Elysia, orchestrator: Orchestrator) =>
  app.ws("/ws/runtime", {
    open: (ws) => {
      const url = (ws.data as any).request?.url;
      if (!isAuthorized(url)) {
        ws.send({ type: "error", error: "unauthorized" });
        ws.close();
      }
    },
    message: async (ws, message) => {
      const payload = message as RuntimeMessage;
      if (payload.type === "spawn") {
        const result = await orchestrator.spawn({
          projectId: payload.projectId,
          command: payload.command,
          files: payload.files,
          onStdout: (data) => ws.send({ type: "stdout", data }),
          onStderr: (data) => ws.send({ type: "stderr", data }),
          onExit: (code) => ws.send({ type: "exit", code }),
        });

        ws.send({ type: "spawned", processId: result.id, pid: result.pid, cwd: result.cwd });
      }

      if (payload.type === "stop") {
        await orchestrator.stop(payload.processId);
        ws.send({ type: "stopped", processId: payload.processId });
      }
    },
  });
