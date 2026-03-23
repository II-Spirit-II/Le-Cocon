<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import { PageHeader, Card, Button, Input, Textarea, Select, Callout, PlateVisual } from '$lib/ui';
  import type { MoodLevel, MealEntry, Menu, MealLevel } from '$lib/types';
  import {
    Frown, Meh, Smile, BookOpen, Moon,
    Sunrise, Sun, Apple, Utensils, AlertTriangle,
    Sparkles, Loader, Baby, Heart, Pencil, RotateCcw
  } from 'lucide-svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const duplicateForm = $derived(
    form && 'duplicate' in form
      ? (form as unknown as { duplicate: boolean; existingLogId: string })
      : null
  );

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

  // Meals
  let mealScores = $state<Record<MealTypeKey, MealScore>>({
    'petit-dejeuner': null,
    'dejeuner': null,
    'gouter': null
  });

  // Descriptions pre-filled from today's menu
  let mealDescriptions = $state<Record<MealTypeKey, string>>(untrack(() => {
    const menus = data.menus as Menu[];
    return {
      'petit-dejeuner': menus.find(m => m.mealType === 'petit-dejeuner')?.description ?? '',
      'dejeuner':       menus.find(m => m.mealType === 'dejeuner')?.description ?? '',
      'gouter':         menus.find(m => m.mealType === 'gouter')?.description ?? ''
    };
  }));

  let customMeal = $state<Record<MealTypeKey, boolean>>({
    'petit-dejeuner': false,
    'dejeuner': false,
    'gouter': false
  });

  // Nap
  let hasNap = $state(false);
  let napStart = $state(untrack(() => data.defaultNapStart ?? '13:00'));
  let napEnd = $state(untrack(() => data.defaultNapEnd ?? '15:00'));
  let napQuality = $state<NapQuality>('normale');

  // Health
  let hasHealthNote = $state(false);
  let healthSymptoms = $state('');
  let healthNotes = $state('');

  // AI
  let aiGenerating = $state(false);
  let aiError = $state('');
  let aiGenerated = $state(false);

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

  const mealsJson = $derived(JSON.stringify(buildMeals()));
  const napJson = $derived(hasNap ? JSON.stringify({ startTime: napStart, endTime: napEnd, quality: napQuality }) : '');
  const healthJson = $derived(hasHealthNote && (healthSymptoms || healthNotes)
    ? JSON.stringify({ symptoms: healthSymptoms || undefined, notes: healthNotes || undefined })
    : '');

  // ── AI generation ──────────────────────────────────────────────────

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
      if (!result.success) aiError = result.error ?? 'Erreur lors de la génération.';
    } catch {
      aiError = "Impossible de contacter l'assistant IA.";
    } finally {
      aiGenerating = false;
    }
  }

  function submitForm() {
    (document.getElementById('new-journal-form') as HTMLFormElement)?.requestSubmit();
  }
</script>

<PageHeader
  title="Nouveau carnet"
  description="Documentez la journée d'un enfant"
>
  {#snippet actions()}
    <Button variant="ghost" href="/app/overview" disabled={isSubmitting}>Annuler</Button>
    <Button
      variant="primary"
      onclick={submitForm}
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Enregistrement…' : 'Enregistrer le carnet'}
    </Button>
  {/snippet}
</PageHeader>

{#if data.children.length === 0}
  <Card padding="lg">
    <div class="text-center py-12">
      <div class="flex justify-center mb-4">
        <BookOpen size={64} class="text-warm-500" />
      </div>
      <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
        Aucun enfant à documenter
      </h3>
      <p class="text-warm-700 mb-6 max-w-md mx-auto">
        Ajoutez d'abord des enfants avant de créer des carnets.
      </p>
      <Button variant="primary" href="/app/children/add">Ajouter un enfant</Button>
    </div>
  </Card>
{:else}
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
    <div class="max-w-2xl space-y-6">
      {#if duplicateForm?.duplicate}
        <Callout variant="warning">
          Un carnet existe déjà pour cet enfant à cette date.
          {#snippet actions()}
            <Button href="/app/journal/{duplicateForm.existingLogId}/edit" variant="ghost">
              Modifier le carnet existant
            </Button>
          {/snippet}
        </Callout>
      {:else if form?.error}
        <Callout variant="warning">{form.error}</Callout>
      {/if}

      <!-- Hidden fields -->
      <input type="hidden" name="meals" value={mealsJson} />
      <input type="hidden" name="nap" value={napJson} />
      <input type="hidden" name="health" value={healthJson} />
      <input type="hidden" name="mood" value={mood} />
      <input type="hidden" name="changes" value={changes} />

      <!-- Enfant & Date -->
      <Card padding="md">
        <h3 class="font-semibold text-warm-900 mb-4">Informations générales</h3>
        <div class="grid sm:grid-cols-2 gap-4">
          <Select
            name="childId"
            label="Enfant"
            bind:value={selectedChildId}
            options={data.children.map(c => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
            required
            disabled={isSubmitting}
          />
          <Input
            type="date"
            name="date"
            label="Date"
            bind:value={selectedDate}
            required
            disabled={isSubmitting}
          />
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
          {#if hasMenus}
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-mousse-400/15 text-mousse-500 rounded-full text-xs font-medium border border-mousse-400/20">
              <Utensils size={12} />
              Menu du jour défini
            </span>
          {:else}
            <a
              href="/app/journal/menu"
              class="inline-flex items-center gap-1.5 px-3 py-1 bg-soleil-400/15 text-soleil-500 rounded-full text-xs font-medium border border-soleil-400/20 hover:bg-soleil-400/20 transition-colors"
            >
              <AlertTriangle size={12} />
              Définir le menu
            </a>
          {/if}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {#each mealTypes as mealType}
            {@const MealIcon = mealLabelIcons[mealType]}
            {@const menuDesc = getMenuDesc(mealType)}
            {@const showCustomInput = !hasMenus || customMeal[mealType]}
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
                  {#if hasMenus && menuDesc}
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
          {#if selectedChildId}
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
          {/if}
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
{/if}
