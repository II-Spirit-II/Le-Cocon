<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'info' | 'success' | 'warning' | 'cocon';
    icon?: string;
    class?: string;
    children: Snippet;
    actions?: Snippet;
  }

  let {
    variant = 'info',
    icon,
    class: className = '',
    children,
    actions
  }: Props = $props();
</script>

<div
  class="callout callout-{variant} flex items-start gap-3 p-4 rounded-2xl animate-widget {className}"
  role="alert"
>
  {#if icon}
    <span class="shrink-0 text-xl callout-icon">{icon}</span>
  {/if}
  <div class="flex-1 min-w-0">
    <div class="callout-text text-sm font-medium">
      {@render children()}
    </div>
    {#if actions}
      <div class="mt-2">
        {@render actions()}
      </div>
    {/if}
  </div>
</div>

<style>
  .callout {
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .callout-info {
    background: rgba(123, 167, 188, 0.1);
    border: 1px solid rgba(123, 167, 188, 0.2);
  }
  .callout-info .callout-text { color: var(--color-bleu-500); }
  .callout-info .callout-icon { color: var(--color-bleu-400); }

  .callout-success {
    background: rgba(139, 168, 136, 0.1);
    border: 1px solid rgba(139, 168, 136, 0.2);
  }
  .callout-success .callout-text { color: var(--color-mousse-500); }
  .callout-success .callout-icon { color: var(--color-mousse-400); }

  .callout-warning {
    background: rgba(242, 193, 78, 0.1);
    border: 1px solid rgba(242, 193, 78, 0.2);
  }
  .callout-warning .callout-text { color: var(--color-soleil-500); }
  .callout-warning .callout-icon { color: var(--color-soleil-400); }

  .callout-cocon {
    background: rgba(232, 145, 58, 0.08);
    border: 1px solid rgba(232, 145, 58, 0.15);
  }
  .callout-cocon .callout-text { color: var(--color-miel-700); }
  .callout-cocon .callout-icon { color: var(--color-miel-500); }
</style>
