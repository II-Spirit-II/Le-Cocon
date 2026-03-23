<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    href?: string;
    class?: string;
    onclick?: () => void;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    type = 'button',
    href,
    class: className = '',
    onclick,
    children
  }: Props = $props();

  const baseClasses = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-soie active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'bg-argile-500 text-white hover:bg-argile-400 focus-visible:ring-argile-400'
  };

  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-sm',
    md: 'px-5 py-2.5',
    lg: 'px-7 py-3.5 text-lg'
  };

  const classes = $derived(`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`);
</script>

{#if href}
  <a {href} class={classes} style="transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
    {@render children()}
  </a>
{:else}
  <button {type} {disabled} class={classes} {onclick} style="transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
    {@render children()}
  </button>
{/if}
