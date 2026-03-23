<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    actions?: Snippet;
  }

  let {
    title,
    description,
    actions
  }: Props = $props();
</script>

<div class="mb-6">
  <div class="flex items-center justify-between gap-4">
    <h1 class="text-2xl font-display font-bold text-warm-900 min-w-0 truncate">{title}</h1>
    {#if actions}
      <div class="flex items-center gap-3 shrink-0">
        {@render actions()}
      </div>
    {/if}
  </div>
  {#if description}
    <p class="mt-1 text-warm-600">{description}</p>
  {/if}
</div>
