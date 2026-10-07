<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    closeOutOfCreditsModal,
    outOfCreditsModalOpen,
  } from "$lib/stores/outOfCreditsModal";

  const addKey = () => {
    closeOutOfCreditsModal();
    goto("/settings/providers");
  };

  const viewCredits = () => {
    closeOutOfCreditsModal();
    goto("/settings/credits");
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && $outOfCreditsModalOpen) closeOutOfCreditsModal();
  };
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $outOfCreditsModalOpen}
  <div
    class="modal-backdrop"
    on:click|self={closeOutOfCreditsModal}
    role="presentation"
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="out-of-credits-title"
      style="border-color: var(--border); background-color: var(--bg-panel);"
    >
      <div class="flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          style="background-color: #ef4444;"
          aria-hidden="true"
        ></span>
        <h2
          id="out-of-credits-title"
          class="text-base font-semibold"
          style="color: var(--text-primary);"
        >
          Out of credits
        </h2>
      </div>

      <p class="mt-3 text-sm leading-relaxed" style="color: var(--text-secondary);">
        You've used up your platform credits. You have two options:
      </p>

      <ul class="mt-3 space-y-2 text-sm" style="color: var(--text-secondary);">
        <li class="flex gap-2">
          <span style="color: #22c55e;">·</span>
          <span>
            <strong style="color: var(--text-primary);">Add your own API key</strong> in
            Settings → Providers. Prompts you run on your own key are always free.
          </span>
        </li>
        <li class="flex gap-2">
          <span style="color: var(--accent);">·</span>
          <span>
            <strong style="color: var(--text-primary);">Top up credits</strong> — pick a
            pack on Settings → Credits.
          </span>
        </li>
      </ul>

      <div class="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3 py-2 rounded-md text-xs border cursor-pointer"
          style="border-color: var(--border); color: var(--text-secondary); background-color: var(--bg-tertiary);"
          on:click={viewCredits}
        >
          Top up
        </button>
        <button
          type="button"
          class="px-3 py-2 rounded-md text-xs text-white cursor-pointer"
          style="background-color: var(--accent);"
          on:click={addKey}
        >
          Add my API key
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
