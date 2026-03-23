/**
 * Motion constants for consistent animations across the app.
 *
 * All durations respect prefers-reduced-motion via CSS media query.
 * Use these constants for Svelte transitions and CSS animations.
 */

// Durations in milliseconds
export const DURATION = {
  fast: 150,
  normal: 200,
  slow: 300,
  page: 250
} as const;

// Easing functions
export const EASING = {
  // Default easing for most transitions
  default: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // Entrance animations (elements appearing)
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  // Exit animations (elements leaving)
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  // Smooth, natural movement
  smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
  // Bouncy, playful feel (signature "Soie & Lumiere")
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  // Organic, silk-like movement
  silk: 'cubic-bezier(0.22, 1, 0.36, 1)'
} as const;

// Svelte transition presets (for use with fly, fade, slide, etc.)
export const TRANSITION = {
  // Fast fade for simple state changes
  fade: { duration: DURATION.fast },
  // Normal page/widget transitions
  normal: { duration: DURATION.normal },
  // Slide in from side (for steps, pages)
  slideIn: { duration: DURATION.page, x: 20 },
  slideOut: { duration: DURATION.page, x: -20 },
  // Fly up for widgets/cards appearing
  flyUp: { duration: DURATION.slow, y: 10 },
  // Scale in for modals, dialogs
  scaleIn: { duration: DURATION.normal, start: 0.95 }
} as const;

// Helper: check if user prefers reduced motion
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Helper: get duration respecting reduced motion preference
export function getResponsiveDuration(duration: number): number {
  return prefersReducedMotion() ? 0 : duration;
}
