<script lang="ts">
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { fly } from 'svelte/transition';
  import { Card, Button, Callout } from '$lib/ui';
  import { DURATION } from '$lib/ui/motion';
  import type { PageData, ActionData } from './$types';
  import type { Menu } from '$lib/types';
  import { Sunrise, Sun, Apple, ChevronLeft, Check, UtensilsCrossed } from 'lucide-svelte';

  interface Props { data: PageData; form: ActionData; }
  let { data, form }: Props = $props();

  // ── Meal config ────────────────────────────────────────────────────
  const meals = [
    {
      key: 'petit-dejeuner',
      label: 'Petit-dejeuner',
      icon: Sunrise,
      color: 'miel',
      iconBg: 'rgba(232, 145, 58, 0.08)',
      iconBorder: 'rgba(232, 145, 58, 0.2)',
      placeholder: "Lait chaud, tartines beurrees, jus d'orange...",
      emoji: '🌅',
    },
    {
      key: 'dejeuner',
      label: 'Dejeuner',
      icon: Sun,
      color: 'sienne',
      iconBg: 'rgba(194, 101, 58, 0.08)',
      iconBorder: 'rgba(194, 101, 58, 0.2)',
      placeholder: "Poulet roti, haricots verts, puree de pommes de terre...",
      emoji: '☀️',
    },
    {
      key: 'gouter',
      label: 'Gouter',
      icon: Apple,
      color: 'mousse',
      iconBg: 'rgba(95, 160, 91, 0.08)',
      iconBorder: 'rgba(95, 160, 91, 0.2)',
      placeholder: "Compote de pommes, gateau maison, eau...",
      emoji: '🍎',
    },
  ];

  // ── Step management ────────────────────────────────────────────────
  let step = $state(1);
  let direction = $state<'forward' | 'backward'>('forward');

  const getDuration = () => {
    if (!browser) return 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return DURATION.page;
  };

  let stepEls: Record<number, HTMLDivElement | undefined> = $state({});
  let containerHeight = $state(0);

  function measureStep() {
    const el = stepEls[step];
    if (el) containerHeight = el.scrollHeight;
  }

  $effect(() => {
    step;
    if (browser) requestAnimationFrame(measureStep);
  });

  function goForward() {
    direction = 'forward';
    step++;
  }
  function goBack() {
    direction = 'backward';
    step--;
  }

  // ── State ──────────────────────────────────────────────────────────
  let isSaving = $state(false);
  let showSuccess = $state(false);

  function getExisting(mealKey: string): string {
    return data.menus.find((m: Menu) => m.mealType === mealKey)?.description ?? '';
  }

  let mealValues = $state<Record<string, string>>({
    'petit-dejeuner': getExisting('petit-dejeuner'),
    'dejeuner': getExisting('dejeuner'),
    'gouter': getExisting('gouter'),
  });

  const currentMeal = $derived(meals[step - 1]);
  const currentValue = $derived(mealValues[currentMeal?.key ?? ''] ?? '');
  const isExisting = $derived(!!getExisting(currentMeal?.key ?? ''));

  const filledCount = $derived(
    Object.values(mealValues).filter(v => v.trim().length > 0).length
  );

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  $effect(() => {
    if (form?.success) {
      showSuccess = true;
      setTimeout(() => { showSuccess = false; }, 3000);
    }
  });
</script>

<div class="min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4 sm:p-8">
  <div class="w-full max-w-md">

    <!-- Progress -->
    <div class="flex items-center justify-center gap-2 mb-6">
      {#each [1, 2, 3] as s}
        {@const meal = meals[s - 1]}
        {@const MealIcon = meal.icon}
        <div class="step-dot {step >= s ? 'step-dot-active' : 'step-dot-inactive'}" title={meal.label}>
          <MealIcon size={14} />
        </div>
        {#if s < 3}
          <div class="w-8 h-1 rounded-full transition-colors duration-300 {step > s ? 'bg-miel-500' : 'bg-warm-200/60'}"></div>
        {/if}
      {/each}
    </div>

    <!-- Date badge -->
    <div class="flex justify-center mb-4">
      <span class="date-badge">
        {formatDate(data.today)}
      </span>
    </div>

    <Card padding="lg">
      <form
        method="POST"
        action="?/saveMenu"
        use:enhance={() => {
          isSaving = true;
          return async ({ update }) => {
            isSaving = false;
            await update();
          };
        }}
      >
        <input type="hidden" name="date" value={data.today} />
        <input type="hidden" name="petit-dejeuner" value={mealValues['petit-dejeuner']} />
        <input type="hidden" name="dejeuner" value={mealValues['dejeuner']} />
        <input type="hidden" name="gouter" value={mealValues['gouter']} />

        <div
          class="relative overflow-hidden transition-[height] duration-500"
          style="height: {containerHeight ? containerHeight + 'px' : 'auto'}; --ease-silk: cubic-bezier(0.22, 1, 0.36, 1);"
          style:transition-timing-function="var(--ease-silk)"
        >

          {#each meals as meal, idx}
            {#if step === idx + 1}
              {@const MealIcon = meal.icon}
              <div
                bind:this={stepEls[idx + 1]}
                class="absolute inset-x-0 top-0 flex flex-col"
                in:fly={{ x: direction === 'forward' ? 20 : -20, duration: getDuration(), opacity: 0 }}
                out:fly={{ x: direction === 'forward' ? -20 : 20, duration: getDuration(), opacity: 0 }}
              >
                {#if idx > 0}
                  <div class="mb-4">
                    <button type="button" onclick={goBack} class="back-btn">
                      <ChevronLeft size={14} /> Retour
                    </button>
                  </div>
                {/if}

                <!-- Meal icon -->
                <div class="flex justify-center mb-4">
                  <div class="meal-icon" style="--icon-bg: {meal.iconBg}; --icon-border: {meal.iconBorder};">
                    <MealIcon size={28} class="text-{meal.color}-500" />
                  </div>
                </div>

                <h1 class="text-xl font-display font-bold text-warm-900 text-center mb-1">
                  {meal.label}
                </h1>
                <p class="text-sm text-warm-500 text-center mb-5">
                  {#if isExisting}
                    <span class="inline-flex items-center gap-1 text-mousse-500">
                      <Check size={12} /> Deja enregistre — modifiez si besoin
                    </span>
                  {:else}
                    Decrivez le menu pour aujourd'hui
                  {/if}
                </p>

                {#if form?.error && step === 3}
                  <div class="mb-4 p-3 bg-argile-400/10 border border-argile-400/20 rounded-xl text-argile-500 text-sm"
                    in:fly={{ y: -8, duration: 150 }}>
                    {form.error}
                  </div>
                {/if}

                <textarea
                  bind:value={mealValues[meal.key]}
                  placeholder={meal.placeholder}
                  rows={3}
                  class="menu-textarea"
                ></textarea>

                <div class="flex gap-3 mt-6">
                  {#if idx < 2}
                    <!-- Not last step -->
                    <button type="button" onclick={goForward} class="step-btn step-btn-active">
                      Continuer
                    </button>
                  {:else}
                    <!-- Last step → submit -->
                    <button type="submit" disabled={isSaving || filledCount === 0}
                      class="step-btn {isSaving || filledCount === 0 ? 'step-btn-disabled' : 'step-btn-active'}">
                      {#if isSaving}
                        Enregistrement...
                      {:else}
                        <Check size={15} class="inline -mt-px mr-1" />
                        Sauvegarder le menu
                      {/if}
                    </button>
                  {/if}
                </div>

                {#if idx < 2}
                  <button type="button" onclick={goForward} class="skip-btn">
                    Passer ce repas
                  </button>
                {/if}

                {#if idx === 0}
                  <div class="mt-5 text-center">
                    <a href="/app/overview" class="text-xs text-warm-500 hover:text-warm-700 transition-colors">
                      Annuler
                    </a>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}

        </div>
      </form>
    </Card>

    <!-- Success toast -->
    {#if showSuccess}
      <div class="success-toast" in:fly={{ y: 10, duration: 250 }} out:fly={{ y: 10, duration: 200 }}>
        <Check size={14} />
        <span>Menu enregistre</span>
      </div>
    {/if}

    <!-- Summary (after step 3) -->
    {#if step === 3}
      <div class="summary-bar" in:fly={{ y: 8, duration: 300, delay: 100 }}>
        {#each meals as meal, i}
          {@const filled = mealValues[meal.key].trim().length > 0}
          <div class="summary-item {filled ? 'summary-filled' : 'summary-empty'}">
            <span>{meal.emoji}</span>
            <span class="text-[9px] font-semibold">{filled ? 'OK' : '—'}</span>
          </div>
          {#if i < 2}
            <div class="w-3 h-px bg-warm-200/50"></div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Step dots ── */
  .step-dot {
    width: 2rem; height: 2rem; border-radius: 9999px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .step-dot-active {
    background: var(--color-miel-500); color: white;
    box-shadow: 0 4px 12px rgba(232, 145, 58, 0.25);
  }
  .step-dot-inactive {
    background: rgba(184, 158, 134, 0.15); color: var(--color-warm-500);
    box-shadow: inset 0 0 0 2px rgba(184, 158, 134, 0.3);
  }

  /* ── Date badge ── */
  .date-badge {
    font-size: 0.75rem; font-weight: 600;
    color: var(--color-miel-700);
    background: rgba(232, 145, 58, 0.08);
    border: 1px solid rgba(232, 145, 58, 0.15);
    padding: 0.375rem 1rem;
    border-radius: 9999px;
    letter-spacing: 0.01em;
  }

  /* ── Meal icon ── */
  .meal-icon {
    width: 4.5rem; height: 4.5rem; border-radius: 1.5rem;
    display: flex; align-items: center; justify-content: center;
    background: var(--icon-bg);
    border: 2px solid var(--icon-border);
    animation: icon-breathe 3s ease-in-out infinite;
  }
  @keyframes icon-breathe {
    0%, 100% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06); }
    50% { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); }
  }

  /* ── Back button ── */
  .back-btn {
    font-size: 0.8125rem; color: var(--color-warm-500);
    display: flex; align-items: center; gap: 0.25rem;
    transition: color 0.15s ease; cursor: pointer;
    background: none; border: none;
  }
  .back-btn:hover { color: var(--color-warm-700); }

  /* ── Textarea ── */
  .menu-textarea {
    display: block; width: 100%;
    border-radius: 1rem;
    padding: 1rem 1.25rem;
    font-size: 0.875rem; line-height: 1.6;
    color: var(--color-warm-900);
    background: rgba(255, 248, 238, 0.45);
    border: 1.5px solid rgba(255, 240, 220, 0.5);
    outline: none; resize: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .menu-textarea::placeholder { color: var(--color-warm-400); }
  .menu-textarea:focus {
    border-color: rgba(232, 145, 58, 0.4);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.08);
  }

  /* ── Buttons ── */
  .step-btn {
    flex: 1; padding: 0.75rem 1.5rem; border-radius: 1rem;
    font-size: 0.875rem; font-weight: 700;
    border: none; cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); outline: none;
  }
  .step-btn:focus-visible { box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3); }
  .step-btn-active {
    background: var(--color-miel-500); color: white;
    box-shadow: 0 4px 16px rgba(232, 145, 58, 0.25);
  }
  .step-btn-active:hover {
    background: var(--color-miel-600); transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.3);
  }
  .step-btn-active:active { transform: translateY(0) scale(0.98); }
  .step-btn-disabled {
    background: rgba(184, 158, 134, 0.15); color: var(--color-warm-400);
    cursor: not-allowed;
  }

  .skip-btn {
    display: block; margin: 0.75rem auto 0;
    font-size: 0.75rem; font-weight: 500;
    color: var(--color-warm-400);
    background: none; border: none; cursor: pointer;
    transition: color 0.15s ease;
  }
  .skip-btn:hover { color: var(--color-warm-600); }

  /* ── Summary bar ── */
  .summary-bar {
    display: flex; align-items: center; justify-content: center;
    gap: 0.5rem; margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 248, 238, 0.5);
    border: 1px solid rgba(255, 240, 220, 0.4);
    border-radius: 9999px;
  }
  .summary-item {
    display: flex; align-items: center; gap: 0.25rem;
    padding: 0.125rem 0.5rem; border-radius: 9999px;
    transition: all 0.2s ease;
  }
  .summary-filled {
    background: rgba(95, 160, 91, 0.1); color: var(--color-mousse-600);
  }
  .summary-empty {
    color: var(--color-warm-400);
  }

  /* ── Success toast ── */
  .success-toast {
    display: flex; align-items: center; justify-content: center;
    gap: 0.375rem; margin-top: 1rem;
    padding: 0.625rem 1.25rem;
    background: rgba(95, 160, 91, 0.12);
    border: 1px solid rgba(95, 160, 91, 0.25);
    border-radius: 1rem;
    color: var(--color-mousse-600);
    font-size: 0.8125rem; font-weight: 600;
  }

  @media (prefers-reduced-motion: reduce) {
    .step-dot, .step-btn, .skip-btn { transition: none !important; }
    .meal-icon { animation: none !important; }
  }
</style>
