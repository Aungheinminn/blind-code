import { turnBus } from "../services/turnBus";
import { createAgentSession, ensureProject } from "../db/repo";

const project = await ensureProject("attach-verify");
if (!project) throw new Error("no db");
const sessionId = await createAgentSession(project.id, "test/attach");
if (!sessionId) throw new Error("no session");

const turnId = await turnBus.createTurn(sessionId, project.id);
if (!turnId) throw new Error("no turn");

await turnBus.emit(turnId, { type: "started", provider: "test", sessionId, turnId });
await turnBus.emit(turnId, { type: "text-delta", text: "Hello from " });
await turnBus.emit(turnId, { type: "text-delta", text: "the past." });
await turnBus.emit(turnId, { type: "finish", finishReason: "stop" });
await turnBus.finishTurn(turnId, "done");

console.log(`seeded turn ${turnId} with 4 events, status=done`);

const ws = new WebSocket("ws://localhost:3001/ws/agent");
const received: any[] = [];

ws.addEventListener("message", (ev) => {
  const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
  received.push(data);
});

await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));

console.log("\n--- attach from ordinal=-1 (should replay all + turn-terminal) ---");
ws.send(JSON.stringify({ type: "attach", turnId, lastOrdinal: -1 }));
await new Promise((r) => setTimeout(r, 400));
for (const e of received) {
  console.log(" ", e.ordinal ?? "-", e.type, e.type === "text-delta" ? `"${e.text}"` : "");
}

received.length = 0;

console.log("\n--- attach from ordinal=1 (should skip 0 and 1, only replay 2, 3 + turn-terminal) ---");
ws.send(JSON.stringify({ type: "attach", turnId, lastOrdinal: 1 }));
await new Promise((r) => setTimeout(r, 400));
for (const e of received) {
  console.log(" ", e.ordinal ?? "-", e.type, e.type === "text-delta" ? `"${e.text}"` : "");
}

ws.close();

// live in-process fanout is exercised by the real WS controller during runAgent;
// can't be tested cross-process from this script (pub/sub is process-local).

process.exit(0);
