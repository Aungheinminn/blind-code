import { writable, derived, get } from "svelte/store";
import { assembleReactProject } from "$lib/preview/reactAssembler";
import { enabledModels, loadConnect, providersState } from "./connect";
import { getWsTicket } from "$lib/api/auth";
import {
  getProjectFiles,
  getProjectHistory,
  type PublicSupabaseIntegration,
} from "$lib/api/projects";

export type ToolPart = {
  kind: "tool";
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
};

export type ChipTone = "planner" | "coder" | "router" | "error";

export type MessagePart =
  | { kind: "text"; id?: string; text: string }
  | { kind: "reasoning"; id?: string; text: string }
  | { kind: "chip"; label: string; tone: ChipTone }
  | ToolPart;

export type AgentMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  parts?: MessagePart[];
  timestamp: Date;
  interrupted?: boolean;
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

const PROVIDER_KEY = "vibe-selected-provider";
const MODEL_KEY = "vibe-selected-model";

const readStored = (key: string, fallback: string): string => {
  if (typeof localStorage === "undefined") return fallback;
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const writeStored = (key: string, value: string) => {
  if (typeof localStorage === "undefined") return;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
};

export const selectedProvider = writable<string>(readStored(PROVIDER_KEY, "anthropic"));
export const selectedModel = writable<string>(readStored(MODEL_KEY, ""));

selectedProvider.subscribe((v) => writeStored(PROVIDER_KEY, v));
selectedModel.subscribe((v) => writeStored(MODEL_KEY, v));

export const projectFiles = writable<Record<string, string>>({});
export const projectIntegration = writable<PublicSupabaseIntegration | null>(null);

export const assembledFiles = derived(
  [projectFiles, projectIntegration],
  ([$files, $integration]) =>
    Object.keys($files).length === 0
      ? {}
      : assembleReactProject($files, {
          supabase: $integration
            ? { url: $integration.url, anonKey: $integration.anonKey }
            : null,
        }),
);

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

export const loadProjectFiles = async (projectId: string): Promise<void> => {
  try {
    const files = await getProjectFiles(projectId);
    projectFiles.set(files ?? {});
  } catch (e) {
    console.warn("Failed to load project files", e);
    projectFiles.set({});
  }
};

export const loadHistory = async (projectId: string): Promise<void> => {
  try {
    const history = await getProjectHistory(projectId);
    if (!history || history.length === 0) return;
    messages.set(
      history.map((m) => {
        const parts: MessagePart[] =
          m.parts?.map((p) =>
            p.kind === "tool"
              ? { kind: "tool", id: p.id, name: p.name, input: p.input, output: p.output }
              : { kind: p.kind, text: p.text },
          ) ?? (m.content ? [{ kind: "text", text: m.content }] : []);
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          parts: m.role === "agent" ? parts : undefined,
          timestamp: new Date(m.timestamp),
          ...(m.interrupted ? { interrupted: true } : {}),
        };
      }),
    );
  } catch (e) {
    console.warn("Failed to load history", e);
  }
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
  projectFiles.set({});
  projectIntegration.set(null);
  currentAgentMessageId = null;
  activeTurnId = null;
  activeProjectId = null;
  lastOrdinal = -1;
};

export const loadProviders = async () => {
  await loadConnect();
  const list = get(providersState);
  providers.set(list);

  const stored = get(selectedProvider);
  const configuredMatch = list.find((p) => p.name === stored && p.configured);
  const fallback = list.find((p) => p.configured);
  const active = configuredMatch ?? fallback;
  if (active) {
    if (active.name !== stored) selectedProvider.set(active.name);
    const enabled = get(enabledModels)[active.name] ?? [];
    const currentModel = get(selectedModel);
    if (enabled.length > 0 && !enabled.includes(currentModel)) {
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
    { id, role: "agent", content: "", parts: [], timestamp: new Date() },
  ]);
};

const updateAgentMessage = (mutate: (m: AgentMessage) => AgentMessage) => {
  if (!currentAgentMessageId) startAgentMessage();
  const id = currentAgentMessageId!;
  messages.update((list) => list.map((m) => (m.id === id ? mutate(m) : m)));
};

const mergeStreamPart = (
  parts: MessagePart[],
  kind: "text" | "reasoning",
  id: string | undefined,
  delta: string,
): MessagePart[] => {
  if (id) {
    const existingIdx = parts.findIndex((p) => p.kind === kind && p.id === id);
    if (existingIdx >= 0) {
      const existing = parts[existingIdx] as { kind: typeof kind; id?: string; text: string };
      const updated: MessagePart = { kind, id, text: existing.text + delta };
      return [...parts.slice(0, existingIdx), updated, ...parts.slice(existingIdx + 1)];
    }
    return [...parts, { kind, id, text: delta }];
  }
  const last = parts[parts.length - 1];
  if (last && last.kind === kind && !last.id) {
    return [...parts.slice(0, -1), { kind, text: last.text + delta }];
  }
  return [...parts, { kind, text: delta }];
};

const startStreamPart = (
  parts: MessagePart[],
  kind: "text" | "reasoning",
  id: string,
): MessagePart[] => {
  if (parts.some((p) => p.kind === kind && p.id === id)) return parts;
  return [...parts, { kind, id, text: "" }];
};

const appendText = (id: string | undefined, delta: string) => {
  updateAgentMessage((m) => ({
    ...m,
    content: m.content + delta,
    parts: mergeStreamPart(m.parts ?? [], "text", id, delta),
  }));
};

const appendReasoning = (id: string | undefined, delta: string) => {
  updateAgentMessage((m) => ({
    ...m,
    parts: mergeStreamPart(m.parts ?? [], "reasoning", id, delta),
  }));
};

const startTextPart = (id: string) => {
  updateAgentMessage((m) => ({
    ...m,
    parts: startStreamPart(m.parts ?? [], "text", id),
  }));
};

const startReasoningPart = (id: string) => {
  updateAgentMessage((m) => ({
    ...m,
    parts: startStreamPart(m.parts ?? [], "reasoning", id),
  }));
};

const appendChip = (label: string, tone: ChipTone) => {
  updateAgentMessage((m) => {
    const parts = m.parts ?? [];
    const last = parts[parts.length - 1];
    if (last && last.kind === "chip" && last.label === label && last.tone === tone) return m;
    return { ...m, parts: [...parts, { kind: "chip", label, tone }] };
  });
};

const recordToolCall = (call: { id: string; name: string; input: unknown }) => {
  updateAgentMessage((m) => ({
    ...m,
    parts: [...(m.parts ?? []), { kind: "tool", ...call }],
  }));
};

const recordToolResult = (toolCallId: string, output: unknown) => {
  if (!currentAgentMessageId) return;
  updateAgentMessage((m) => ({
    ...m,
    parts: (m.parts ?? []).map((p) =>
      p.kind === "tool" && p.id === toolCallId ? { ...p, output } : p,
    ),
  }));
};

const handleEvent = (raw: unknown) => {
  let event: any;
  try {
    event = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return;
  }

  if (
    event.type !== "started" &&
    typeof event.turnId === "string" &&
    event.turnId !== activeTurnId
  ) {
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
    case "router-decision": {
      const label =
        event.tool === "plan_task"
          ? "Planning"
          : event.tool === "code_task"
          ? "Coding"
          : event.tool === "answer_question"
          ? "Answering"
          : "Routing";
      const tone: ChipTone =
        event.tool === "plan_task"
          ? "planner"
          : event.tool === "code_task"
          ? "coder"
          : "router";
      appendChip(label, tone);
      break;
    }
    case "router-answer":
      if (typeof event.text === "string" && event.text.length > 0) {
        appendText(undefined, event.text);
      }
      break;
    case "router-error":
      appendChip(
        typeof event.error === "string" ? `Router error: ${event.error}` : "Router error",
        "error",
      );
      break;
    case "text-start":
      if (typeof event.id === "string") startTextPart(event.id);
      break;
    case "text-delta":
      appendText(typeof event.id === "string" ? event.id : undefined, event.text ?? "");
      break;
    case "text-end":
      break;
    case "reasoning-start":
      if (typeof event.id === "string") startReasoningPart(event.id);
      break;
    case "reasoning-delta":
      appendReasoning(
        typeof event.id === "string" ? event.id : undefined,
        event.text ?? "",
      );
      break;
    case "reasoning-end":
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
      appendText(undefined, `\n\n_Error: ${event.error}_`);
      break;
    case "file-updated":
      if (typeof event.path === "string" && typeof event.content === "string") {
        projectFiles.update((f) => ({ ...f, [event.path]: event.content }));
      }
      break;
    case "file-deleted":
      if (typeof event.path === "string") {
        projectFiles.update((f) => {
          const next = { ...f };
          delete next[event.path];
          return next;
        });
      }
      break;
    case "turn-terminal":
      appendText(undefined, `\n\n_Turn already ended: ${event.status}${event.lastError ? " — " + event.lastError : ""}_`);
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

export const sendPrompt = async (
  projectId: string,
  prompt: string,
  opts: { skipUserAppend?: boolean } = {},
): Promise<void> => {
  if (!prompt.trim() || get(isRunning)) return;

  activeProjectId = projectId;

  if (!opts.skipUserAppend) {
    messages.update((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt.trim(),
        timestamp: new Date(),
      },
    ]);
  }
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
        mode: "router",
        persistPrompt: !opts.skipUserAppend,
      }),
    );
  } catch (e) {
    isRunning.set(false);
    appendText(undefined, `\n\n_Failed to reach agent server: ${String(e)}_`);
  }
};

export const cancelAgent = () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "cancel" }));
  }
  isRunning.set(false);
  clearSavedTurn(activeProjectId);
  activeTurnId = null;
  const interruptedId = currentAgentMessageId;
  currentAgentMessageId = null;
  lastOrdinal = -1;
  resetPlan();
  if (interruptedId) {
    messages.update((list) =>
      list.map((m) => (m.id === interruptedId ? { ...m, interrupted: true } : m)),
    );
  }
};

export const retryLastPrompt = async (projectId: string): Promise<void> => {
  if (get(isRunning)) return;
  const list = get(messages);
  let userIdx = -1;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role === "user") {
      userIdx = i;
      break;
    }
  }
  if (userIdx < 0) return;
  const prompt = list[userIdx].content;
  messages.set(list.slice(0, userIdx + 1));
  await sendPrompt(projectId, prompt, { skipUserAppend: true });
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
