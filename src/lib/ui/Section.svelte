<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title?: string;
    description?: string;
    class?: string;
    children: Snippet;
  }

  let {
    title,
    description,
    class: className = '',
    children
  }: Props = $props();
</script>

<section class={className}>
  {#if title}
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-warm-900">{title}</h2>
      {#if description}
        <p class="mt-0.5 text-sm text-warm-600">{description}</p>
      {/if}
    </div>
  {/if}
  {@render children()}
</section>
