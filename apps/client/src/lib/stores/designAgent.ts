import { writable, get } from "svelte/store";
import { getWsTicket } from "$lib/api/auth";
import {
  createDesignTemplateFromDraft,
  updateDesignTemplateFromDraft,
} from "$lib/api/projects";
import { selectedModel } from "./agent";

export type DesignAgentMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: Date;
};

export type DesignAgentStatus = {
  phase: "idle" | "connecting" | "running";
  label: string;
};

export type SavedTemplate = {
  id: string;
  slug: string;
  name: string;
};

export type SaveProposal = {
  name: string;
  description: string;
  markdown: string;
};

const SERVER_WS = import.meta.env.VITE_SERVER_WS ?? "ws://localhost:3001";
const designAgentWsUrl = () => `${SERVER_WS}/ws/design-agent`;

export const messages = writable<DesignAgentMessage[]>([]);
export const status = writable<DesignAgentStatus>({ phase: "idle", label: "idle" });
export const draftMarkdown = writable<string | null>(null);
export const saveProposal = writable<SaveProposal | null>(null);
export const savedTemplate = writable<SavedTemplate | null>(null);
export const isSaving = writable(false);
export const errorMessage = writable<string | null>(null);
export const editingTemplateId = writable<string | null>(null);

let socket: WebSocket | null = null;
let currentAgentMessageId: string | null = null;
let abortRequested = false;

const TOOL_STATUS: Record<string, string> = {
  read_builtin_template: "reading reference template",
  write_draft: "writing draft",
  validate_draft: "validating draft",
  propose_save: "proposing save",
};

const setStatus = (phase: DesignAgentStatus["phase"], label: string) =>
  status.set({ phase, label });

const addUserMessage = (content: string) => {
  const msg: DesignAgentMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content,
    timestamp: new Date(),
  };
  messages.update((list) => [...list, msg]);
};

const startAgentMessage = () => {
  const id = crypto.randomUUID();
  currentAgentMessageId = id;
  messages.update((list) => [
    ...list,
    { id, role: "agent", content: "", timestamp: new Date() },
  ]);
};

const appendAgentText = (delta: string) => {
  if (!currentAgentMessageId) startAgentMessage();
  const id = currentAgentMessageId!;
  messages.update((list) =>
    list.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)),
  );
};

const closeSocket = () => {
  if (!socket) return;
  try {
    socket.close();
  } catch {}
  socket = null;
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
      abortRequested = false;
      currentAgentMessageId = null;
      setStatus("running", "generating");
      errorMessage.set(null);
      break;

    case "text-start":
      startAgentMessage();
      break;

    case "text-delta":
      if (typeof event.text === "string" && event.text.length > 0) {
        appendAgentText(event.text);
      }
      break;

    case "text-end":
      break;

    case "tool-call": {
      const name = typeof event.toolName === "string" ? event.toolName : "";
      const label = TOOL_STATUS[name] ?? name.replace(/_/g, " ");
      setStatus("running", label);
      break;
    }

    case "tool-result":
      setStatus("running", "generating");
      break;

    case "draft-updated":
      if (typeof event.markdown === "string") {
        draftMarkdown.set(event.markdown);
      }
      break;

    case "save-proposed":
      if (event.proposal) {
        saveProposal.set({
          name: String(event.proposal.name ?? ""),
          description: String(event.proposal.description ?? ""),
          markdown: String(event.proposal.markdown ?? ""),
        });
      }
      break;

    case "cancelled":
      setStatus("idle", "cancelled");
      currentAgentMessageId = null;
      break;

    case "error":
      errorMessage.set(
        typeof event.error === "string" ? event.error : "agent error",
      );
      setStatus("idle", "error");
      currentAgentMessageId = null;
      break;

    case "finish":
    case "done":
      setStatus("idle", "idle");
      currentAgentMessageId = null;
      break;
  }
};

const ensureSocket = async (): Promise<WebSocket> => {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;
  if (socket) closeSocket();

  setStatus("connecting", "connecting…");

  let url = designAgentWsUrl();
  try {
    const { ticket } = await getWsTicket();
    url = `${url}?ticket=${encodeURIComponent(ticket)}`;
  } catch {}

  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url);
    socket = ws;
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => {
      reject(e);
      setStatus("idle", "connection error");
    });
    ws.addEventListener("message", (ev) => handleEvent(ev.data));
    ws.addEventListener("close", () => {
      if (get(status).phase !== "idle") {
        setStatus("idle", abortRequested ? "cancelled" : "disconnected");
      }
      currentAgentMessageId = null;
    });
  });
};

export const sendDesignPrompt = async (prompt: string): Promise<void> => {
  const trimmed = prompt.trim();
  if (!trimmed) return;
  const model = get(selectedModel);
  if (!model) {
    errorMessage.set("no model selected");
    return;
  }

  addUserMessage(trimmed);
  errorMessage.set(null);
  savedTemplate.set(null);
  saveProposal.set(null);

  let ws: WebSocket;
  try {
    ws = await ensureSocket();
  } catch (err) {
    errorMessage.set(
      err instanceof Error ? err.message : "failed to connect",
    );
    setStatus("idle", "error");
    return;
  }

  const history = get(messages)
    .filter((m) => m.id !== currentAgentMessageId)
    .slice(0, -1)
    .map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.content }));

  ws.send(
    JSON.stringify({
      type: "run",
      model,
      prompt: trimmed,
      history,
      initialDraft: get(draftMarkdown),
    }),
  );
};

export const cancelDesignAgent = () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  abortRequested = true;
  try {
    socket.send(JSON.stringify({ type: "cancel" }));
  } catch {}
};

export const dismissSaveProposal = () => {
  saveProposal.set(null);
};

export const commitSave = async (opts: {
  name?: string;
  description?: string;
}): Promise<boolean> => {
  const markdown = get(draftMarkdown);
  if (!markdown) {
    errorMessage.set("no draft to save yet");
    return false;
  }
  isSaving.set(true);
  errorMessage.set(null);
  const editId = get(editingTemplateId);
  try {
    if (editId) {
      const row = await updateDesignTemplateFromDraft(editId, {
        markdown,
        name: opts.name,
        description: opts.description,
      });
      if (!row) {
        errorMessage.set("save failed");
        return false;
      }
      savedTemplate.set({
        id: row.id,
        slug: row.slug ?? "",
        name: row.name,
      });
    } else {
      const row = await createDesignTemplateFromDraft({
        markdown,
        name: opts.name,
        description: opts.description,
      });
      if (!row) {
        errorMessage.set("save failed");
        return false;
      }
      savedTemplate.set({
        id: row.id,
        slug: row.slug ?? "",
        name: row.name,
      });
    }
    saveProposal.set(null);
    return true;
  } catch (err) {
    errorMessage.set(err instanceof Error ? err.message : "save failed");
    return false;
  } finally {
    isSaving.set(false);
  }
};

export const seedEditingTemplate = (input: {
  id: string;
  content: string;
  name: string;
}) => {
  resetDesignStudio();
  editingTemplateId.set(input.id);
  draftMarkdown.set(input.content);
  savedTemplate.set(null);
};

export const resetDesignStudio = () => {
  closeSocket();
  messages.set([]);
  status.set({ phase: "idle", label: "idle" });
  draftMarkdown.set(null);
  saveProposal.set(null);
  savedTemplate.set(null);
  isSaving.set(false);
  errorMessage.set(null);
  editingTemplateId.set(null);
  currentAgentMessageId = null;
  abortRequested = false;
};
