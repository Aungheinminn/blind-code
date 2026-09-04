import { turnBus } from "../services/turnBus";
import { createAgentSession, ensureProject } from "../db/repo";
import { ensureVerifyUser } from "./_verify-user";

const ownerId = await ensureVerifyUser();
const project = await ensureProject("turn-bus-verify", ownerId);
if (!project) throw new Error("no db");
const sessionId = await createAgentSession(project.id, "test/verify");
if (!sessionId) throw new Error("no session");

const turnId = await turnBus.createTurn(sessionId, project.id);
if (!turnId) throw new Error("no turn");
console.log("created turnId:", turnId);

const received: Array<{ ordinal: number; payload: unknown }> = [];
const unsub = turnBus.subscribe(turnId, (rec) => received.push(rec));

const emittedOrdinals: (number | null)[] = [];
emittedOrdinals.push(await turnBus.emit(turnId, { type: "text-delta", text: "hello " }));
emittedOrdinals.push(await turnBus.emit(turnId, { type: "text-delta", text: "world" }));
emittedOrdinals.push(await turnBus.emit(turnId, { type: "tool-call", toolName: "read_file" }));

console.log("emitted ordinals:", emittedOrdinals);
console.log("live subscriber received:", received.map((r) => r.ordinal));
console.log("live fanout matches emit:", JSON.stringify(received.map((r) => r.ordinal)) === JSON.stringify(emittedOrdinals));

unsub();

console.log("\nreplay from -1 (should see all 3):");
for (const r of await turnBus.getEventsSince(turnId, -1)) {
  console.log(" ", r.ordinal, r.payload);
}

console.log("\nreplay from 0 (should see 1 and 2):");
for (const r of await turnBus.getEventsSince(turnId, 0)) {
  console.log(" ", r.ordinal, (r.payload as any).type);
}

await turnBus.finishTurn(turnId, "done");
const finalTurn = await turnBus.getTurn(turnId);
console.log("\nfinal turn status:", finalTurn?.status, "endedAt set:", Boolean(finalTurn?.endedAt));

console.log("\n--- sweep test ---");
const orphan = await turnBus.createTurn(sessionId, project.id);
if (!orphan) throw new Error("no orphan");
console.log("created orphan running turn:", orphan);
const swept = await turnBus.sweepOrphanedRunning(0);
console.log("sweep marked count:", swept);
const orphanNow = await turnBus.getTurn(orphan);
console.log("orphan status:", orphanNow?.status, "lastError:", orphanNow?.lastError);

process.exit(0);
