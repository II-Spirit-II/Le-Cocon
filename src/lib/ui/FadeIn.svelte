<script lang="ts">
  /**
   * FadeIn Component
   *
   * Wrapper component for smooth fade-in animations on page load.
   * Respects prefers-reduced-motion automatically.
   *
   * Usage:
   * <FadeIn>
   *   <Card>...</Card>
   * </FadeIn>
   *
   * With delay for staggered lists:
   * <FadeIn delay={100}>...</FadeIn>
   */
  import type { Snippet } from 'svelte';
  import { browser } from '$app/environment';
  import { fly, fade } from 'svelte/transition';
  import { DURATION } from './motion';

  interface Props {
    children: Snippet;
    /** Delay in ms before animation starts (for stagger effects) */
    delay?: number;
    /** Animation type: 'fade' (opacity only) or 'fly' (opacity + translate) */
    type?: 'fade' | 'fly';
    /** Distance to fly from (only for type='fly') */
    y?: number;
    /** Custom duration override */
    duration?: number;
    /** Additional CSS class */
    class?: string;
  }

  let {
    children,
    delay = 0,
    type = 'fly',
    y = 8,
    duration,
    class: className = ''
  }: Props = $props();

  // Use reduced duration or 0 for accessibility (SSR-safe)
  const getDuration = () => {
    if (!browser) return 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return duration ?? DURATION.slow;
  };
</script>

{#if type === 'fade'}
  <div
    class={className}
    in:fade={{ duration: getDuration(), delay }}
  >
    {@render children()}
  </div>
{:else}
  <div
    class={className}
    in:fly={{ y, duration: getDuration(), delay, opacity: 0 }}
  >
    {@render children()}
  </div>
{/if}
