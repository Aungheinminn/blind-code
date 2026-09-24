<script lang="ts">
  import { onMount } from "svelte";
  import { auth, setAuthedUser } from "$lib/stores/auth";
  import { changePassword, updateProfile } from "$lib/api/auth";

  let displayName = "";
  let email = "";
  let profileCurrentPassword = "";

  let originalDisplayName = "";
  let originalEmail = "";

  let profileSaving = false;
  let profileError = "";

  let pwCurrent = "";
  let pwNext = "";
  let pwConfirm = "";
  let showPasswords = false;
  let pwSaving = false;
  let pwError = "";

  let toast = "";
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const flash = (msg: string) => {
    toast = msg;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = ""), 2200);
  };

  const hydrate = () => {
    const s = $auth;
    if (s.status !== "authed") return;
    displayName = s.user.displayName;
    email = s.user.email;
    originalDisplayName = displayName;
    originalEmail = email;
  };

  onMount(hydrate);
  $: if ($auth.status === "authed" && !originalEmail) hydrate();

  $: emailChanging = email.trim() !== originalEmail;
  $: dirty = displayName.trim() !== originalDisplayName || emailChanging;

  const resetProfile = () => {
    displayName = originalDisplayName;
    email = originalEmail;
    profileCurrentPassword = "";
    profileError = "";
  };

  const saveProfile = async () => {
    profileError = "";
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
    profileSaving = true;
    try {
      const { user } = await updateProfile(patch);
      setAuthedUser(user);
      originalDisplayName = user.displayName;
      originalEmail = user.email;
      displayName = originalDisplayName;
      email = originalEmail;
      profileCurrentPassword = "";
      flash("Profile saved");
    } catch (e) {
      profileError = e instanceof Error ? e.message : String(e);
    } finally {
      profileSaving = false;
    }
  };

  const STRENGTH_COLORS = ["#e5736b", "#e0a84e", "#8fb0ff", "#5fbf8a"];
  const STRENGTH_LABELS = ["Weak", "Weak", "Fair", "Good", "Strong"];

  $: strengthScore = (() => {
    const p = pwNext;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
    return s;
  })();
  $: strengthBars = [0, 1, 2, 3].map((i) => ({
    color:
      pwNext && i < strengthScore
        ? STRENGTH_COLORS[Math.max(strengthScore - 1, 0)]
        : "var(--border)",
  }));
  $: strengthLabel = pwNext ? STRENGTH_LABELS[strengthScore] : "";

  $: confirmMismatch = pwConfirm.length > 0 && pwConfirm !== pwNext;
  $: pwReady = pwCurrent.length > 0 && pwNext.length >= 8 && pwConfirm === pwNext;

  const savePassword = async () => {
    pwError = "";
    if (!pwReady) return;
    pwSaving = true;
    try {
      await changePassword(pwCurrent, pwNext);
      pwCurrent = "";
      pwNext = "";
      pwConfirm = "";
      flash("Password updated");
    } catch (e) {
      pwError = e instanceof Error ? e.message : String(e);
    } finally {
      pwSaving = false;
    }
  };
</script>

<svelte:head>
  <title>Profile — Blind Code</title>
</svelte:head>

<div class="flex flex-col gap-10 pb-24">
  <header class="flex flex-col gap-1.5">
    <h1 class="m-0 text-[28px] font-semibold tracking-tight">Profile</h1>
    <p class="m-0 text-sm" style="color: var(--text-secondary);">
      Update your account details and password.
    </p>
  </header>

  {#if $auth.status !== "authed"}
    <div class="text-sm" style="color: var(--text-tertiary);">Loading…</div>
  {:else}
    <!-- Account details -->
    <section
      class="grid gap-6 md:gap-x-12 md:grid-cols-[220px_1fr] pt-8 border-t"
      style="border-color: var(--border);"
    >
      <div class="flex flex-col gap-1.5 max-w-[260px]">
        <h2 class="m-0 text-[15px] font-medium">Account details</h2>
        <p class="m-0 text-[13px] leading-relaxed" style="color: var(--text-secondary);">
          How you appear to collaborators across your projects.
        </p>
      </div>
        <div
          class="min-w-0 flex flex-col gap-5 rounded-xl border p-6"
          style="background-color: var(--bg-secondary); border-color: var(--border);"
        >
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px]" style="color: var(--text-secondary);">Display name</span>
            <input
              type="text"
              bind:value={displayName}
              maxlength="120"
              autocomplete="name"
              class="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[var(--accent)]"
              style="background-color: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px]" style="color: var(--text-secondary);">Email</span>
            <input
              type="email"
              bind:value={email}
              maxlength="255"
              autocomplete="email"
              class="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[var(--accent)]"
              style="background-color: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
            />
          </label>
          {#if emailChanging}
            <label class="flex flex-col gap-1.5">
              <span class="text-[13px]" style="color: var(--text-secondary);">
                Current password (required to change email)
              </span>
              {#if showPasswords}
                <input
                  type="text"
                  bind:value={profileCurrentPassword}
                  autocomplete="current-password"
                  class="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[var(--accent)]"
                  style="background-color: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
                />
              {:else}
                <input
                  type="password"
                  bind:value={profileCurrentPassword}
                  autocomplete="current-password"
                  class="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[var(--accent)]"
                  style="background-color: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
                />
              {/if}
            </label>
          {/if}
          {#if profileError}
            <div class="text-[12px]" style="color: #e5736b;">{profileError}</div>
          {/if}
        </div>
    </section>

    <!-- Password -->
    <section
      class="grid gap-6 md:gap-x-12 md:grid-cols-[220px_1fr] pt-8 border-t"
      style="border-color: var(--border);"
    >
      <div class="flex flex-col gap-1.5 max-w-[260px]">
        <h2 class="m-0 text-[15px] font-medium">Password</h2>
        <p class="m-0 text-[13px] leading-relaxed" style="color: var(--text-secondary);">
          Use at least 8 characters. You'll stay signed in on this device.
        </p>
      </div>
        <div
          class="min-w-0 flex flex-col gap-5 rounded-xl border p-6"
          style="background-color: var(--bg-secondary); border-color: var(--border);"
        >
          <label class="flex flex-col gap-1.5">
            <span class="text-[13px]" style="color: var(--text-secondary);">Current password</span>
            {#if showPasswords}
              <input
                type="text"
                bind:value={pwCurrent}
                autocomplete="current-password"
                class="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[var(--accent)]"
                style="background-color: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
              />
            {:else}
              <input
                type="password"
                bind:value={pwCurrent}
                autocomplete="current-password"
                class="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[var(--accent)]"
                style="background-color: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
              />
            {/if}
          </label>

          <div class="grid gap-5" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
            <div class="flex flex-col gap-1.5 min-w-0">
              <label class="flex flex-col gap-1.5">
                <span class="text-[13px]" style="color: var(--text-secondary);">New password</span>
                {#if showPasswords}
                  <input
                    type="text"
                    bind:value={pwNext}
                    autocomplete="new-password"
                    class="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[var(--accent)]"
                    style="background-color: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
                  />
                {:else}
                  <input
                    type="password"
                    bind:value={pwNext}
                    autocomplete="new-password"
                    class="h-9 px-3 rounded-lg border text-sm outline-none focus:border-[var(--accent)]"
                    style="background-color: var(--bg-primary); border-color: var(--border); color: var(--text-primary);"
                  />
                {/if}
              </label>
              <div class="flex items-center gap-2 mt-1">
                <div class="flex-1 grid grid-cols-4 gap-1">
                  {#each strengthBars as b, i (i)}
                    <div class="h-[3px] rounded" style="background-color: {b.color};"></div>
                  {/each}
                </div>
                <span
                  class="text-[12px] min-w-[44px] text-right"
                  style="color: var(--text-secondary);"
                >
                  {strengthLabel}
                </span>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 min-w-0">
              <label class="flex flex-col gap-1.5">
                <span class="text-[13px]" style="color: var(--text-secondary);">
                  Confirm new password
                </span>
                {#if showPasswords}
                  <input
                    type="text"
                    bind:value={pwConfirm}
                    autocomplete="new-password"
                    class="h-9 px-3 rounded-lg border text-sm outline-none"
                    style="background-color: var(--bg-primary); color: var(--text-primary); border-color: {confirmMismatch
                      ? '#7a3430'
                      : 'var(--border)'};"
                  />
                {:else}
                  <input
                    type="password"
                    bind:value={pwConfirm}
                    autocomplete="new-password"
                    class="h-9 px-3 rounded-lg border text-sm outline-none"
                    style="background-color: var(--bg-primary); color: var(--text-primary); border-color: {confirmMismatch
                      ? '#7a3430'
                      : 'var(--border)'};"
                  />
                {/if}
              </label>
              <span class="text-[12px] min-h-[16px] mt-1" style="color: #e5736b;">
                {confirmMismatch ? "Passwords don't match" : ""}
              </span>
            </div>
          </div>

          {#if pwError}
            <div class="text-[12px]" style="color: #e5736b;">{pwError}</div>
          {/if}

          <div
            class="flex items-center justify-between gap-3 pt-4 border-t flex-wrap"
            style="border-color: var(--border);"
          >
            <button
              type="button"
              class="flex items-center gap-2.5 text-[13px] cursor-pointer bg-transparent border-0 p-0"
              style="color: var(--text-secondary);"
              on:click={() => (showPasswords = !showPasswords)}
            >
              <span
                class="relative w-9 h-5 rounded-[10px] transition-colors shrink-0"
                style="background-color: {showPasswords ? 'var(--accent)' : 'var(--border-strong)'};"
              >
                <span
                  class="absolute top-[2px] w-4 h-4 rounded-full bg-white transition-[left]"
                  style="left: {showPasswords ? '18px' : '2px'};"
                ></span>
              </span>
              <span>Show passwords</span>
            </button>
            <button
              type="button"
              class="h-[34px] px-3.5 rounded-lg border text-[13px] font-medium cursor-pointer disabled:cursor-not-allowed"
              style="background-color: var(--bg-tertiary); border-color: var(--border); color: {pwReady
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)'};"
              on:click={savePassword}
              disabled={!pwReady || pwSaving}
            >
              {pwSaving ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
    </section>

    <!-- Delete account -->
    <section
      class="grid gap-6 md:gap-x-12 md:grid-cols-[220px_1fr] pt-8 border-t"
      style="border-color: var(--border);"
    >
      <div class="flex flex-col gap-1.5 max-w-[260px]">
        <h2 class="m-0 text-[15px] font-medium">Delete account</h2>
        <p class="m-0 text-[13px] leading-relaxed" style="color: var(--text-secondary);">
          Permanently remove your account and all projects.
        </p>
      </div>
      <div class="flex items-start">
        <button
          type="button"
          disabled
          title="Coming soon"
          class="h-[34px] px-3.5 rounded-lg border text-[13px] font-medium bg-transparent cursor-not-allowed opacity-60"
          style="border-color: #4a2320; color: #e5736b;"
        >
          Delete account…
        </button>
      </div>
    </section>
  {/if}
</div>

{#if dirty && !toast}
  <div
    class="fixed left-1/2 bottom-6 -translate-x-1/2 flex items-center gap-4 pl-4 pr-2 py-2 rounded-xl border text-[13px] whitespace-nowrap z-40"
    style="background-color: var(--bg-tertiary); border-color: var(--border-strong); color: var(--text-secondary); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);"
  >
    <span>Unsaved changes</span>
    <div class="flex gap-1.5">
      <button
        type="button"
        class="h-8 px-3 rounded-lg text-[13px] font-medium bg-transparent border-0 cursor-pointer disabled:opacity-50"
        style="color: var(--text-primary);"
        on:click={resetProfile}
        disabled={profileSaving}
      >
        Discard
      </button>
      <button
        type="button"
        class="h-8 px-3.5 rounded-lg text-[13px] font-medium text-white border-0 cursor-pointer disabled:opacity-50"
        style="background-color: var(--accent);"
        on:click={saveProfile}
        disabled={profileSaving}
      >
        {profileSaving ? "Saving…" : "Save changes"}
      </button>
    </div>
  </div>
{/if}

{#if toast}
  <div
    class="fixed left-1/2 bottom-6 -translate-x-1/2 px-4 py-2.5 rounded-lg border text-[13px] z-40"
    style="background-color: var(--bg-tertiary); border-color: var(--border-strong); color: var(--text-primary);"
  >
    {toast}
  </div>
{/if}
