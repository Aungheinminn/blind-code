import { Elysia } from "elysia";
import { Orchestrator } from "./services/orchestrator";
import { runtimeWsController } from "./controllers/runtime.ws";
import { projectController } from "./controllers/project.controller";

const app = new Elysia();
const orchestrator = new Orchestrator();

projectController(app);
runtimeWsController(app, orchestrator);

app.get("/health", () => ({ status: "ok" }));

app.listen(3001);

console.log("Server listening on http://localhost:3001");
