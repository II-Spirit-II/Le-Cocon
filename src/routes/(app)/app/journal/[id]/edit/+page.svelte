<script lang="ts">
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { PageHeader, Card, Button, Input, Textarea, Callout, Avatar, PlateVisual } from '$lib/ui';
  import type { MoodLevel, MealEntry, Menu, MealLevel } from '$lib/types';
  import {
    Frown, Meh, Smile, Moon,
    Sunrise, Sun, Apple, Utensils,
    Sparkles, Loader, Baby, Heart, Pencil, RotateCcw
  } from 'lucide-svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  // ── Config UI ──────────────────────────────────────────────────────

  const mealTypes = ['petit-dejeuner', 'dejeuner', 'gouter'] as const;
  type MealTypeKey = typeof mealTypes[number];

  const mealLabelIcons = {
    'petit-dejeuner': Sunrise,
    'dejeuner':       Sun,
    'gouter':         Apple
  } satisfies Record<MealTypeKey, unknown>;

  const mealLabelText: Record<MealTypeKey, string> = {
    'petit-dejeuner': 'Petit-déj.',
    'dejeuner':       'Déjeuner',
    'gouter':         'Goûter'
  };

  const moodOptions = [
    { value: 'grognon' as MoodLevel, icon: Frown,  label: 'Grognon', activeClass: 'bg-argile-400/15 border-argile-400 text-argile-400' },
    { value: 'calme'   as MoodLevel, icon: Meh,    label: 'Calme',   activeClass: 'bg-soleil-400/15 border-soleil-400 text-soleil-600' },
    { value: 'joyeux'  as MoodLevel, icon: Smile,  label: 'Joyeux',  activeClass: 'bg-mousse-400/15 border-mousse-400 text-mousse-500' }
  ];

  type NapQuality = 'agitee' | 'normale' | 'paisible';

  const napQualityOptions: Array<{ value: NapQuality; label: string; activeClass: string }> = [
    { value: 'agitee',   label: 'Agitée',   activeClass: 'bg-sienne-400/15 border-sienne-400 text-sienne-700' },
    { value: 'normale',  label: 'Normale',  activeClass: 'bg-bleu-400/15 border-bleu-400 text-bleu-500' },
    { value: 'paisible', label: 'Paisible', activeClass: 'bg-mousse-400/15 border-mousse-400 text-mousse-600' }
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

  function getMenuDesc(mealType: MealTypeKey): string {
    return menusData.find(m => m.mealType === mealType)?.description ?? '';
  }

  // ── Initialisation depuis le journal existant ─────────────────────

  const _init = untrack(() => {
    const j = data.journal;
    const menus = data.menus as Menu[];

    function getInitialScore(meals: MealEntry[], type: string): MealScore {
      const m = meals.find(ml => ml.type === type);
      if (!m) return null;
      const valid: MealScore[] = ['non-mange', 'peu', 'bien', 'tres-bien'];
      return valid.includes(m.quantity as MealScore) ? (m.quantity as MealScore) : null;
    }

    function getInitialDesc(meals: MealEntry[], type: string): string {
      const m = meals.find(ml => ml.type === type);
      if (m?.description) return m.description;
      return menus.find(menu => menu.mealType === type)?.description ?? '';
    }

    // Detect if existing description differs from the menu (= custom mode)
    function isCustom(meals: MealEntry[], type: string): boolean {
      const m = meals.find(ml => ml.type === type);
      if (!m || !m.description) return false;
      const menuDesc = menus.find(menu => menu.mealType === type)?.description ?? '';
      return !!menuDesc && m.description !== menuDesc;
    }

    return {
      mood:           j.mood as MoodLevel,
      notes:          j.notes,
      changes:        j.changes,
      mealScores: {
        'petit-dejeuner': getInitialScore(j.meals, 'petit-dejeuner'),
        'dejeuner':       getInitialScore(j.meals, 'dejeuner'),
        'gouter':         getInitialScore(j.meals, 'gouter')
      } as Record<MealTypeKey, MealScore>,
      mealDescriptions: {
        'petit-dejeuner': getInitialDesc(j.meals, 'petit-dejeuner'),
        'dejeuner':       getInitialDesc(j.meals, 'dejeuner'),
        'gouter':         getInitialDesc(j.meals, 'gouter')
      } as Record<MealTypeKey, string>,
      customMeal: {
        'petit-dejeuner': isCustom(j.meals, 'petit-dejeuner'),
        'dejeuner':       isCustom(j.meals, 'dejeuner'),
        'gouter':         isCustom(j.meals, 'gouter')
      } as Record<MealTypeKey, boolean>,
      hasNap:         j.nap !== null,
      napStart:       j.nap?.startTime ?? (data.defaultNapStart ?? '13:00'),
      napEnd:         j.nap?.endTime   ?? (data.defaultNapEnd   ?? '15:00'),
      napQuality:     (j.nap?.quality ?? 'normale') as NapQuality,
      hasHealthNote:  j.health !== null && !!(j.health?.symptoms || j.health?.notes || j.health?.temperature || j.health?.medication),
      healthSymptoms: j.health?.symptoms ?? '',
      healthNotes:    j.health?.notes    ?? ''
    };
  });

  // ── State ──────────────────────────────────────────────────────────

  let mood             = $state(_init.mood);
  let notes            = $state(_init.notes);
  let changes          = $state(_init.changes);
  let isSubmitting     = $state(false);
  let mealScores       = $state<Record<MealTypeKey, MealScore>>(_init.mealScores);
  let mealDescriptions = $state<Record<MealTypeKey, string>>(_init.mealDescriptions);
  let customMeal       = $state<Record<MealTypeKey, boolean>>(_init.customMeal);
  let hasNap           = $state(_init.hasNap);
  let napStart         = $state(_init.napStart);
  let napEnd           = $state(_init.napEnd);
  let napQuality       = $state<NapQuality>(_init.napQuality);
  let hasHealthNote    = $state(_init.hasHealthNote);
  let healthSymptoms   = $state(_init.healthSymptoms);
  let healthNotes      = $state(_init.healthNotes);

  // AI
  let aiGenerating = $state(false);
  let aiError      = $state('');
  let aiGenerated  = $state(false);

  // ── Build meals for submission ─────────────────────────────────────

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

  // ── Computed JSON for form ─────────────────────────────────────────

  const mealsJson  = $derived(JSON.stringify(buildMeals()));
  const napJson    = $derived(hasNap ? JSON.stringify({ startTime: napStart, endTime: napEnd, quality: napQuality }) : '');
  const healthJson = $derived(hasHealthNote && (healthSymptoms || healthNotes)
    ? JSON.stringify({ symptoms: healthSymptoms || undefined, notes: healthNotes || undefined })
    : '');

  // ── Format date ────────────────────────────────────────────────────

  function formatDate(dateString: string): string {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  // ── AI generation ──────────────────────────────────────────────────

  async function generateNote() {
    if (aiGenerating) return;
    aiGenerating = true;
    aiError = '';

    const child = data.child;
    if (!child) { aiGenerating = false; return; }

    const payload = [{
      childId:   child.id,
      childName: child.firstName,
      meals:     buildMeals(),
      nap:       hasNap ? { startTime: napStart, endTime: napEnd, quality: napQuality } : null,
      mood,
      health:    healthSymptoms || healthNotes || '',
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
      if (!result.success) aiError = result.error ?? 'Erreur lors de la génération.';
    } catch {
      aiError = "Impossible de contacter l'assistant IA.";
    } finally {
      aiGenerating = false;
    }
  }

  function submitForm() {
    (document.getElementById('edit-journal-form') as HTMLFormElement)?.requestSubmit();
  }
</script>

<PageHeader
  title="Modifier le carnet"
  description="Mettez à jour les informations de la journée"
>
  {#snippet actions()}
    <Button variant="ghost" href="/app/overview" disabled={isSubmitting}>Annuler</Button>
    <Button
      variant="primary"
      onclick={submitForm}
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Sauvegarde…' : 'Sauvegarder'}
    </Button>
  {/snippet}
</PageHeader>

<form
  id="edit-journal-form"
  method="POST"
  use:enhance={() => {
    isSubmitting = true;
    return async ({ update }) => {
      isSubmitting = false;
      update();
    };
  }}
>
  <div class="max-w-2xl space-y-6">
    {#if form?.error}
      <Callout variant="warning">{form.error}</Callout>
    {/if}

    <!-- Hidden fields -->
    <input type="hidden" name="meals" value={mealsJson} />
    <input type="hidden" name="nap" value={napJson} />
    <input type="hidden" name="health" value={healthJson} />
    <input type="hidden" name="mood" value={mood} />
    <input type="hidden" name="changes" value={changes} />

    <!-- Enfant & Date (lecture seule) -->
    <Card padding="md">
      <h3 class="font-semibold text-warm-900 mb-4">Informations générales</h3>
      <div class="flex items-center gap-4 p-4 bg-warm-50 rounded-xl">
        <Avatar name={data.child?.firstName ?? 'Enfant'} size="md" />
        <div>
          <p class="font-medium text-warm-900">
            {data.child?.firstName ?? 'Enfant'} {data.child?.lastName ?? ''}
          </p>
          <p class="text-sm text-warm-600 capitalize">
            {formatDate(data.journal.date)}
          </p>
        </div>
      </div>
    </Card>

    <!-- Humeur -->
    <Card padding="md">
      <h3 class="font-semibold text-warm-900 mb-4">Humeur générale</h3>
      <div class="flex flex-wrap gap-3">
        {#each moodOptions as option}
          {@const OptionIcon = option.icon}
          <button
            type="button"
            onclick={() => mood = option.value}
            disabled={isSubmitting}
            class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-[color,background-color,border-color,transform] active:scale-[0.97]
              {mood === option.value
                ? option.activeClass
                : 'border-warm-200 text-warm-600 hover:bg-warm-50 hover:border-warm-300'}
              {isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}"
          >
            <OptionIcon size={18} />
            <span>{option.label}</span>
          </button>
        {/each}
      </div>
    </Card>

    <!-- Repas -->
    <Card padding="md">
      <div class="flex items-center justify-between mb-5">
        <h3 class="font-semibold text-warm-900">Repas</h3>
        {#if menusData.length > 0}
          <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-mousse-400/15 text-mousse-500 rounded-full text-xs font-medium border border-mousse-400/20">
            <Utensils size={12} />
            Menu du jour défini
          </span>
        {/if}
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {#each mealTypes as mealType}
          {@const MealIcon = mealLabelIcons[mealType]}
          {@const menuDesc = getMenuDesc(mealType)}
          {@const showCustomInput = !menusData.length || customMeal[mealType]}
          <div class="bg-warm-50 rounded-xl p-4 flex flex-col items-center gap-3">
            <div class="flex items-center gap-1.5">
              <MealIcon size={15} class="text-warm-600" />
              <span class="text-sm font-bold text-warm-800">{mealLabelText[mealType]}</span>
            </div>

            {#if showCustomInput}
              <div class="w-full space-y-1.5">
                <input
                  type="text"
                  bind:value={mealDescriptions[mealType]}
                  placeholder="Menu de cet enfant…"
                  disabled={isSubmitting}
                  class="w-full text-xs text-center rounded-lg border border-warm-200 bg-warm-50/80 px-2 py-1.5 text-warm-700
                         placeholder:text-warm-500 focus-visible:border-miel-400 focus-visible:ring-1 focus-visible:ring-miel-200 transition-colors"
                />
                {#if menusData.length > 0 && menuDesc}
                  <button
                    type="button"
                    onclick={() => resetToMenuMeal(mealType)}
                    class="flex items-center gap-1 text-[10px] text-warm-500 hover:text-miel-600 transition-colors mx-auto"
                  >
                    <RotateCcw size={10} />
                    Revenir au menu du jour
                  </button>
                {/if}
              </div>
            {:else}
              <div class="w-full space-y-1.5">
                <p class="text-xs text-warm-600 italic text-center leading-snug px-1">
                  «&nbsp;{menuDesc}&nbsp;»
                </p>
                <button
                  type="button"
                  onclick={() => enableCustomMeal(mealType)}
                  class="flex items-center gap-1 text-[10px] text-warm-500 hover:text-miel-600 transition-colors mx-auto"
                >
                  <Pencil size={10} />
                  Personnaliser
                </button>
              </div>
            {/if}

            <PlateVisual
              level={scoreToLevel(mealScores[mealType])}
              size="md"
              interactive
              onchange={(lv) => handlePlateChange(mealType, lv)}
            />
          </div>
        {/each}
      </div>
    </Card>

    <Card padding="md">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Moon size={16} class="text-bleu-400" />
          <h3 class="font-semibold text-warm-900">Sieste</h3>
        </div>
        <button
          type="button"
          onclick={() => hasNap = !hasNap}
          disabled={isSubmitting}
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-[color,background-color,border-color,transform] active:scale-[0.97]
            {hasNap
              ? 'bg-bleu-100 border-bleu-400 text-bleu-800'
              : 'border-warm-200 text-warm-600 hover:border-warm-300 hover:bg-warm-50'}"
        >
          <Moon size={15} />
          {hasNap ? 'Oui' : 'Non'}
        </button>
      </div>
      {#if hasNap}
        <div transition:slide={{ duration: 220 }} class="space-y-4">
          <div class="flex flex-wrap gap-2">
            {#each napQualityOptions as opt}
              <button
                type="button"
                onclick={() => napQuality = opt.value}
                disabled={isSubmitting}
                class="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-[color,background-color,border-color,transform] active:scale-[0.97]
                  {napQuality === opt.value
                    ? opt.activeClass
                    : 'border-warm-200 text-warm-600 hover:border-warm-300 hover:bg-warm-50'}"
              >
                {opt.label}
              </button>
            {/each}
          </div>
          <div class="grid grid-cols-2 gap-4">
            <Input type="time" label="Début" bind:value={napStart} disabled={isSubmitting} />
            <Input type="time" label="Fin" bind:value={napEnd} disabled={isSubmitting} />
          </div>
        </div>
      {/if}
    </Card>

    <Card padding="md">
      <div class="flex items-center gap-2 mb-4">
        <Baby size={16} class="text-bleu-400" />
        <h3 class="font-semibold text-warm-900">Changes</h3>
      </div>
      <div class="flex items-center gap-4">
        <button
          type="button"
          onclick={() => changes = Math.max(0, changes - 1)}
          disabled={isSubmitting}
          class="w-10 h-10 rounded-xl bg-warm-100 hover:bg-warm-200 text-warm-800 text-lg font-bold transition-colors disabled:opacity-50 active:scale-95"
        >&minus;</button>
        <span class="text-3xl font-bold text-warm-900 w-12 text-center tabular-nums">{changes}</span>
        <button
          type="button"
          onclick={() => changes++}
          disabled={isSubmitting}
          class="w-10 h-10 rounded-xl bg-warm-100 hover:bg-warm-200 text-warm-800 text-lg font-bold transition-colors disabled:opacity-50 active:scale-95"
        >+</button>
        <span class="text-warm-600 text-sm">change{changes !== 1 ? 's' : ''}</span>
      </div>
    </Card>

    <Card padding="md">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Heart size={16} class="text-argile-400" />
          <h3 class="font-semibold text-warm-900">Santé</h3>
        </div>
        <button
          type="button"
          onclick={() => hasHealthNote = !hasHealthNote}
          disabled={isSubmitting}
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-[color,background-color,border-color,transform] active:scale-[0.97]
            {hasHealthNote
              ? 'bg-argile-400/15 border-argile-400 text-argile-500'
              : 'border-warm-200 text-warm-600 hover:border-warm-300 hover:bg-warm-50'}"
        >
          {hasHealthNote ? 'Note ajoutée' : 'Ajouter'}
        </button>
      </div>
      {#if hasHealthNote}
        <div transition:slide={{ duration: 220 }} class="space-y-4">
          <Input
            label="Symptômes observés"
            placeholder="Ex: léger rhume, fièvre légère…"
            bind:value={healthSymptoms}
            disabled={isSubmitting}
          />
          <Textarea
            label="Notes complémentaires"
            placeholder="Détails supplémentaires…"
            bind:value={healthNotes}
            rows={2}
            disabled={isSubmitting}
          />
        </div>
      {/if}
    </Card>

    <!-- Notes + IA -->
    <Card padding="md">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-warm-900">Notes de la journée</h3>
        <button
          type="button"
          onclick={generateNote}
          disabled={aiGenerating || isSubmitting}
          class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-[color,background-color,border-color,transform] active:scale-[0.97]
            {aiGenerating
              ? 'bg-miel-200 text-miel-500 cursor-not-allowed'
              : 'bg-miel-50 border border-miel-200 text-miel-700 hover:bg-miel-100 hover:border-miel-300'}"
        >
          {#if aiGenerating}
            <Loader size={14} class="animate-spin" /> Génération…
          {:else}
            <Sparkles size={14} /> Générer via IA
          {/if}
        </button>
      </div>
      {#if aiError}
        <Callout variant="warning" class="mb-3">
          {aiError}
          {#snippet actions()}<Button size="sm" variant="ghost" onclick={() => (aiError = '')}>Fermer</Button>{/snippet}
        </Callout>
      {/if}
      <div class="{aiGenerated ? 'animate-ai-note' : ''}">
        <Textarea
          name="notes"
          placeholder="Comment s'est passée la journée ? Moments forts, activités, progrès…"
          bind:value={notes}
          rows={4}
          disabled={isSubmitting}
        />
      </div>
    </Card>
  </div>
</form>
