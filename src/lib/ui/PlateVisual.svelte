<script module>
  /** Compteur global pour générer des IDs SVG uniques par instance. */
  let _uid = 0;
</script>

<script lang="ts">
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import type { MealLevel } from '$lib/types';

  interface Props {
    /** Niveau repas : 0=Pas mangé · 1=Peu mangé · 2=Bien mangé · 3=Très bien · null=non défini */
    level: MealLevel | null;
    /** Taille de l'assiette */
    size?: 'sm' | 'md' | 'lg';
    /** Affiche le slider interactif à 4 crans sous l'assiette */
    interactive?: boolean;
    /** Appelé quand l'utilisateur change le niveau (null = désélection) */
    onchange?: (level: MealLevel | null) => void;
  }

  let { level = null, size = 'md', interactive = false, onchange }: Props = $props();

  const LEVELS = [
    { label: 'Pas mangé',  fillPct: 0,   fill: '#E8A898', dot: 'bg-argile-400/15 border-argile-400'  },
    { label: 'Peu mangé',  fillPct: 28,  fill: '#E8C484', dot: 'bg-sable-400/15 border-sable-400'  },
    { label: 'Bien mangé', fillPct: 68,  fill: '#A0D4A0', dot: 'bg-mousse-400/15 border-mousse-400' },
    { label: 'Très bien',  fillPct: 100, fill: '#7BC87B', dot: 'bg-mousse-400/20 border-mousse-500' },
  ] as const;

  const PX: Record<string, number> = { sm: 44, md: 72, lg: 112 };
  const px = $derived(PX[size]);

  // Unique ID per instance for SVG clipPath
  const clipId = `pcl${++_uid}`;

  // SVG viewBox 0 0 100 100, inner circle r=38 centered at (50,50)
  // Fill level rises from y=88 (empty) to y=12 (full)
  const FILL_BOTTOM = 88;
  const FILL_HEIGHT = 76; // 88 - 12

  const fillY = tweened(FILL_BOTTOM, { duration: 380, easing: cubicOut });

  $effect(() => {
    fillY.set(
      level !== null
        ? FILL_BOTTOM - (LEVELS[level].fillPct / 100) * FILL_HEIGHT
        : FILL_BOTTOM
    );
  });

  const fillColor  = $derived(level !== null ? LEVELS[level].fill  : 'transparent');
  const plateLabel = $derived(level !== null ? LEVELS[level].label : '-');
  const sliderW    = $derived(Math.max(px, 76));

  function pick(l: MealLevel) {
    // Clicking the active level deselects it
    onchange?.(level === l ? null : l);
  }
</script>

<div class="flex flex-col items-center" style="gap:{interactive ? '6' : '4'}px">

  <svg
    viewBox="0 0 100 100"
    style="width:{px}px;height:{px}px;flex-shrink:0"
    role="img"
    aria-label={plateLabel}
  >
    <defs>
      <clipPath id={clipId}>
        <circle cx="50" cy="50" r="38" />
      </clipPath>
    </defs>

    <circle cx="50" cy="50" r="48" fill="#f5ede3" stroke="#ddd0c0" stroke-width="2.5" />

    <circle cx="50" cy="50" r="38" fill="#fefcfa" />


    <rect
      x="12"
      y={$fillY}
      width="76"
      height={Math.max(0, FILL_BOTTOM - $fillY)}
      clip-path="url(#{clipId})"
      style="fill:{fillColor};transition:fill 0.38s ease"
    />

    <g clip-path="url(#{clipId})">
      <ellipse cx="54" cy="46" rx="12" ry="8.5"
        fill="#C97B50" opacity="0.72"
        transform="rotate(-8 54 46)"
      />
      <ellipse cx="50" cy="42" rx="4.5" ry="2"
        fill="white" opacity="0.28"
        transform="rotate(-8 50 42)"
      />
      <ellipse cx="37" cy="57" rx="7.5" ry="4.8"
        fill="#D4A040" opacity="0.70"
        transform="rotate(12 37 57)"
      />
      <circle cx="48" cy="63" r="3"   fill="#4E8B4E" opacity="0.78" />
      <circle cx="57" cy="65" r="2.4" fill="#4E8B4E" opacity="0.75" />
      <circle cx="41" cy="67" r="1.9" fill="#4E8B4E" opacity="0.72" />
    </g>

    <ellipse cx="37" cy="28" rx="9" ry="5" fill="white" opacity="0.38" />

    <circle cx="50" cy="50" r="38" fill="none" stroke="#ece3da" stroke-width="1.5" />
  </svg>

  <!-- Slider interactif (mode batch) -->
  {#if interactive}
    <div
      class="relative flex items-center justify-between"
      style="width:{sliderW}px;padding:0 4px"
    >
      <div
        class="absolute inset-x-4 h-px top-1/2 -translate-y-1/2 bg-warm-200 rounded-full pointer-events-none"
      ></div>

      {#if level !== null && level > 0}
        <div
          class="absolute left-4 h-px top-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-300"
          style="width:{(level / 3) * (sliderW - 8)}px;background:{fillColor}"
        ></div>
      {/if}

      {#each LEVELS as lvl, i}
        <button
          type="button"
          title={lvl.label}
          onclick={() => pick(i as MealLevel)}
          class="relative z-10 rounded-full border-2 transition-[color,background-color,border-color,transform] duration-200 cursor-pointer
            {level === i
              ? lvl.dot + ' w-4 h-4 scale-125 shadow-sm'
              : 'w-3.5 h-3.5 bg-warm-50 border-warm-300 hover:border-warm-400 hover:scale-110'}"
        ></button>
      {/each}
    </div>

    <span class="h-3 text-[10px] leading-3 text-warm-700 font-medium">
      {level !== null ? plateLabel : ''}
    </span>

  {:else if level !== null}
    <span class="text-xs font-medium text-warm-700 text-center leading-tight">{plateLabel}</span>
  {/if}

</div>
