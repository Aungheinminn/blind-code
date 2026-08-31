import { writable, get } from "svelte/store";

export type AgentMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  toolCalls?: Array<{ id: string; name: string; input: unknown; output?: unknown }>;
  timestamp: Date;
};

export type ProviderInfo = {
  name: string;
  envVar: string;
  defaultModel: string;
  configured: boolean;
};

const SERVER_HTTP = import.meta.env.VITE_SERVER_HTTP ?? "http://localhost:3001";
const SERVER_WS = import.meta.env.VITE_SERVER_WS ?? "ws://localhost:3001";
const AGENT_TOKEN = import.meta.env.VITE_AGENT_TOKEN ?? "";
const agentWsUrl = () =>
  AGENT_TOKEN ? `${SERVER_WS}/ws/agent?token=${encodeURIComponent(AGENT_TOKEN)}` : `${SERVER_WS}/ws/agent`;

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

export const loadProviders = async () => {
  try {
    const res = await fetch(`${SERVER_HTTP}/agent/providers`);
    const json = await res.json();
    providers.set(json.data ?? []);
    const configured = (json.data ?? []).find((p: ProviderInfo) => p.configured);
    if (configured) selectedProvider.set(configured.name);
  } catch (e) {
    console.warn("Failed to load providers", e);
  }
};

let socket: WebSocket | null = null;
let currentAgentMessageId: string | null = null;

const ensureSocket = (): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.OPEN) return resolve(socket);
    if (socket) socket.close();

    const ws = new WebSocket(agentWsUrl());
    socket = ws;

    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => reject(e));
    ws.addEventListener("message", (ev) => handleEvent(ev.data));
    ws.addEventListener("close", () => {
      isRunning.set(false);
      currentAgentMessageId = null;
    });
  });

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

  switch (event.type) {
    case "started":
      startAgentMessage();
      break;
    case "text-delta":
      appendText(event.text ?? "");
      break;
    case "tool-call":
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
    case "done":
      isRunning.set(false);
      currentAgentMessageId = null;
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
};
