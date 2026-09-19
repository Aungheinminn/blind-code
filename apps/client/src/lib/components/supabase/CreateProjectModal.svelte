<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    createAccountSupabaseProject,
    listAccountSupabaseOrganizations,
    type CreatedAccountSupabaseProject,
    type SupabaseAccountOrganization,
  } from "$lib/api/account";

  export let existingProjectCount = 0;

  const dispatch = createEventDispatcher<{
    close: void;
    created: CreatedAccountSupabaseProject;
  }>();

  const REGIONS: Array<{ code: string; label: string }> = [
    { code: "americas", label: "Americas (smart)" },
    { code: "emea", label: "Europe, Middle East & Africa (smart)" },
    { code: "apac", label: "Asia Pacific (smart)" },
  ];

  let orgs: SupabaseAccountOrganization[] = [];
  let orgsLoading = true;
  let orgsError = "";

  let name = "";
  let organizationSlug = "";
  let regionCode = "americas";
  let dbPass = "";
  let busy = false;
  let error = "";
  let passwordCopied = false;

  const generatePassword = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    // base64url, strip padding
    const base = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    return base.slice(0, 24);
  };

  onMount(async () => {
    dbPass = generatePassword();
    try {
      orgs = await listAccountSupabaseOrganizations();
      if (orgs.length > 0) {
        organizationSlug = orgs[0].slug || orgs[0].id;
      }
    } catch (err) {
      orgsError = err instanceof Error ? err.message : "Could not load organizations.";
    } finally {
      orgsLoading = false;
    }
  });

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(dbPass);
      passwordCopied = true;
      setTimeout(() => (passwordCopied = false), 1500);
    } catch {}
  };

  const submit = async () => {
    error = "";
    if (!name.trim()) {
      error = "Name is required.";
      return;
    }
    if (!organizationSlug) {
      error = "Pick an organization.";
      return;
    }
    if (!dbPass || dbPass.length < 8) {
      error = "Password too short.";
      return;
    }
    busy = true;
    try {
      const created = await createAccountSupabaseProject({
        name: name.trim(),
        organizationSlug,
        regionCode,
        dbPass,
      });
      dispatch("created", created);
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not create project.";
    } finally {
      busy = false;
    }
  };

  const close = () => {
    if (busy) return;
    dispatch("close");
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<div
  class="fixed inset-0 z-50 flex items-center justify-center px-4"
  style="background-color: rgba(0, 0, 0, 0.55);"
  on:click|self={close}
  role="dialog"
  aria-modal="true"
  aria-labelledby="create-project-title"
  tabindex="-1"
>
  <div
    class="w-full max-w-md rounded-xl border shadow-xl"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <div class="px-5 pt-5 pb-4">
      <h2 id="create-project-title" class="text-base font-semibold">
        New Supabase project
      </h2>
      <p class="mt-1 text-xs" style="color: var(--text-secondary);">
        Provisioning takes 1–2 minutes. You'll see it appear in the grid — attach it once it's healthy.
      </p>
    </div>

    {#if existingProjectCount >= 2}
      <div
        class="mx-5 mb-3 rounded-md border px-3 py-2 text-xs"
        style="border-color: #f59e0b; color: #b45309; background-color: rgba(245, 158, 11, 0.08);"
      >
        You already have {existingProjectCount} Supabase project{existingProjectCount === 1 ? "" : "s"}.
        Free tier includes 2 per organization — a third will require the Pro plan ($25/mo)
        and gets charged to your Supabase account.
      </div>
    {/if}

    <form on:submit|preventDefault={submit} class="px-5 pb-4 space-y-4">
      <label class="block text-xs font-medium" style="color: var(--text-secondary);">
        Project name
        <input
          type="text"
          bind:value={name}
          placeholder="my-app"
          required
          class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
          style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
        />
      </label>

      <div>
        <label
          for="create-project-org"
          class="block text-xs font-medium"
          style="color: var(--text-secondary);"
        >
          Organization
        </label>
        {#if orgsLoading}
          <div class="mt-1 text-xs" style="color: var(--text-secondary);">Loading…</div>
        {:else if orgsError}
          <div class="mt-1 text-xs" style="color: #ef4444;">{orgsError}</div>
        {:else if orgs.length === 0}
          <div class="mt-1 text-xs" style="color: var(--text-secondary);">
            No organizations found on your Supabase account.
          </div>
        {:else}
          <select
            id="create-project-org"
            bind:value={organizationSlug}
            required
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          >
            {#each orgs as org}
              <option value={org.slug || org.id}>{org.name}</option>
            {/each}
          </select>
        {/if}
      </div>

      <label class="block text-xs font-medium" style="color: var(--text-secondary);">
        Region
        <select
          bind:value={regionCode}
          class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
          style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
        >
          {#each REGIONS as r}
            <option value={r.code}>{r.label}</option>
          {/each}
        </select>
      </label>

      <div class="text-xs" style="color: var(--text-secondary);">
        <div class="flex items-center justify-between mb-1">
          <span class="font-medium">Database password</span>
          <button
            type="button"
            class="text-[11px] underline cursor-pointer"
            style="color: var(--text-secondary); background: none; border: 0; padding: 0;"
            on:click={() => (dbPass = generatePassword())}
          >
            regenerate
          </button>
        </div>
        <div
          class="flex items-center gap-2 rounded-md border px-2 py-1.5"
          style="border-color: var(--border); background-color: var(--bg-panel);"
        >
          <span
            class="flex-1 min-w-0 truncate font-mono text-xs"
            style="color: var(--text-primary);"
          >{dbPass}</span>
          <button
            type="button"
            class="text-[11px] cursor-pointer shrink-0"
            style="color: var(--accent); background: none; border: 0; padding: 0;"
            on:click={copyPassword}
          >
            {passwordCopied ? "copied!" : "copy"}
          </button>
        </div>
        <div class="mt-1" style="color: var(--text-tertiary);">
          Not needed for AI table creation — that runs through your PAT. Save this only if you plan to
          connect Postgres from outside Blind Code (psql, pgAdmin, migrations). Supabase never shows it again.
        </div>
      </div>

      {#if error}
        <div
          class="rounded-md border px-3 py-2 text-xs"
          style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
        >
          {error}
        </div>
      {/if}
    </form>

    <div class="px-5 pb-5 flex items-center justify-end gap-2">
      <button
        type="button"
        class="px-3 py-2 rounded-md text-sm font-medium border cursor-pointer disabled:opacity-50"
        style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-panel);"
        disabled={busy}
        on:click={close}
      >
        Cancel
      </button>
      <button
        type="button"
        class="px-3 py-2 rounded-md text-sm font-medium text-white cursor-pointer disabled:opacity-50"
        style="background-color: var(--accent);"
        disabled={busy || !name.trim() || !organizationSlug || orgsLoading}
        on:click={submit}
      >
        {busy ? "Creating…" : "Create project"}
      </button>
    </div>
  </div>
</div>
