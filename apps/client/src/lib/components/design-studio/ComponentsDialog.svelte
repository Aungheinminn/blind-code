<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import EditorDialog from "./EditorDialog.svelte";

  type ComponentDef = {
    backgroundColor?: string;
    textColor?: string;
    borderColor?: string;
    rounded?: string;
    padding?: string;
  };

  type ComponentPatch = {
    component: string;
    leaf: keyof ComponentDef;
    value: string;
  };

  export let values: Record<string, ComponentDef>;

  const COMPONENTS = ["button-primary", "input", "card"] as const;

  const FIELDS: Array<{ key: keyof ComponentDef; label: string; placeholder: string }> = [
    { key: "backgroundColor", label: "Background", placeholder: "{colors.primary}" },
    { key: "textColor", label: "Text", placeholder: "{colors.on-surface}" },
    { key: "borderColor", label: "Border", placeholder: "{colors.border}" },
    { key: "rounded", label: "Rounded", placeholder: "{rounded.md}" },
    { key: "padding", label: "Padding", placeholder: "12px" },
  ];

  const draft: Record<string, ComponentDef> = structuredClone(values);
  for (const c of COMPONENTS) {
    if (!draft[c]) draft[c] = {};
  }

  const dispatch = createEventDispatcher<{
    apply: ComponentPatch[];
    close: void;
  }>();

  const onApply = () => {
    const patches: ComponentPatch[] = [];
    for (const c of COMPONENTS) {
      const before = values[c] ?? {};
      const after = draft[c] ?? {};
      for (const { key } of FIELDS) {
        const b = (before[key] ?? "") as string;
        const a = (after[key] ?? "") as string;
        if (b !== a && a.trim().length > 0) {
          patches.push({ component: c, leaf: key, value: a.trim() });
        }
      }
    }
    dispatch("apply", patches);
  };
</script>

<EditorDialog
  title="Components"
  on:apply={onApply}
  on:close
>
  <div class="grid">
    {#each COMPONENTS as comp}
      <div class="row">
        <div class="row-head">
          <span class="comp">{comp}</span>
        </div>
        <div class="fields">
          {#each FIELDS as field}
            <label class="field">
              <span>{field.label}</span>
              <input
                type="text"
                bind:value={draft[comp][field.key]}
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
  .row-head .comp {
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
    min-width: 0;
  }
  .field input:focus {
    border-color: var(--accent);
  }
</style>
