<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    class?: string;
    children: Snippet;
  }

  let {
    padding = 'md',
    hover = false,
    class: className = '',
    children
  }: Props = $props();

  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-7'
  };

  const hoverClass = $derived(hover ? 'glass-hover cursor-pointer' : '');
</script>

<div class="glass-1 rounded-3xl {paddingClasses[padding]} {hoverClass} {className}">
  {@render children()}
</div>
