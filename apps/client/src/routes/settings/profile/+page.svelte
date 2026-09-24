<script lang="ts">
  import { onMount } from "svelte";
  import { auth, setAuthedUser } from "$lib/stores/auth";
  import { changePassword, updateProfile } from "$lib/api/auth";

  let displayName = "";
  let email = "";
  let avatarUrl = "";
  let profileCurrentPassword = "";

  let originalDisplayName = "";
  let originalEmail = "";
  let originalAvatarUrl = "";

  let profileSaving = false;
  let profileError = "";
  let profileSuccess = "";

  let pwCurrent = "";
  let pwNew = "";
  let pwConfirm = "";
  let pwSaving = false;
  let pwError = "";
  let pwSuccess = "";

  const hydrate = () => {
    const s = $auth;
    if (s.status !== "authed") return;
    displayName = s.user.displayName;
    email = s.user.email;
    avatarUrl = s.user.avatarUrl ?? "";
    originalDisplayName = displayName;
    originalEmail = email;
    originalAvatarUrl = avatarUrl;
  };

  onMount(hydrate);
  $: if ($auth.status === "authed" && !originalEmail) hydrate();

  $: emailChanging = email.trim() !== originalEmail;
  $: dirty =
    displayName.trim() !== originalDisplayName ||
    emailChanging ||
    avatarUrl.trim() !== originalAvatarUrl;

  const resetProfile = () => {
    displayName = originalDisplayName;
    email = originalEmail;
    avatarUrl = originalAvatarUrl;
    profileCurrentPassword = "";
    profileError = "";
    profileSuccess = "";
  };

  const saveProfile = async () => {
    profileError = "";
    profileSuccess = "";
    if (!dirty) return;
    if (emailChanging && !profileCurrentPassword.trim()) {
      profileError = "Enter your current password to change email.";
      return;
    }
    const patch: Parameters<typeof updateProfile>[0] = {};
    if (displayName.trim() !== originalDisplayName) patch.displayName = displayName.trim();
    if (emailChanging) {
      patch.email = email.trim();
      patch.currentPassword = profileCurrentPassword;
    }
    if (avatarUrl.trim() !== originalAvatarUrl) {
      patch.avatarUrl = avatarUrl.trim() ? avatarUrl.trim() : null;
    }
    profileSaving = true;
    try {
      const { user } = await updateProfile(patch);
      setAuthedUser(user);
      originalDisplayName = user.displayName;
      originalEmail = user.email;
      originalAvatarUrl = user.avatarUrl ?? "";
      displayName = originalDisplayName;
      email = originalEmail;
      avatarUrl = originalAvatarUrl;
      profileCurrentPassword = "";
      profileSuccess = "Profile updated.";
    } catch (e) {
      profileError = e instanceof Error ? e.message : String(e);
    } finally {
      profileSaving = false;
    }
  };

  const savePassword = async () => {
    pwError = "";
    pwSuccess = "";
    if (!pwCurrent || !pwNew) {
      pwError = "Enter your current and new password.";
      return;
    }
    if (pwNew.length < 8) {
      pwError = "New password must be at least 8 characters.";
      return;
    }
    if (pwNew !== pwConfirm) {
      pwError = "New passwords don't match.";
      return;
    }
    pwSaving = true;
    try {
      await changePassword(pwCurrent, pwNew);
      pwCurrent = "";
      pwNew = "";
      pwConfirm = "";
      pwSuccess = "Password updated.";
    } catch (e) {
      pwError = e instanceof Error ? e.message : String(e);
    } finally {
      pwSaving = false;
    }
  };

  const cancelPassword = () => {
    pwCurrent = "";
    pwNew = "";
    pwConfirm = "";
    pwError = "";
    pwSuccess = "";
  };
</script>

<svelte:head>
  <title>Profile — Blind Code</title>
</svelte:head>

<div>
  <h1 class="text-2xl font-semibold">Profile</h1>
  <p class="mt-2 text-sm" style="color: var(--text-secondary);">
    Update your account details and password.
  </p>

  {#if $auth.status !== "authed"}
    <div class="mt-8 text-sm" style="color: var(--text-tertiary);">Loading…</div>
  {:else}
    <section
      class="mt-6 rounded-lg border p-5"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div
        class="text-[11px] uppercase tracking-wider font-semibold mb-4"
        style="color: var(--text-tertiary);"
      >
        Account details
      </div>

      <div class="space-y-4">
        <label class="block">
          <span class="text-xs" style="color: var(--text-secondary);">Display name</span>
          <input
            type="text"
            bind:value={displayName}
            maxlength="120"
            autocomplete="name"
            class="mt-1 w-full h-9 text-sm px-3 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>

        <label class="block">
          <span class="text-xs" style="color: var(--text-secondary);">Email</span>
          <input
            type="email"
            bind:value={email}
            maxlength="255"
            autocomplete="email"
            class="mt-1 w-full h-9 text-sm px-3 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>

        <label class="block">
          <span class="text-xs" style="color: var(--text-secondary);">Avatar URL</span>
          <textarea
            bind:value={avatarUrl}
            rows="2"
            placeholder="https://…"
            autocomplete="off"
            class="mt-1 w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none resize-y"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          ></textarea>
        </label>

        {#if emailChanging}
          <label class="block">
            <span class="text-xs" style="color: var(--text-secondary);">
              Current password (required to change email)
            </span>
            <input
              type="password"
              bind:value={profileCurrentPassword}
              autocomplete="current-password"
              class="mt-1 w-full h-9 text-sm px-3 rounded-md border bg-transparent outline-none"
              style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
            />
          </label>
        {/if}
      </div>

      {#if profileError}
        <div class="mt-4 text-xs" style="color: #ef4444;">{profileError}</div>
      {/if}
      {#if profileSuccess}
        <div class="mt-4 text-xs" style="color: var(--accent);">{profileSuccess}</div>
      {/if}

      <div class="mt-5 flex items-center gap-2 justify-end">
        <button
          type="button"
          class="px-3 h-9 text-xs rounded-md border cursor-pointer disabled:opacity-50"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
          on:click={resetProfile}
          disabled={!dirty || profileSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 h-9 text-xs rounded-md text-white cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
          on:click={saveProfile}
          disabled={!dirty || profileSaving}
        >
          {profileSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>

    <section
      class="mt-6 rounded-lg border p-5"
      style="border-color: var(--border); background-color: var(--bg-secondary);"
    >
      <div
        class="text-[11px] uppercase tracking-wider font-semibold mb-4"
        style="color: var(--text-tertiary);"
      >
        Password
      </div>

      <div class="space-y-4">
        <label class="block">
          <span class="text-xs" style="color: var(--text-secondary);">Current password</span>
          <input
            type="password"
            bind:value={pwCurrent}
            autocomplete="current-password"
            class="mt-1 w-full h-9 text-sm px-3 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>
        <label class="block">
          <span class="text-xs" style="color: var(--text-secondary);">New password</span>
          <input
            type="password"
            bind:value={pwNew}
            autocomplete="new-password"
            class="mt-1 w-full h-9 text-sm px-3 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>
        <label class="block">
          <span class="text-xs" style="color: var(--text-secondary);">Confirm new password</span>
          <input
            type="password"
            bind:value={pwConfirm}
            autocomplete="new-password"
            class="mt-1 w-full h-9 text-sm px-3 rounded-md border bg-transparent outline-none"
            style="border-color: var(--border); color: var(--text-primary); background-color: var(--bg-panel);"
          />
        </label>
      </div>

      {#if pwError}
        <div class="mt-4 text-xs" style="color: #ef4444;">{pwError}</div>
      {/if}
      {#if pwSuccess}
        <div class="mt-4 text-xs" style="color: var(--accent);">{pwSuccess}</div>
      {/if}

      <div class="mt-5 flex items-center gap-2 justify-end">
        <button
          type="button"
          class="px-3 h-9 text-xs rounded-md border cursor-pointer disabled:opacity-50"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
          on:click={cancelPassword}
          disabled={pwSaving || (!pwCurrent && !pwNew && !pwConfirm)}
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 h-9 text-xs rounded-md text-white cursor-pointer disabled:opacity-50"
          style="background-color: var(--accent);"
          on:click={savePassword}
          disabled={pwSaving || !pwCurrent || !pwNew || !pwConfirm}
        >
          {pwSaving ? "Saving…" : "Save"}
        </button>
      </div>
    </section>
  {/if}
</div>
