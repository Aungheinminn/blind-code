<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { auth, clearAuth, setAuthedUser } from "$lib/stores/auth";
  import { changePassword, updateProfile } from "$lib/api/auth";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import DeleteAccountModal from "$lib/components/settings/DeleteAccountModal.svelte";

  let displayName = "";
  let email = "";
  let profileCurrentPassword = "";

  let originalDisplayName = "";
  let originalEmail = "";

  let profileSaving = false;
  let profileError = "";

  let pwCurrent = "";
  let pwNew = "";
  let pwConfirm = "";
  let pwShow = false;
  let pwSaving = false;
  let pwError = "";

  let toast = "";
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let showDeleteModal = false;

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

  $: pwScore = (() => {
    const p = pwNew;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
    return s;
  })();
  $: pwStrengthLabel = pwNew ? ["Weak", "Weak", "Fair", "Good", "Strong"][pwScore] : "";
  $: pwMismatch = !!pwConfirm && pwConfirm !== pwNew;
  $: pwOk = !!pwCurrent && pwNew.length >= 8 && pwConfirm === pwNew;

  const strengthColors = ["#e5736b", "#e0a84e", "#8fb0ff", "#5fbf8a"];
  $: strengthActiveColor = strengthColors[Math.max(pwScore - 1, 0)];

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

  const savePassword = async () => {
    pwError = "";
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

<div class="flex flex-col gap-14">
  <header class="flex flex-col gap-1.5">
    <h1 class="m-0 text-[28px] font-semibold tracking-tight">Profile</h1>
    <p class="m-0 text-sm" style="color: var(--text-secondary);">
      Update your account details and password.
    </p>
  </header>

  {#if $auth.status !== "authed"}
    <div class="text-sm" style="color: var(--text-tertiary);">Loading…</div>
  {:else}
    <section class="profile-row">
      <div class="profile-row__side">
        <h2 class="m-0 text-[15px] font-medium">Account details</h2>
        <p class="m-0 text-[13px] leading-relaxed" style="color: var(--text-secondary);">
          How you appear to collaborators across your projects.
        </p>
      </div>

      <div class="profile-card">
        <div class="flex flex-col gap-1.5">
          <label for="p-name" class="text-[13px]" style="color: var(--text-secondary);">
            Display name
          </label>
          <input
            id="p-name"
            type="text"
            bind:value={displayName}
            maxlength="120"
            autocomplete="name"
            class="profile-input"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="p-email" class="text-[13px]" style="color: var(--text-secondary);">
            Email
          </label>
          <input
            id="p-email"
            type="email"
            bind:value={email}
            maxlength="255"
            autocomplete="email"
            class="profile-input"
          />
        </div>

        {#if emailChanging}
          <div class="flex flex-col gap-1.5">
            <label for="p-email-pw" class="text-[13px]" style="color: var(--text-secondary);">
              Current password <span style="color: var(--text-tertiary);">(required to change email)</span>
            </label>
            <input
              id="p-email-pw"
              type="password"
              bind:value={profileCurrentPassword}
              autocomplete="current-password"
              class="profile-input"
            />
          </div>
        {/if}

        {#if profileError}
          <div class="text-[13px]" style="color: var(--danger);">{profileError}</div>
        {/if}
      </div>
    </section>

    <section class="profile-row">
      <div class="profile-row__side">
        <h2 class="m-0 text-[15px] font-medium">Password</h2>
        <p class="m-0 text-[13px] leading-relaxed" style="color: var(--text-secondary);">
          Use at least 8 characters. You'll stay signed in on this device.
        </p>
      </div>

      <div class="profile-card">
        <div class="flex flex-col gap-1.5">
          <label for="p-cur" class="text-[13px]" style="color: var(--text-secondary);">
            Current password
          </label>
          <input
            id="p-cur"
            type={pwShow ? "text" : "password"}
            value={pwCurrent}
            on:input={(e) => (pwCurrent = e.currentTarget.value)}
            autocomplete="current-password"
            class="profile-input"
          />
        </div>

        <div class="grid gap-5" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          <div class="flex flex-col gap-1.5 min-w-0">
            <label for="p-new" class="text-[13px]" style="color: var(--text-secondary);">
              New password
            </label>
            <input
              id="p-new"
              type={pwShow ? "text" : "password"}
              value={pwNew}
              on:input={(e) => (pwNew = e.currentTarget.value)}
              autocomplete="new-password"
              class="profile-input"
            />
            <div class="flex items-center gap-2 mt-1">
              <div class="flex-1 grid grid-cols-4 gap-1">
                {#each [0, 1, 2, 3] as i}
                  <div
                    class="h-[3px] rounded-sm"
                    style="background: {pwNew && i < pwScore ? strengthActiveColor : 'var(--border)'};"
                  ></div>
                {/each}
              </div>
              <span
                class="text-xs min-w-[44px] text-right"
                style="color: var(--text-secondary);"
              >
                {pwStrengthLabel}
              </span>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 min-w-0">
            <label for="p-confirm" class="text-[13px]" style="color: var(--text-secondary);">
              Confirm new password
            </label>
            <input
              id="p-confirm"
              type={pwShow ? "text" : "password"}
              value={pwConfirm}
              on:input={(e) => (pwConfirm = e.currentTarget.value)}
              autocomplete="new-password"
              class="profile-input"
              class:profile-input--error={pwMismatch}
            />
            <span
              class="text-xs mt-1 min-h-[16px]"
              style="color: var(--danger);"
            >
              {pwMismatch ? "Passwords don't match" : ""}
            </span>
          </div>
        </div>

        {#if pwError}
          <div class="text-[13px]" style="color: var(--danger);">{pwError}</div>
        {/if}

        <div
          class="flex items-center justify-between gap-3 pt-4 flex-wrap"
          style="border-top: 1px solid var(--border);"
        >
          <div class="flex items-center gap-2.5 text-[13px]" style="color: var(--text-secondary);">
            <Toggle
              checked={pwShow}
              ariaLabel="Show passwords"
              on:change={(e) => (pwShow = e.detail)}
            />
            <span>Show passwords</span>
          </div>
          <button
            type="button"
            class="update-pw-btn"
            on:click={savePassword}
            disabled={!pwOk || pwSaving}
          >
            {pwSaving ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>
    </section>

    <section class="profile-row">
      <div class="profile-row__side">
        <h2 class="m-0 text-[15px] font-medium">Delete account</h2>
        <p class="m-0 text-[13px] leading-relaxed" style="color: var(--text-secondary);">
          Permanently remove your account and all projects.
        </p>
      </div>
      <div class="flex items-start" style="grid-column: span 2;">
        <button
          type="button"
          class="delete-btn"
          on:click={() => (showDeleteModal = true)}
        >
          Delete account…
        </button>
      </div>
    </section>
  {/if}
</div>

{#if showDeleteModal && $auth.status === "authed"}
  <DeleteAccountModal
    email={$auth.user.email}
    on:close={() => (showDeleteModal = false)}
    on:deleted={() => {
      showDeleteModal = false;
      clearAuth();
      goto("/login");
    }}
  />
{/if}

{#if dirty && $auth.status === "authed"}
  <div
    class="fixed left-1/2 bottom-6 -translate-x-1/2 flex items-center gap-4 pl-4 pr-2 py-2 rounded-xl text-[13px] whitespace-nowrap z-50"
    style="background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); box-shadow: 0 12px 40px rgba(0,0,0,0.5);"
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
        class="h-8 px-3.5 rounded-lg text-[13px] font-medium border-0 text-white cursor-pointer disabled:opacity-50"
        style="background: var(--accent);"
        on:click={saveProfile}
        disabled={profileSaving}
      >
        {profileSaving ? "Saving…" : "Save changes"}
      </button>
    </div>
  </div>
{/if}

{#if toast && !dirty}
  <div
    class="fixed left-1/2 bottom-6 -translate-x-1/2 px-4 py-2.5 rounded-lg text-[13px] z-50"
    style="background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-primary);"
  >
    {toast}
  </div>
{/if}

<style>
  .profile-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px 48px;
    padding-top: 48px;
    border-top: 1px solid var(--border);
  }
  .profile-row__side {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 260px;
  }
  .profile-card {
    grid-column: span 2;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
  }
  .profile-input {
    height: 36px;
    box-sizing: border-box;
    padding: 0 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .profile-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }
  .profile-input--error {
    border-color: #7a3430;
  }
  .delete-btn,
  .update-pw-btn {
    height: 40px;
    padding: 0 18px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .delete-btn {
    border: 1px solid #4a2320;
    background: transparent;
    color: #e5736b;
  }
  .delete-btn:hover {
    background: #1f1110;
  }
  .update-pw-btn {
    border: 1px solid var(--border);
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }
  .update-pw-btn:hover:not(:disabled) {
    border-color: var(--border-strong);
  }
  .update-pw-btn:disabled {
    color: var(--text-tertiary);
    cursor: not-allowed;
  }
</style>
