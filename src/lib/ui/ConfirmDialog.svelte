<script lang="ts">
  import { Button } from '$lib/ui';

  interface Props {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    loading?: boolean;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let {
    open = false,
    title,
    description,
    confirmLabel = 'Confirmer',
    cancelLabel = 'Annuler',
    variant = 'danger',
    loading = false,
    onconfirm,
    oncancel
  }: Props = $props();

  // Track visibility separately for exit animation
  let visible = $state(false);
  let closing = $state(false);
  let dialogEl: HTMLDivElement | undefined = $state();
  let previouslyFocused: HTMLElement | null = null;

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      visible = true;
      closing = false;
    } else if (visible && !closing) {
      closing = true;
      setTimeout(() => {
        visible = false;
        closing = false;
        // Restore focus to the element that opened the dialog
        previouslyFocused?.focus();
        previouslyFocused = null;
      }, 250);
    }
  });

  // Auto-focus first button when dialog opens
  $effect(() => {
    if (open && dialogEl) {
      const firstBtn = dialogEl.querySelector('button') as HTMLElement | null;
      firstBtn?.focus();
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;
    if (event.key === 'Escape' && !loading) {
      oncancel();
      return;
    }
    // Focus trap: cycle Tab within dialog
    if (event.key === 'Tab' && dialogEl) {
      const focusable = dialogEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget && !loading) {
      oncancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 dialog-backdrop {closing ? 'dialog-backdrop-out' : ''}"
    onclick={handleOverlayClick}
  >
    <div
      bind:this={dialogEl}
      class="dialog-glass max-w-md w-full p-6 {closing ? 'dialog-exit' : 'dialog-enter'}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      <!-- Icon -->
      <div class="flex justify-center mb-4">
        {#if variant === 'danger'}
          <div class="w-12 h-12 rounded-full flex items-center justify-center" style="background: rgba(212, 115, 106, 0.12);">
            <svg class="w-6 h-6 text-argile-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        {:else}
          <div class="w-12 h-12 rounded-full flex items-center justify-center" style="background: rgba(232, 145, 58, 0.1);">
            <svg class="w-6 h-6 text-miel-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        {/if}
      </div>

      <h2 id="dialog-title" class="text-lg font-display font-bold text-warm-900 text-center mb-2">
        {title}
      </h2>

      <p id="dialog-description" class="text-warm-600 text-center mb-6">
        {description}
      </p>

      <div class="flex gap-3 justify-center">
        <Button
          variant="ghost"
          onclick={oncancel}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          onclick={onconfirm}
          disabled={loading}
        >
          {loading ? 'Chargement...' : confirmLabel}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    background: rgba(26, 22, 18, 0.25);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: backdrop-in 0.3s ease forwards;
  }

  .dialog-backdrop-out {
    animation: backdrop-out 0.25s ease forwards;
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes backdrop-out {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  .dialog-glass {
    background: rgba(255, 248, 240, 0.88);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    border-radius: 1.75rem;
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 20px 60px rgba(194, 101, 58, 0.12),
      0 4px 16px rgba(194, 101, 58, 0.06);
  }

  @keyframes dialog-in {
    0%   { opacity: 0; transform: scale(0.92) translateY(12px); }
    60%  { opacity: 1; transform: scale(1.02) translateY(-2px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  @keyframes dialog-out {
    from { opacity: 1; transform: scale(1) translateY(0); }
    to   { opacity: 0; transform: scale(0.95) translateY(8px); }
  }

  .dialog-enter {
    animation: dialog-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .dialog-exit {
    animation: dialog-out 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    .dialog-backdrop, .dialog-backdrop-out { animation: none !important; }
    .dialog-enter, .dialog-exit { animation: none !important; }
  }
</style>
