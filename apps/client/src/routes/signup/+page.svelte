<script lang="ts">
  import { goto } from "$app/navigation";
  import { signup } from "$lib/api/auth";
  import { setAuthedUser } from "$lib/stores/auth";
  import { HttpError } from "$lib/api/http";

  let email = "";
  let displayName = "";
  let password = "";
  let busy = false;
  let error = "";

  const submit = async () => {
    if (busy) return;
    error = "";
    if (password.length < 8) {
      error = "Password must be at least 8 characters.";
      return;
    }
    busy = true;
    try {
      const { user } = await signup(email.trim(), password, displayName.trim());
      setAuthedUser(user);
      goto("/projects");
    } catch (e) {
      error =
        e instanceof HttpError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
    } finally {
      busy = false;
    }
  };
</script>

<svelte:head>
  <title>Create account — Blind Code</title>
</svelte:head>

<div class="flex items-center justify-center px-6" style="min-height: calc(100vh - 3.5rem);">
  <form
    on:submit|preventDefault={submit}
    class="w-full max-w-sm rounded-xl border p-6"
    style="border-color: var(--border); background-color: var(--bg-secondary);"
  >
    <h1 class="text-xl font-semibold">Create account</h1>
    <p class="mt-1 text-xs" style="color: var(--text-secondary);">
      Sign up to save projects and pick up where you left off.
    </p>

    <label class="block mt-6 text-xs font-medium" style="color: var(--text-secondary);">
      Display name
      <input
        type="text"
        autocomplete="name"
        required
        bind:value={displayName}
        class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
      />
    </label>

    <label class="block mt-4 text-xs font-medium" style="color: var(--text-secondary);">
      Email
      <input
        type="email"
        autocomplete="email"
        required
        bind:value={email}
        class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
      />
    </label>

    <label class="block mt-4 text-xs font-medium" style="color: var(--text-secondary);">
      Password
      <input
        type="password"
        autocomplete="new-password"
        required
        minlength="8"
        bind:value={password}
        class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none"
        style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
      />
      <span class="text-[10px] mt-1 block" style="color: var(--text-tertiary);">
        Min 8 characters.
      </span>
    </label>

    {#if error}
      <div
        class="mt-4 rounded-md border px-3 py-2 text-xs"
        style="border-color: #ef4444; color: #ef4444; background-color: rgba(239, 68, 68, 0.08);"
      >
        {error}
      </div>
    {/if}

    <button
      type="submit"
      disabled={busy || !email.trim() || !displayName.trim() || !password}
      class="mt-6 w-full px-4 py-2 rounded-md text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
      style="background-color: var(--accent);"
    >
      {busy ? "Creating…" : "Create account"}
    </button>

    <p class="mt-4 text-xs text-center" style="color: var(--text-tertiary);">
      Already have an account?
      <a href="/login" class="underline" style="color: var(--accent);">Sign in</a>
    </p>
  </form>
</div>
