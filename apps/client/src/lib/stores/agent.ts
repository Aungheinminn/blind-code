import { writable, get } from "svelte/store";
import { enabledModels, loadConnect, providersState } from "./connect";
import { getWsTicket } from "$lib/api/auth";

export type AgentMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  reasoning?: string;
  toolCalls?: Array<{ id: string; name: string; input: unknown; output?: unknown }>;
  timestamp: Date;
};

export type ProviderInfo = {
  name: string;
  defaultModel: string;
  configured: boolean;
  source?: "file" | "env" | null;
  last4?: string | null;
};

export type PlanTodo = {
  id: string;
  title: string;
  rationale: string;
};

export type Plan = {
  summary: string;
  todos: PlanTodo[];
};

export type TodoStatus = "pending" | "active" | "done" | "skipped";

const SERVER_WS = import.meta.env.VITE_SERVER_WS ?? "ws://localhost:3001";
const agentWsUrl = () => `${SERVER_WS}/ws/agent`;

export const messages = writable<AgentMessage[]>([
  {
    id: "welcome",
    role: "agent",
    content:
      "Hi. Pick a provider on the right, describe what you want to build, and I'll write the files into your sandbox.",
    timestamp: new Date(),
  },
]);

export const isRunning = writable(false);
export const providers = writable<ProviderInfo[]>([]);
export const selectedProvider = writable<string>("anthropic");
export const selectedModel = writable<string>("");

export type PreviewState =
  | { state: "idle" }
  | { state: "installing" }
  | { state: "starting"; port: number }
  | { state: "ready"; url: string }
  | { state: "none"; reason: string }
  | { state: "error"; error: string };

export const previewState = writable<PreviewState>({ state: "idle" });

export const activePlan = writable<Plan | null>(null);
export const todoStatuses = writable<Record<string, TodoStatus>>({});
export const planError = writable<string | null>(null);

const resetPlan = () => {
  activePlan.set(null);
  todoStatuses.set({});
  planError.set(null);
};

const WELCOME_MESSAGE: AgentMessage = {
  id: "welcome",
  role: "agent",
  content:
    "Hi. Pick a provider on the right, describe what you want to build, and I'll write the files into your sandbox.",
  timestamp: new Date(),
};

export const resetWorkspace = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify({ type: "cancel" }));
    } catch {}
  }
  messages.set([{ ...WELCOME_MESSAGE, timestamp: new Date() }]);
  isRunning.set(false);
  resetPlan();
  previewState.set({ state: "idle" });
  currentAgentMessageId = null;
  activeTurnId = null;
  activeProjectId = null;
  lastOrdinal = -1;
};

export const loadProviders = async () => {
  await loadConnect();
  const list = get(providersState);
  providers.set(list);
  const configured = list.find((p) => p.configured);
  if (configured) {
    selectedProvider.set(configured.name);
    const enabled = get(enabledModels)[configured.name] ?? [];
    if (enabled.length > 0 && !get(selectedModel)) {
      selectedModel.set(enabled[0]);
    }
  }
};

let socket: WebSocket | null = null;
let currentAgentMessageId: string | null = null;
let activeTurnId: string | null = null;
let activeProjectId: string | null = null;
let lastOrdinal = -1;

const turnStorageKey = (projectId: string) => `vibe-agent-turn:${projectId}`;

const saveTurn = (projectId: string, turnId: string, ordinal: number) => {
  try {
    localStorage.setItem(turnStorageKey(projectId), JSON.stringify({ turnId, ordinal }));
  } catch {}
};

const readSavedTurn = (
  projectId: string,
): { turnId: string; ordinal: number } | null => {
  try {
    const raw = localStorage.getItem(turnStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.turnId === "string" && typeof parsed?.ordinal === "number") {
      return { turnId: parsed.turnId, ordinal: parsed.ordinal };
    }
  } catch {}
  return null;
};

const clearSavedTurn = (projectId: string | null) => {
  if (!projectId) return;
  try {
    localStorage.removeItem(turnStorageKey(projectId));
  } catch {}
};

const ensureSocket = async (): Promise<WebSocket> => {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;
  if (socket) socket.close();

  let url = agentWsUrl();
  try {
    const { ticket } = await getWsTicket();
    url = `${url}?ticket=${encodeURIComponent(ticket)}`;
  } catch {}

  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url);
    socket = ws;

    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => reject(e));
    ws.addEventListener("message", (ev) => handleEvent(ev.data));
    ws.addEventListener("close", () => {
      isRunning.set(false);
      currentAgentMessageId = null;
    });
  });
};

const startAgentMessage = () => {
  const id = crypto.randomUUID();
  currentAgentMessageId = id;
  messages.update((list) => [
    ...list,
    { id, role: "agent", content: "", toolCalls: [], timestamp: new Date() },
  ]);
};

const appendText = (delta: string) => {
  if (!currentAgentMessageId) startAgentMessage();
  const id = currentAgentMessageId!;
  messages.update((list) =>
    list.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
  );
};

const appendReasoning = (delta: string) => {
  if (!currentAgentMessageId) startAgentMessage();
  const id = currentAgentMessageId!;
  messages.update((list) =>
    list.map((m) =>
      m.id === id ? { ...m, reasoning: (m.reasoning ?? "") + delta } : m,
    ),
  );
};

const recordToolCall = (call: { id: string; name: string; input: unknown }) => {
  if (!currentAgentMessageId) startAgentMessage();
  const id = currentAgentMessageId!;
  messages.update((list) =>
    list.map((m) =>
      m.id === id ? { ...m, toolCalls: [...(m.toolCalls ?? []), call] } : m,
    ),
  );
};

const recordToolResult = (toolCallId: string, output: unknown) => {
  if (!currentAgentMessageId) return;
  const id = currentAgentMessageId;
  messages.update((list) =>
    list.map((m) =>
      m.id === id
        ? {
            ...m,
            toolCalls: (m.toolCalls ?? []).map((c) =>
              c.id === toolCallId ? { ...c, output } : c,
            ),
          }
        : m,
    ),
  );
};

const handleEvent = (raw: unknown) => {
  let event: any;
  try {
    event = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return;
  }

  if (typeof event.ordinal === "number" && event.ordinal > lastOrdinal) {
    lastOrdinal = event.ordinal;
    if (activeProjectId && activeTurnId) {
      saveTurn(activeProjectId, activeTurnId, lastOrdinal);
    }
  }

  switch (event.type) {
    case "started":
      if (typeof event.turnId === "string") {
        activeTurnId = event.turnId;
        lastOrdinal = -1;
        if (activeProjectId) saveTurn(activeProjectId, event.turnId, -1);
      }
      resetPlan();
      startAgentMessage();
      break;
    case "plan":
      if (event.plan) {
        activePlan.set(event.plan as Plan);
        const initial: Record<string, TodoStatus> = {};
        for (const t of (event.plan as Plan).todos) initial[t.id] = "pending";
        todoStatuses.set(initial);
      }
      break;
    case "plan-error":
      planError.set(typeof event.error === "string" ? event.error : "planner failed");
      break;
    case "text-delta":
      appendText(event.text ?? "");
      break;
    case "reasoning-delta":
      appendReasoning(event.text ?? "");
      break;
    case "tool-call":
      if (event.toolName === "update_todo" && event.input) {
        const { id, status } = event.input as { id?: string; status?: TodoStatus };
        if (id && status) {
          todoStatuses.update((m) => ({ ...m, [id]: status }));
        }
      }
      recordToolCall({ id: event.toolCallId, name: event.toolName, input: event.input });
      break;
    case "tool-result":
      recordToolResult(event.toolCallId, event.output);
      break;
    case "error":
      appendText(`\n\n_Error: ${event.error}_`);
      break;
    case "preview":
      if (event.status) previewState.set(event.status);
      break;
    case "turn-terminal":
      appendText(`\n\n_Turn already ended: ${event.status}${event.lastError ? " — " + event.lastError : ""}_`);
      isRunning.set(false);
      currentAgentMessageId = null;
      clearSavedTurn(activeProjectId);
      activeTurnId = null;
      lastOrdinal = -1;
      break;
    case "done":
      isRunning.set(false);
      currentAgentMessageId = null;
      clearSavedTurn(activeProjectId);
      activeTurnId = null;
      lastOrdinal = -1;
      break;
  }
};

export const restartPreview = (projectId: string) => {
  previewState.set({ state: "starting", port: 0 });
  const send = () => {
    socket?.send(JSON.stringify({ type: "restart-preview", projectId }));
  };
  if (socket && socket.readyState === WebSocket.OPEN) send();
  else ensureSocket().then(send).catch(() => {});
};

export const sendPrompt = async (
  projectId: string,
  prompt: string,
): Promise<void> => {
  if (!prompt.trim() || get(isRunning)) return;

  activeProjectId = projectId;

  messages.update((list) => [
    ...list,
    {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim(),
      timestamp: new Date(),
    },
  ]);
  isRunning.set(true);

  const history = get(messages)
    .filter((m) => m.id !== "welcome")
    .slice(0, -1)
    .map((m) => ({
      role: m.role === "agent" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }))
    .filter((m) => m.content.trim().length > 0);

  try {
    const ws = await ensureSocket();
    ws.send(
      JSON.stringify({
        type: "run",
        provider: get(selectedProvider),
        model: get(selectedModel) || undefined,
        projectId,
        prompt: prompt.trim(),
        history,
        usePlan: true,
      }),
    );
  } catch (e) {
    isRunning.set(false);
    appendText(`\n\n_Failed to reach agent server: ${String(e)}_`);
  }
};

export const cancelAgent = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "cancel" }));
  }
  isRunning.set(false);
  clearSavedTurn(activeProjectId);
  activeTurnId = null;
  lastOrdinal = -1;
  resetPlan();
};

export const resumeTurn = async (projectId: string): Promise<void> => {
  activeProjectId = projectId;
  const saved = readSavedTurn(projectId);
  if (!saved) return;

  activeTurnId = saved.turnId;
  lastOrdinal = saved.ordinal;
  isRunning.set(true);

  try {
    const ws = await ensureSocket();
    ws.send(
      JSON.stringify({
        type: "attach",
        turnId: saved.turnId,
        lastOrdinal: saved.ordinal,
      }),
    );
  } catch {
    isRunning.set(false);
    clearSavedTurn(projectId);
    activeTurnId = null;
    lastOrdinal = -1;
  }
};
