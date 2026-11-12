import { Elysia } from "elysia";
import { Orchestrator } from "./services/orchestrator";
import { runtimeWsController } from "./controllers/runtime.ws";
import { projectController } from "./controllers/project.controller";
import { agentController } from "./controllers/agent.ws";
import { authController } from "./controllers/auth.controller";
import { connectController } from "./controllers/connect.controller";
import { accountController } from "./controllers/account.controller";
import { creditsController } from "./controllers/credits.controller";
import { sampleBuildsController } from "./controllers/sampleBuilds.controller";
import { designTemplatesController } from "./controllers/designTemplates.controller";
import { designAgentController } from "./controllers/designAgent.ws";
import { shareController } from "./controllers/share.controller";
import { withCors } from "./services/cors";

export const createApp = () => {
  const app = new Elysia();
  const orchestrator = new Orchestrator();

  app.onError(({ error, code, set }) => {
    if (code === "VALIDATION") return;
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "not found" };
    }
    if (set.status == null || set.status === 200) set.status = 500;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] ${code} ${set.status}: ${message}`);
    return { error: message };
  });

  withCors(app);
  authController(app);
  projectController(app);
  sampleBuildsController(app);
  designTemplatesController(app);
  runtimeWsController(app, orchestrator);
  agentController(app);
  designAgentController(app);
  connectController(app);
  accountController(app);
  creditsController(app);
  shareController(app);

  app.get("/health", () => ({ status: "ok" }));

  return app;
};
