<script lang="ts">
  import { closeWelcomeModal, welcomeModalOpen } from "$lib/stores/welcomeModal";

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && $welcomeModalOpen) closeWelcomeModal();
  };
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $welcomeModalOpen}
  <div
    class="modal-backdrop"
    on:click|self={closeWelcomeModal}
    role="presentation"
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      style="border-color: var(--border); background-color: var(--bg-panel);"
    >
      <div class="flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          style="background-color: #22c55e;"
          aria-hidden="true"
        ></span>
        <h2
          id="welcome-title"
          class="text-base font-semibold"
          style="color: var(--text-primary);"
        >
          Welcome to Blind Code
        </h2>
      </div>

      <p class="mt-3 text-sm leading-relaxed" style="color: var(--text-secondary);">
        You've got <strong style="color: var(--text-primary);">200 free credits</strong>
        to try the platform. Credits are only spent when you run on Blind Code's
        platform keys — adding your own API key in Settings → Providers lets you
        run for free.
      </p>

      <div class="mt-5 flex items-center justify-end">
        <button
          type="button"
          class="px-4 py-2 rounded-md text-xs text-white cursor-pointer"
          style="background-color: var(--accent);"
          on:click={closeWelcomeModal}
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.55);
    display: grid;
    place-items: center;
    z-index: 90;
    padding: 16px;
    animation: fade-in 120ms ease both;
  }
  .modal {
    width: 100%;
    max-width: 420px;
    padding: 20px 20px 18px;
    border-radius: 12px;
    border: 1px solid;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
    animation: rise 160ms ease both;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
</style>
