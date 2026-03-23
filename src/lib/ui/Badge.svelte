<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md';
    class?: string;
    children: Snippet;
  }

  let {
    variant = 'default',
    size = 'md',
    class: className = '',
    children
  }: Props = $props();

  const variantClasses = {
    default: 'bg-warm-200/60 text-warm-700',
    success: 'bg-mousse-400/15 text-mousse-500',
    warning: 'bg-soleil-400/15 text-soleil-500',
    danger: 'bg-argile-400/15 text-argile-500',
    info: 'bg-bleu-400/15 text-bleu-500'
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
  };
</script>

<span class="inline-flex items-center font-medium rounded-full backdrop-blur-sm {variantClasses[variant]} {sizeClasses[size]} {className}">
  {@render children()}
</span>
