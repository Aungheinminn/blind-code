<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import EditorDialog from "./EditorDialog.svelte";

  type TypographyRole = {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight?: string;
    letterSpacing?: string;
  };

  type TypographyPatch = { role: string; leaf: keyof TypographyRole; value: string };

  export let values: Record<string, TypographyRole>;

  const ROLES = [
    "headline-lg",
    "headline-md",
    "body-md",
    "body-sm",
    "label-md",
  ] as const;

  const FIELDS: Array<{ key: keyof TypographyRole; label: string; placeholder: string }> = [
    { key: "fontFamily", label: "Family", placeholder: "Inter" },
    { key: "fontSize", label: "Size", placeholder: "16px" },
    { key: "fontWeight", label: "Weight", placeholder: "400" },
    { key: "lineHeight", label: "Line", placeholder: "1.55" },
    { key: "letterSpacing", label: "Track", placeholder: "-0.01em" },
  ];

  const draft: Record<string, TypographyRole> = structuredClone(values);

  const dispatch = createEventDispatcher<{
    apply: TypographyPatch[];
    close: void;
  }>();

  const onApply = () => {
    const patches: TypographyPatch[] = [];
    for (const role of ROLES) {
      const before = values[role];
      const after = draft[role];
      if (!before || !after) continue;
      for (const { key } of FIELDS) {
        const b = (before[key] ?? "") as string;
        const a = (after[key] ?? "") as string;
        if (b !== a && a.trim().length > 0) {
          patches.push({ role, leaf: key, value: a.trim() });
        }
      }
    }
    dispatch("apply", patches);
  };
</script>

<EditorDialog
  title="Typography"
  on:apply={onApply}
  on:close
>
  <div class="grid">
    {#each ROLES as role}
      <div class="row">
        <div class="row-head">
          <span class="role">{role}</span>
        </div>
        <div class="fields">
          {#each FIELDS as field}
            <label class="field">
              <span>{field.label}</span>
              <input
                type="text"
                bind:value={draft[role][field.key]}
                placeholder={field.placeholder}
                spellcheck="false"
              />
            </label>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</EditorDialog>

<style>
  .grid {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }
  .row:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
  .row-head .role {
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-tertiary);
    font-weight: 600;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 10px;
    color: var(--text-tertiary);
  }
  .field input {
    padding: 6px 8px;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    border: 1px solid var(--border);
    border-radius: 5px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    outline: none;
  }
  .field input:focus {
    border-color: var(--accent);
  }
</style>
