import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, hasDb, schema } from "../db/client";
import { getReasoningProviderOptions, resolveModel } from "./providers";
import { parseTemplate } from "./designTemplate";
import { createAgentDesignTemplate } from "../db/repo";
import { extractErrorMessage } from "./coder";

export type DesignAgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type DesignAgentEvent =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "text-end"; id: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
    }
  | { type: "draft-updated"; markdown: string }
  | {
      type: "template-saved";
      template: { id: string; slug: string; name: string };
    }
  | { type: "step-finish"; finishReason: string }
  | { type: "finish"; finishReason: string; usage?: unknown }
  | { type: "error"; error: string };

export type RunDesignAgentOptions = {
  provider: string;
  model?: string;
  ownerUserId: string;
  prompt: string;
  history?: DesignAgentChatMessage[];
  initialDraft?: string | null;
  signal?: AbortSignal;
  onEvent: (event: DesignAgentEvent) => void;
};

const DESIGN_AGENT_SYSTEM_PROMPT = `You are a design-system template authoring agent. Your job is to produce a single, valid design template Markdown document that describes a cohesive visual voice — colors, typography, layout, elevation, shapes, components, and usage rules — and save it for the user.

Output format (STRICT):
Each template is a Markdown file with YAML frontmatter, matching the same schema used by the platform's builtin templates. Structure:

---
version: alpha
name: <Human Readable Name>
description: <One sentence — the vibe and where it fits best.>
colors:
  primary: "#RRGGBB"
  secondary: "#RRGGBB"
  tertiary: "#RRGGBB"
  neutral: "#RRGGBB"        # page/background canvas
  surface: "#RRGGBB"         # card/panel surface
  on-surface: "#RRGGBB"      # primary text on surface and neutral
  error: "#RRGGBB"
  border: "#RRGGBB"
  muted-foreground: "#RRGGBB"
typography:
  headline-lg:
    fontFamily: <family>
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.2
  headline-md: { ... }
  body-md: { ... }
  body-sm: { ... }
  label-md: { ... }
rounded:
  sm: 4px
  md: 8px
  lg: 14px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.on-surface}", rounded: "{rounded.md}", padding: 12px }
  input:          { backgroundColor: "{colors.surface}",  textColor: "{colors.on-surface}", rounded: "{rounded.md}", padding: 10px }
  card:           { backgroundColor: "{colors.surface}",  rounded: "{rounded.lg}", padding: 20px }
---

# <Template Name>

## Overview
<Paragraph on the mood, target use cases, and what makes this template distinct.>

## Colors
<Bulleted description of each color role and where it should be used.>

## Typography
<Type scale rationale, when each role is used.>

## Layout
<Spacing scale, grid, container patterns.>

## Elevation
<Depth strategy — shadows, layering, borders vs shadows.>

## Shapes
<Radius scale and shape language.>

## Components
<How each component composes tokens.>

## Do's and Don'ts
<Bulleted rules — what to embrace, what to avoid.>

Hard rules (the validator will reject you otherwise):
1. Frontmatter MUST include a non-empty "name" field.
2. The body MUST contain all 8 H2 sections above (## Overview, ## Colors, ## Typography, ## Layout, ## Elevation, ## Shapes, ## Components, ## Do's and Don'ts). If a section is deliberately omitted, list it in a frontmatter "omitted" array — but prefer writing all 8.
3. Section headings must be unique (no duplicate H2s).
4. Contrast: on-surface vs neutral AND on-surface vs surface must each pass WCAG AA (contrast ratio >= 4.5:1). Choose your palette to satisfy both pairs, or the save will be rejected.
5. Use hex colors (#RRGGBB or #RGB) in the frontmatter "colors" block — no hsl(), rgb(), oklch(), or named colors. The contrast checker only understands hex.

Your workflow:
1. Optionally call read_builtin_template with slug "paper", "nebula", or "terminal" to see reference structure. Use this ONLY if you need to remind yourself of the format — do not copy verbatim.
2. Call write_draft with your full Markdown document. This stashes the draft; the client sees a live preview.
3. Call validate_draft. It returns { ok: true } or { ok: false, error }. If it fails, revise your draft (fix the specific issue named in the error) and call write_draft again, then validate_draft. Repeat until it passes. Cap yourself at 4 revision attempts — if you can't pass after four, report the blocker in text and stop.
4. Once validate_draft returns ok, call save_template with a "name" and short "description". The tool persists the template and returns { id, slug }.
5. Reply with one short sentence confirming what was saved. Do not dump the full markdown back to the user.

Refinement turns:
- If the user has an existing draft (visible in the conversation) and asks for a tweak ("make the accent warmer", "swap the serif for a mono headline"), start from that draft — do NOT regenerate from scratch. Call write_draft with the revised full document, then validate_draft, then save_template.
- Do not call read_builtin_template on refinement turns unless the user explicitly changes the reference direction.

Narration:
- Before each concrete step, say one short sentence (5-15 words) about what you're about to do. Do not narrate between tool calls within the same step.
- Do not restate tool arguments or dump tool output back to the user.`;

const buildDraftAppendix = (draft: string): string =>
  `\n\nCURRENT DRAFT\n\nThe user has an in-progress draft below. Start from this on refinement turns.\n\n<draft>\n${draft}\n</draft>`;

const readBuiltinFromDb = async (
  slug: string,
): Promise<{ slug: string; name: string; content: string } | null> => {
  if (!hasDb || !db) return null;
  const rows = await db
    .select({
      slug: schema.designTemplates.slug,
      name: schema.designTemplates.name,
      content: schema.designTemplates.content,
    })
    .from(schema.designTemplates)
    .where(
      and(
        eq(schema.designTemplates.origin, "builtin"),
        eq(schema.designTemplates.slug, slug),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || !row.slug) return null;
  return { slug: row.slug, name: row.name, content: row.content };
};

export const runDesignAgent = async (
  opts: RunDesignAgentOptions,
): Promise<void> => {
  const model = await resolveModel(opts.provider, opts.model);
  const reasoning = getReasoningProviderOptions(opts.provider, opts.model);

  const draftState: { markdown: string | null; savedTemplateId: string | null } =
    {
      markdown: opts.initialDraft?.trim() ? opts.initialDraft : null,
      savedTemplateId: null,
    };

  const emit = (event: DesignAgentEvent): void => {
    try {
      opts.onEvent(event);
    } catch {}
  };

  const tools = {
    read_builtin_template: tool({
      description:
        "Read the full markdown source of a builtin design template for reference. Valid slugs: 'paper', 'nebula', 'terminal'. Use sparingly — only when you need to remind yourself of the format.",
      inputSchema: z.object({
        slug: z
          .string()
          .describe("Builtin slug — one of 'paper', 'nebula', 'terminal'."),
      }),
      execute: async ({ slug }) => {
        const row = await readBuiltinFromDb(slug);
        if (!row) return { error: `builtin template not found: ${slug}` };
        return { slug: row.slug, name: row.name, content: row.content };
      },
    }),

    write_draft: tool({
      description:
        "Write the full markdown document as the current draft. Overwrites any prior draft. Emits a preview event to the client. Always follow with validate_draft before save_template.",
      inputSchema: z.object({
        markdown: z
          .string()
          .describe(
            "Complete Markdown document with YAML frontmatter and all required H2 sections.",
          ),
      }),
      execute: async ({ markdown }) => {
        draftState.markdown = markdown;
        emit({ type: "draft-updated", markdown });
        return { ok: true as const, length: markdown.length };
      },
    }),

    validate_draft: tool({
      description:
        "Validate the current draft against the platform schema (frontmatter, required sections, WCAG AA contrast). Returns { ok: true } or { ok: false, error }. Call after every write_draft.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!draftState.markdown) {
          return {
            ok: false as const,
            error: "no draft yet — call write_draft first",
          };
        }
        try {
          const parsed = parseTemplate(draftState.markdown);
          return {
            ok: true as const,
            name: parsed.tokens.name,
            sections: parsed.sections,
            warnings: parsed.warnings,
          };
        } catch (err) {
          return { ok: false as const, error: extractErrorMessage(err) };
        }
      },
    }),

    save_template: tool({
      description:
        "Persist the current validated draft as a new template owned by the user. Re-validates before saving. Returns { id, slug, name } on success. Do not call unless validate_draft returned ok.",
      inputSchema: z.object({
        name: z
          .string()
          .min(1)
          .describe(
            "Human-readable template name. Should match the 'name' field in the frontmatter.",
          ),
        description: z
          .string()
          .optional()
          .describe(
            "One-sentence description shown in the template picker. Should match frontmatter 'description'.",
          ),
      }),
      execute: async ({ name, description }) => {
        if (!draftState.markdown) {
          return { error: "no draft to save — call write_draft first" };
        }
        let parsed;
        try {
          parsed = parseTemplate(draftState.markdown);
        } catch (err) {
          return {
            error: `draft failed validation: ${extractErrorMessage(err)}`,
          };
        }
        try {
          const row = await createAgentDesignTemplate({
            ownerUserId: opts.ownerUserId,
            name,
            description:
              description ?? parsed.tokens.description ?? null,
            content: draftState.markdown,
            parsedTokens: parsed.tokens,
          });
          if (!row) return { error: "database not configured" };
          draftState.savedTemplateId = row.id;
          emit({
            type: "template-saved",
            template: { id: row.id, slug: row.slug ?? "", name: row.name },
          });
          return { id: row.id, slug: row.slug, name: row.name };
        } catch (err) {
          return { error: extractErrorMessage(err) };
        }
      },
    }),
  };

  const system = draftState.markdown
    ? DESIGN_AGENT_SYSTEM_PROMPT + buildDraftAppendix(draftState.markdown)
    : DESIGN_AGENT_SYSTEM_PROMPT;

  const messages: ModelMessage[] = [
    ...(opts.history ?? []).map(
      (m) => ({ role: m.role, content: m.content }) as ModelMessage,
    ),
    { role: "user", content: opts.prompt },
  ];

  try {
    const result = streamText({
      model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(30),
      abortSignal: opts.signal,
      ...(reasoning.providerOptions
        ? { providerOptions: reasoning.providerOptions }
        : {}),
      ...(reasoning.maxOutputTokens
        ? { maxOutputTokens: reasoning.maxOutputTokens }
        : {}),
    });

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-start" as any:
          emit({ type: "text-start", id: (chunk as any).id });
          break;
        case "text-delta":
          emit({
            type: "text-delta",
            id: (chunk as any).id,
            text: (chunk as any).text ?? (chunk as any).delta ?? "",
          });
          break;
        case "text-end" as any:
          emit({ type: "text-end", id: (chunk as any).id });
          break;
        case "reasoning-start" as any:
        case "reasoning-delta" as any:
        case "reasoning-end" as any:
          break;
        case "tool-call":
          emit({
            type: "tool-call",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            input: (chunk as any).input ?? (chunk as any).args,
          });
          break;
        case "tool-result":
          emit({
            type: "tool-result",
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            output: (chunk as any).output ?? (chunk as any).result,
          });
          break;
        case "finish-step":
        case "step-finish" as any:
          emit({
            type: "step-finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
          });
          break;
        case "finish":
          emit({
            type: "finish",
            finishReason: (chunk as any).finishReason ?? "unknown",
            usage: (chunk as any).usage,
          });
          break;
        case "error":
          emit({
            type: "error",
            error: extractErrorMessage((chunk as any).error),
          });
          break;
      }
    }
  } catch (err) {
    if (opts.signal?.aborted) return;
    emit({ type: "error", error: extractErrorMessage(err) });
  }
};
