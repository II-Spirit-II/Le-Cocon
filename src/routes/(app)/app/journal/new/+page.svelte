<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { Card, Button, Input, Textarea, Avatar, Callout, PlateVisual } from '$lib/ui';
  import { DURATION } from '$lib/ui/motion';
  import type { MoodLevel, MealEntry, Menu, MealLevel } from '$lib/types';
  import {
    Frown, Meh, Smile, BookOpen, Moon,
    Sunrise, Sun, Apple, Utensils, AlertTriangle,
    Sparkles, Loader, Baby, Heart, Pencil, RotateCcw,
    ChevronLeft
  } from 'lucide-svelte';
  import { getChildAvatarUrl } from '$lib/utils/avatar';

  interface Props { data: PageData; form: ActionData; }
  let { data, form }: Props = $props();

  const duplicateForm = $derived(
    form && 'duplicate' in form
      ? (form as unknown as { duplicate: boolean; existingLogId: string })
      : null
  );

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

  // ── Meals config ───────────────────────────────────────────────────
  const mealTypes = ['petit-dejeuner', 'dejeuner', 'gouter'] as const;
  type MealTypeKey = typeof mealTypes[number];

  const mealLabelIcons = {
    'petit-dejeuner': Sunrise,
    'dejeuner':       Sun,
    'gouter':         Apple
  } satisfies Record<MealTypeKey, unknown>;

  const mealLabelText: Record<MealTypeKey, string> = {
    'petit-dejeuner': 'Petit-dej.',
    'dejeuner':       'Dejeuner',
    'gouter':         'Gouter'
  };

  const moodOptions = [
    { value: 'grognon' as MoodLevel, icon: Frown,  label: 'Grognon', activeClass: 'mood-btn-grognon' },
    { value: 'calme'   as MoodLevel, icon: Meh,    label: 'Calme',   activeClass: 'mood-btn-calme' },
    { value: 'joyeux'  as MoodLevel, icon: Smile,  label: 'Joyeux',  activeClass: 'mood-btn-joyeux' }
  ];

  type NapQuality = 'agitee' | 'normale' | 'paisible';

  const napQualityOptions: Array<{ value: NapQuality; label: string; cls: string }> = [
    { value: 'agitee',   label: 'Agitee',   cls: 'nap-btn-agitee' },
    { value: 'normale',  label: 'Normale',  cls: 'nap-btn-normale' },
    { value: 'paisible', label: 'Paisible', cls: 'nap-btn-paisible' }
  ];

  type MealScore = 'non-mange' | 'peu' | 'bien' | 'tres-bien' | null;

  function scoreToLevel(score: MealScore): MealLevel | null {
    if (score === null) return null;
    const map: Record<string, MealLevel> = { 'non-mange': 0, 'peu': 1, 'bien': 2, 'tres-bien': 3 };
    return map[score] as MealLevel;
  }

  function levelToScore(level: MealLevel | null): MealScore {
    if (level === null) return null;
    return (['non-mange', 'peu', 'bien', 'tres-bien'] as const)[level];
  }

  // ── Menus ──────────────────────────────────────────────────────────
  const menusData = $derived(data.menus as Menu[]);
  const hasMenus = $derived(menusData.length > 0);

  function getMenuDesc(mealType: MealTypeKey): string {
    return menusData.find(m => m.mealType === mealType)?.description ?? '';
  }

  // ── State ──────────────────────────────────────────────────────────
  let selectedChildId = $state(untrack(() => data.preselectedChildId ?? ''));
  let selectedDate = $state(untrack(() => data.today));
  let mood = $state<MoodLevel>('calme');
  let notes = $state('');
  let changes = $state(3);
  let isSubmitting = $state(false);

  let mealScores = $state<Record<MealTypeKey, MealScore>>({
    'petit-dejeuner': null, 'dejeuner': null, 'gouter': null
  });

  let mealDescriptions = $state<Record<MealTypeKey, string>>(untrack(() => {
    const menus = data.menus as Menu[];
    return {
      'petit-dejeuner': menus.find(m => m.mealType === 'petit-dejeuner')?.description ?? '',
      'dejeuner':       menus.find(m => m.mealType === 'dejeuner')?.description ?? '',
      'gouter':         menus.find(m => m.mealType === 'gouter')?.description ?? ''
    };
  }));

  let customMeal = $state<Record<MealTypeKey, boolean>>({
    'petit-dejeuner': false, 'dejeuner': false, 'gouter': false
  });

  let hasNap = $state(false);
  let napStart = $state(untrack(() => data.defaultNapStart ?? '13:00'));
  let napEnd = $state(untrack(() => data.defaultNapEnd ?? '15:00'));
  let napQuality = $state<NapQuality>('normale');

  let hasHealthNote = $state(false);
  let healthSymptoms = $state('');
  let healthNotes = $state('');

  let aiGenerating = $state(false);
  let aiError = $state('');
  let aiGenerated = $state(false);

  // ── Derived ────────────────────────────────────────────────────────
  const selectedChild = $derived(data.children.find(c => c.id === selectedChildId));
  const step1Valid = $derived(!!selectedChildId && !!selectedDate);

  function buildMeals(): MealEntry[] {
    const out: MealEntry[] = [];
    for (const t of mealTypes) {
      const score = mealScores[t];
      if (score !== null) {
        out.push({ type: t, description: mealDescriptions[t].trim(), quantity: score });
      }
    }
    return out;
  }

  function handlePlateChange(mealType: MealTypeKey, level: MealLevel | null) {
    mealScores[mealType] = levelToScore(level);
  }

  function enableCustomMeal(mealType: MealTypeKey) {
    customMeal[mealType] = true;
  }

  function resetToMenuMeal(mealType: MealTypeKey) {
    customMeal[mealType] = false;
    mealDescriptions[mealType] = getMenuDesc(mealType);
  }

  const mealsJson = $derived(JSON.stringify(buildMeals()));
  const napJson = $derived(hasNap ? JSON.stringify({ startTime: napStart, endTime: napEnd, quality: napQuality }) : '');
  const healthJson = $derived(hasHealthNote && (healthSymptoms || healthNotes)
    ? JSON.stringify({ symptoms: healthSymptoms || undefined, notes: healthNotes || undefined })
    : '');

  function selectChild(id: string) {
    selectedChildId = id;
    direction = 'forward';
    step = 2;
  }

  // ── AI note generation ─────────────────────────────────────────────
  async function generateNote() {
    if (aiGenerating || !selectedChildId) return;
    aiGenerating = true;
    aiError = '';

    const child = data.children.find(c => c.id === selectedChildId);
    if (!child) { aiGenerating = false; return; }

    const payload = [{
      childId: selectedChildId,
      childName: child.firstName,
      meals: buildMeals(),
      nap: hasNap ? { startTime: napStart, endTime: napEnd, quality: napQuality } : null,
      mood,
      health: healthSymptoms || healthNotes || '',
      changes
    }];

    try {
      const res = await fetch('/app/journal/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ children: payload })
      });
      const result = await res.json();
      if (result.success && result.notes) {
        const note = Object.values(result.notes as Record<string, string>)[0];
        if (note) {
          notes = note;
          aiGenerated = true;
          setTimeout(() => { aiGenerated = false; }, 2000);
        }
      }
      if (!result.success) aiError = result.error ?? 'Erreur lors de la generation.';
    } catch {
      aiError = "Impossible de contacter l'assistant IA.";
    } finally {
      aiGenerating = false;
    }
  }

  // Re-measure when collapsible sections toggle
  function toggleNap() {
    hasNap = !hasNap;
    if (browser) setTimeout(measureStep, 250);
  }
  function toggleHealth() {
    hasHealthNote = !hasHealthNote;
    if (browser) setTimeout(measureStep, 250);
  }
</script>

<div class="min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4 sm:p-8">
  <div class="w-full max-w-lg">

    <!-- Progress -->
    <div class="flex items-center justify-center gap-2 mb-6">
      {#each [1, 2, 3] as s}
        <div class="step-dot {step >= s ? 'step-dot-active' : 'step-dot-inactive'}">
          {s}
        </div>
        {#if s < 3}
          <div class="w-8 h-1 rounded-full transition-colors duration-300 {step > s ? 'bg-miel-500' : 'bg-warm-200/60'}"></div>
        {/if}
      {/each}
    </div>

    <Card padding="lg">
      <form
        id="new-journal-form"
        method="POST"
        use:enhance={() => {
          isSubmitting = true;
          return async ({ update }) => {
            isSubmitting = false;
            update();
          };
        }}
      >
        <input type="hidden" name="childId" value={selectedChildId} />
        <input type="hidden" name="date" value={selectedDate} />
        <input type="hidden" name="mood" value={mood} />
        <input type="hidden" name="changes" value={changes} />
        <input type="hidden" name="meals" value={mealsJson} />
        <input type="hidden" name="nap" value={napJson} />
        <input type="hidden" name="health" value={healthJson} />
        <input type="hidden" name="notes" value={notes} />

        <div
          class="relative overflow-hidden transition-[height] duration-500"
          style="height: {containerHeight ? containerHeight + 'px' : 'auto'}; --ease-silk: cubic-bezier(0.22, 1, 0.36, 1);"
          style:transition-timing-function="var(--ease-silk)"
        >

          <!-- ═══ STEP 1 — Enfant & Date ═══ -->
          {#if step === 1}
            <div
              bind:this={stepEls[1]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'backward' ? -20 : 0, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: -20, duration: getDuration(), opacity: 0 }}
            >
              <div class="flex justify-center mb-5">
                <div class="journal-icon">
                  <BookOpen size={28} class="text-miel-500" />
                </div>
              </div>

              <h1 class="text-xl font-display font-bold text-warm-900 text-center mb-1">
                Nouveau carnet
              </h1>
              <p class="text-sm text-warm-600 text-center mb-6">
                Pour quel enfant souhaitez-vous rediger ?
              </p>

              {#if data.children.length === 0}
                <div class="text-center py-4">
                  <p class="text-sm text-warm-500 mb-4">Aucun enfant enregistre</p>
                  <Button variant="primary" href="/app/children/add">Ajouter un enfant</Button>
                </div>
              {:else}
                <div class="space-y-2 mb-5">
                  {#each data.children as child, i}
                    <button
                      type="button"
                      onclick={() => selectChild(child.id)}
                      class="child-card"
                      style="--delay: {i * 50}ms"
                    >
                      <Avatar name="{child.firstName} {child.lastName}" size="md" />
                      <div class="flex-1 min-w-0 text-left">
                        <p class="text-sm font-semibold text-warm-900">{child.firstName}</p>
                        <p class="text-xs text-warm-500">{child.lastName}</p>
                      </div>
                      <div class="child-card-arrow">
                        <ChevronLeft size={14} class="rotate-180" />
                      </div>
                    </button>
                  {/each}
                </div>

                <Input
                  type="date"
                  label="Date du carnet"
                  name="_date"
                  bind:value={selectedDate}
                />
              {/if}

              <div class="mt-6 text-center">
                <a href="/app/overview" class="text-xs text-warm-500 hover:text-warm-700 transition-colors">
                  Annuler
                </a>
              </div>
            </div>

          <!-- ═══ STEP 2 — Humeur & Repas ═══ -->
          {:else if step === 2}
            <div
              bind:this={stepEls[2]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'forward' ? 20 : -20, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: direction === 'forward' ? -20 : 20, duration: getDuration(), opacity: 0 }}
            >
              <div class="mb-4 flex items-center justify-between">
                <button type="button" onclick={goBack} class="back-btn">
                  <ChevronLeft size={14} /> Retour
                </button>
                {#if selectedChild}
                  <span class="text-xs font-medium text-miel-600 bg-miel-100 px-2.5 py-1 rounded-full">
                    {selectedChild.firstName}
                  </span>
                {/if}
              </div>

              {#if duplicateForm?.duplicate}
                <Callout variant="warning" class="mb-4">
                  Un carnet existe deja pour cet enfant a cette date.
                  {#snippet actions()}
                    <Button href="/app/journal/{duplicateForm.existingLogId}/edit" variant="ghost">
                      Modifier le carnet existant
                    </Button>
                  {/snippet}
                </Callout>
              {:else if form?.error}
                <Callout variant="warning" class="mb-4">{form.error}</Callout>
              {/if}

              <h2 class="text-lg font-display font-bold text-warm-900 text-center mb-1">
                Comment s'est passee la journee ?
              </h2>
              <p class="text-xs text-warm-500 text-center mb-5">Humeur et repas</p>

              <!-- Mood -->
              <div class="mb-6">
                <p class="section-label mb-3">Humeur generale</p>
                <div class="flex gap-2">
                  {#each moodOptions as opt, i}
                    {@const Icon = opt.icon}
                    <button
                      type="button"
                      onclick={() => mood = opt.value}
                      class="mood-btn {mood === opt.value ? opt.activeClass : 'mood-btn-default'}"
                      style="--delay: {i * 40}ms"
                    >
                      <Icon size={20} />
                      <span class="text-xs font-semibold">{opt.label}</span>
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Meals -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <p class="section-label">Repas</p>
                  {#if hasMenus}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-mousse-400/12 text-mousse-500 rounded-full text-[10px] font-medium">
                      <Utensils size={10} /> Menu defini
                    </span>
                  {:else}
                    <a href="/app/journal/menu" class="inline-flex items-center gap-1 px-2 py-0.5 bg-soleil-400/12 text-soleil-500 rounded-full text-[10px] font-medium hover:bg-soleil-400/20 transition-colors">
                      <AlertTriangle size={10} /> Definir le menu
                    </a>
                  {/if}
                </div>

                <div class="grid grid-cols-3 gap-3">
                  {#each mealTypes as mealType, i}
                    {@const MealIcon = mealLabelIcons[mealType]}
                    {@const menuDesc = getMenuDesc(mealType)}
                    {@const showCustomInput = !hasMenus || customMeal[mealType]}
                    <div class="meal-card" style="--delay: {i * 60}ms">
                      <div class="flex items-center gap-1 mb-2">
                        <MealIcon size={12} class="text-warm-500" />
                        <span class="text-[10px] font-bold text-warm-700">{mealLabelText[mealType]}</span>
                      </div>

                      {#if showCustomInput}
                        <input
                          type="text"
                          bind:value={mealDescriptions[mealType]}
                          placeholder="Menu..."
                          class="meal-desc-input"
                        />
                        {#if hasMenus && menuDesc}
                          <button type="button" onclick={() => resetToMenuMeal(mealType)} class="meal-reset-btn">
                            <RotateCcw size={8} /> Menu
                          </button>
                        {/if}
                      {:else if menuDesc}
                        <p class="text-[9px] text-warm-500 italic text-center leading-snug mb-1 line-clamp-2 px-0.5">
                          {menuDesc}
                        </p>
                        <button type="button" onclick={() => enableCustomMeal(mealType)} class="meal-reset-btn">
                          <Pencil size={8} /> Modifier
                        </button>
                      {/if}

                      <div class="mt-auto pt-2">
                        <PlateVisual
                          level={scoreToLevel(mealScores[mealType])}
                          size="sm"
                          interactive
                          onchange={(lv) => handlePlateChange(mealType, lv)}
                        />
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

              <div class="flex gap-3 mt-8">
                <button type="button" onclick={goForward} class="step-next-btn step-next-btn-active">
                  Continuer
                </button>
              </div>
            </div>

          <!-- ═══ STEP 3 — Sieste, Changes, Santé, Notes ═══ -->
          {:else if step === 3}
            <div
              bind:this={stepEls[3]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'forward' ? 20 : -20, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: direction === 'forward' ? -20 : 20, duration: getDuration(), opacity: 0 }}
            >
              <div class="mb-4 flex items-center justify-between">
                <button type="button" onclick={goBack} class="back-btn">
                  <ChevronLeft size={14} /> Retour
                </button>
                {#if selectedChild}
                  <span class="text-xs font-medium text-miel-600 bg-miel-100 px-2.5 py-1 rounded-full">
                    {selectedChild.firstName}
                  </span>
                {/if}
              </div>

              <h2 class="text-lg font-display font-bold text-warm-900 text-center mb-1">
                Details de la journee
              </h2>
              <p class="text-xs text-warm-500 text-center mb-5">Sieste, changes, sante et notes</p>

              <!-- Nap -->
              <div class="section-block">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Moon size={14} class="text-bleu-400" />
                    <p class="section-label">Sieste</p>
                  </div>
                  <button type="button" onclick={toggleNap} class="toggle-btn {hasNap ? 'toggle-btn-on' : ''}">
                    {hasNap ? 'Oui' : 'Non'}
                  </button>
                </div>
                {#if hasNap}
                  <div transition:slide={{ duration: 220 }} class="mt-3 space-y-3">
                    <div class="flex gap-1.5">
                      {#each napQualityOptions as opt}
                        <button
                          type="button"
                          onclick={() => napQuality = opt.value}
                          class="quality-btn {napQuality === opt.value ? opt.cls : 'quality-btn-default'}"
                        >
                          {opt.label}
                        </button>
                      {/each}
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <Input type="time" label="Debut" bind:value={napStart} />
                      <Input type="time" label="Fin" bind:value={napEnd} />
                    </div>
                  </div>
                {/if}
              </div>

              <!-- Changes -->
              <div class="section-block">
                <div class="flex items-center gap-2 mb-3">
                  <Baby size={14} class="text-bleu-400" />
                  <p class="section-label">Changes</p>
                </div>
                <div class="flex items-center gap-4">
                  <button type="button" onclick={() => changes = Math.max(0, changes - 1)}
                    class="counter-btn">&minus;</button>
                  <span class="text-2xl font-bold text-warm-900 w-10 text-center tabular-nums">{changes}</span>
                  <button type="button" onclick={() => changes++}
                    class="counter-btn">+</button>
                  <span class="text-warm-500 text-xs">change{changes !== 1 ? 's' : ''}</span>
                </div>
              </div>

              <!-- Health -->
              <div class="section-block">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Heart size={14} class="text-argile-400" />
                    <p class="section-label">Sante</p>
                  </div>
                  <button type="button" onclick={toggleHealth}
                    class="toggle-btn {hasHealthNote ? 'toggle-btn-warn' : ''}">
                    {hasHealthNote ? 'A signaler' : 'RAS'}
                  </button>
                </div>
                {#if hasHealthNote}
                  <div transition:slide={{ duration: 220 }} class="mt-3 space-y-3">
                    <Input label="Symptomes" placeholder="Ex: leger rhume..." bind:value={healthSymptoms} />
                    <Textarea label="Notes" placeholder="Details..." bind:value={healthNotes} rows={2} />
                  </div>
                {/if}
              </div>

              <!-- Notes + AI -->
              <div class="section-block">
                <div class="flex items-center justify-between mb-3">
                  <p class="section-label">Notes de la journee</p>
                  {#if selectedChildId}
                    <button type="button" onclick={generateNote} disabled={aiGenerating}
                      class="ai-btn {aiGenerating ? 'ai-btn-loading' : ''}">
                      {#if aiGenerating}
                        <Loader size={12} class="animate-spin" /> Generation...
                      {:else}
                        <Sparkles size={12} /> Generer via IA
                      {/if}
                    </button>
                  {/if}
                </div>
                {#if aiError}
                  <p class="text-xs text-argile-500 mb-2">{aiError}</p>
                {/if}
                <Textarea
                  name="_notes"
                  placeholder="Comment s'est passee la journee ?"
                  bind:value={notes}
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>

              <div class="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  class="step-next-btn {isSubmitting ? 'step-next-btn-disabled' : 'step-next-btn-active'}"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer le carnet'}
                </button>
              </div>

              <div class="mt-4 text-center">
                <a href="/app/overview" class="text-xs text-warm-500 hover:text-warm-700 transition-colors">
                  Annuler
                </a>
              </div>
            </div>
          {/if}

        </div>
      </form>
    </Card>
  </div>
</div>

<style>
  /* ── Step dots ── */
  .step-dot {
    width: 2rem; height: 2rem; border-radius: 9999px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8125rem; font-weight: 600;
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

  /* ── Journal icon ── */
  .journal-icon {
    width: 4.5rem; height: 4.5rem; border-radius: 1.5rem;
    display: flex; align-items: center; justify-content: center;
    background: rgba(232, 145, 58, 0.08);
    border: 2px solid rgba(232, 145, 58, 0.2);
    box-shadow: 0 8px 24px rgba(232, 145, 58, 0.1);
    animation: icon-breathe 3s ease-in-out infinite;
  }
  @keyframes icon-breathe {
    0%, 100% { box-shadow: 0 8px 24px rgba(232, 145, 58, 0.1); }
    50% { box-shadow: 0 8px 32px rgba(232, 145, 58, 0.18); }
  }

  /* ── Child cards ── */
  .child-card {
    display: flex; align-items: center; gap: 0.75rem;
    width: 100%; padding: 0.875rem 1rem; border-radius: 1rem;
    background: rgba(255, 248, 238, 0.45);
    border: 1.5px solid rgba(255, 240, 220, 0.4);
    cursor: pointer; outline: none;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: card-appear 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }
  .child-card:hover {
    background: rgba(255, 248, 238, 0.7);
    border-color: rgba(232, 145, 58, 0.25);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.1);
  }
  .child-card:active { transform: translateY(0) scale(0.98); }
  .child-card:focus-visible { box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3); }
  @keyframes card-appear {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .child-card-arrow {
    width: 1.75rem; height: 1.75rem; border-radius: 0.5rem;
    display: flex; align-items: center; justify-content: center;
    background: rgba(232, 145, 58, 0.08); color: var(--color-miel-500);
    flex-shrink: 0; transition: all 0.2s ease;
  }
  .child-card:hover .child-card-arrow {
    background: rgba(232, 145, 58, 0.15); color: var(--color-miel-700);
    transform: translateX(2px);
  }

  /* ── Back button ── */
  .back-btn {
    font-size: 0.8125rem; color: var(--color-warm-500);
    display: flex; align-items: center; gap: 0.25rem;
    transition: color 0.15s ease; cursor: pointer;
    background: none; border: none;
  }
  .back-btn:hover { color: var(--color-warm-700); }

  /* ── Section label ── */
  .section-label {
    font-size: 0.75rem; font-weight: 700; color: var(--color-warm-700);
    text-transform: uppercase; letter-spacing: 0.04em;
  }

  /* ── Section block ── */
  .section-block {
    padding: 1rem 0;
    border-bottom: 1px solid rgba(184, 158, 134, 0.12);
  }
  .section-block:last-of-type { border-bottom: none; }

  /* ── Mood buttons ── */
  .mood-btn {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.375rem;
    padding: 0.75rem 0.5rem; border-radius: 1rem;
    border: 2px solid transparent; cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); outline: none;
    animation: card-appear 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }
  .mood-btn:active { transform: scale(0.95); }
  .mood-btn:focus-visible { box-shadow: 0 0 0 2px rgba(232, 145, 58, 0.3); }
  .mood-btn-default {
    background: rgba(255, 255, 255, 0.3); border-color: rgba(184, 158, 134, 0.2);
    color: var(--color-warm-500);
  }
  .mood-btn-default:hover { background: rgba(255, 248, 238, 0.5); }
  .mood-btn-grognon { background: rgba(194, 99, 90, 0.1); border-color: var(--color-argile-400); color: var(--color-argile-500); }
  .mood-btn-calme { background: rgba(229, 176, 58, 0.1); border-color: var(--color-soleil-400); color: var(--color-soleil-600); }
  .mood-btn-joyeux { background: rgba(95, 160, 91, 0.1); border-color: var(--color-mousse-400); color: var(--color-mousse-500); }

  /* ── Meal cards ── */
  .meal-card {
    display: flex; flex-direction: column; align-items: center;
    padding: 0.75rem 0.5rem;
    background: rgba(255, 248, 238, 0.5);
    border: 1px solid rgba(255, 240, 220, 0.4);
    border-radius: 1rem;
    animation: card-appear 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }
  .meal-desc-input {
    width: 100%; text-align: center; font-size: 0.625rem;
    padding: 0.25rem 0.375rem; border-radius: 0.375rem;
    border: 1px solid rgba(184, 158, 134, 0.2);
    background: rgba(255, 255, 255, 0.4);
    color: var(--color-warm-700); outline: none;
    transition: border-color 0.15s ease;
  }
  .meal-desc-input:focus { border-color: rgba(232, 145, 58, 0.4); }
  .meal-reset-btn {
    display: flex; align-items: center; gap: 0.25rem; margin: 0.25rem auto 0;
    font-size: 0.5625rem; color: var(--color-warm-500); cursor: pointer;
    background: none; border: none; transition: color 0.15s ease;
  }
  .meal-reset-btn:hover { color: var(--color-miel-600); }

  /* ── Toggle button ── */
  .toggle-btn {
    padding: 0.375rem 0.875rem; border-radius: 0.625rem;
    font-size: 0.75rem; font-weight: 600;
    border: 1.5px solid rgba(184, 158, 134, 0.25);
    background: rgba(255, 255, 255, 0.3); color: var(--color-warm-600);
    cursor: pointer; transition: all 0.2s ease; outline: none;
  }
  .toggle-btn:hover { border-color: rgba(184, 158, 134, 0.4); }
  .toggle-btn-on {
    background: rgba(106, 150, 171, 0.1);
    border-color: var(--color-bleu-400); color: var(--color-bleu-500);
  }
  .toggle-btn-warn {
    background: rgba(194, 99, 90, 0.1);
    border-color: var(--color-argile-400); color: var(--color-argile-500);
  }

  /* ── Quality buttons ── */
  .quality-btn {
    flex: 1; padding: 0.5rem; border-radius: 0.625rem;
    font-size: 0.6875rem; font-weight: 600;
    border: 1.5px solid transparent; cursor: pointer;
    transition: all 0.2s ease; outline: none;
  }
  .quality-btn-default {
    background: rgba(255, 255, 255, 0.3); border-color: rgba(184, 158, 134, 0.2);
    color: var(--color-warm-500);
  }
  .quality-btn-default:hover { background: rgba(255, 248, 238, 0.5); }
  .nap-btn-agitee { background: rgba(194, 101, 58, 0.1); border-color: var(--color-sienne-400); color: var(--color-sienne-700); }
  .nap-btn-normale { background: rgba(106, 150, 171, 0.1); border-color: var(--color-bleu-400); color: var(--color-bleu-500); }
  .nap-btn-paisible { background: rgba(95, 160, 91, 0.1); border-color: var(--color-mousse-400); color: var(--color-mousse-600); }

  /* ── Counter button ── */
  .counter-btn {
    width: 2.5rem; height: 2.5rem; border-radius: 0.75rem;
    background: rgba(255, 248, 238, 0.5);
    border: 1px solid rgba(184, 158, 134, 0.2);
    color: var(--color-warm-800); font-size: 1.125rem; font-weight: 700;
    cursor: pointer; transition: all 0.15s ease; outline: none;
  }
  .counter-btn:hover { background: rgba(232, 145, 58, 0.08); border-color: rgba(232, 145, 58, 0.2); }
  .counter-btn:active { transform: scale(0.93); }

  /* ── AI button ── */
  .ai-btn {
    display: flex; align-items: center; gap: 0.375rem;
    padding: 0.375rem 0.75rem; border-radius: 0.625rem;
    font-size: 0.6875rem; font-weight: 600;
    background: rgba(232, 145, 58, 0.06); border: 1px solid rgba(232, 145, 58, 0.2);
    color: var(--color-miel-700); cursor: pointer;
    transition: all 0.15s ease; outline: none;
  }
  .ai-btn:hover { background: rgba(232, 145, 58, 0.12); border-color: rgba(232, 145, 58, 0.3); }
  .ai-btn-loading { cursor: not-allowed; opacity: 0.7; }

  /* ── Next button ── */
  .step-next-btn {
    flex: 1; padding: 0.75rem 1.5rem; border-radius: 1rem;
    font-size: 0.875rem; font-weight: 700;
    border: none; cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); outline: none;
  }
  .step-next-btn:focus-visible { box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3); }
  .step-next-btn-active {
    background: var(--color-miel-500); color: white;
    box-shadow: 0 4px 16px rgba(232, 145, 58, 0.25);
  }
  .step-next-btn-active:hover {
    background: var(--color-miel-600); transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.3);
  }
  .step-next-btn-active:active { transform: translateY(0) scale(0.98); }
  .step-next-btn-disabled {
    background: rgba(184, 158, 134, 0.15); color: var(--color-warm-400);
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .child-card, .mood-btn, .meal-card { animation: none !important; }
    .step-dot, .step-next-btn, .child-card, .toggle-btn, .mood-btn, .quality-btn, .counter-btn { transition: none !important; }
    .journal-icon { animation: none !important; }
  }
</style>
