import { streamText, stepCountIs, type ModelMessage } from "ai";
import { resolveModel } from "./providers";
import { buildAgentTools, type ToolContext } from "./tools";

export type AgentEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; output: unknown }
  | { type: "step-finish"; finishReason: string }
  | { type: "finish"; finishReason: string; usage?: unknown }
  | { type: "error"; error: string };

export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type RunAgentOptions = {
  provider: string;
  model?: string;
  toolContext: ToolContext;
  prompt: string;
  history?: AgentChatMessage[];
  maxSteps?: number;
  systemPrompt?: string;
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
};

const DEFAULT_SYSTEM_PROMPT = `You are a coding agent working inside a sandboxed project directory. You build small web apps (React, Svelte, static sites, Node scripts) end-to-end from a user's natural-language request.

Your workflow:
1. Call list_files first to see what already exists.
2. Read any relevant files before modifying them.
3. Write all files needed for a runnable project (package.json, entry point, HTML/config, source files).
4. When installing deps or running builds, use run_command with ['bun', 'install'] or similar. Never start long-running dev servers with run_command — the platform manages those.
5. Keep changes minimal and focused on the user's request.
6. When you're done, respond with a short summary of what you built and how to run it.

Tools available: list_files, read_file, write_file, delete_file, run_command. Always prefer editing existing files over creating parallel new ones.`;

export const runAgent = async (opts: RunAgentOptions): Promise<void> => {
  const model = resolveModel(opts.provider, opts.model);
  const tools = buildAgentTools(opts.toolContext);

  const messages: ModelMessage[] = [
    ...(opts.history ?? []).map(
      (m) => ({ role: m.role, content: m.content }) as ModelMessage,
    ),
    { role: "user", content: opts.prompt },
  ];

  try {
    const result = streamText({
      model,
      system: opts.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(opts.maxSteps ?? 20),
      abortSignal: opts.signal,
    });

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-delta":
          opts.onEvent({ type: "text-delta", text: (chunk as any).text ?? "" });
          break;
        case "tool-call":
          opts.onEvent({
            type: "tool-call",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            input: (chunk as any).input ?? (chunk as any).args,
          });
          break;
        case "tool-result":
          opts.onEvent({
            type: "tool-result",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            output: (chunk as any).output ?? (chunk as any).result,
          });
          break;
        case "finish-step":
        case "step-finish" as any:
          opts.onEvent({
            type: "step-finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
          });
          break;
        case "finish":
          opts.onEvent({
            type: "finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
            usage: (chunk as any).usage,
          });
          break;
        case "error":
          opts.onEvent({
            type: "error",
            error: String((chunk as any).error ?? "unknown error"),
          });
          break;
      }
    }
  } catch (err) {
    opts.onEvent({ type: "error", error: err instanceof Error ? err.message : String(err) });
  }
};
