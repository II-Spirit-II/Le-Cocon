<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { fly, slide } from 'svelte/transition';
  import { enhance } from '$app/forms';
  import { PageHeader, Card, Button, Avatar, Callout, ConfirmDialog, PlateVisual } from '$lib/ui';
  import type { PageData, ActionData } from './$types';
  import type { MealEntry, NapEntry, MoodLevel, Menu, MealLevel, Child, DailyLog } from '$lib/types';
  import {
    Frown, Meh, Smile,
    Sunrise, Sun, Apple,
    Calendar, AlertTriangle, Moon, Baby,
    Utensils, CheckCheck, Heart, Sparkles, Loader, Plus,
    ArrowRight, ArrowLeft, Send, UtensilsCrossed
  } from 'lucide-svelte';

  interface Props { data: PageData; form: ActionData; }
  let { data, form }: Props = $props();

  // ── Config UI ──────────────────────────────────────────────────────────

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
    { value: 'grognon' as MoodLevel, icon: Frown,  label: 'Grognon', activeClass: 'bg-argile-400/15 border-argile-400 text-argile-500'         },
    { value: 'calme'   as MoodLevel, icon: Meh,    label: 'Calme',   activeClass: 'bg-soleil-400/15 border-soleil-400 text-soleil-600' },
    { value: 'joyeux'  as MoodLevel, icon: Smile,  label: 'Joyeux',  activeClass: 'bg-mousse-400/15 border-mousse-400 text-mousse-500'   }
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

  interface ChildEntry {
    meals:      Record<MealTypeKey, MealScore>;
    mood:       MoodLevel;
    hasNap:     boolean;
    napQuality: NapQuality;
    changes:    number;
    health:     string;
    notes:      string;
  }

  function getInitialMealScore(meals: MealEntry[], t: string): MealScore {
    const m = meals.find(m => m.type === t);
    if (!m) return null;
    const valid: MealScore[] = ['non-mange', 'peu', 'bien', 'tres-bien'];
    return valid.includes(m.quantity as MealScore) ? (m.quantity as MealScore) : null;
  }

  function initEntry(childId: string): ChildEntry {
    const ex  = data.existingLogs.find((l: DailyLog) => l.childId === childId);
    const nap = ex?.nap as NapEntry | null | undefined;
    return {
      meals: {
        'petit-dejeuner': getInitialMealScore(ex?.meals ?? [], 'petit-dejeuner'),
        'dejeuner':       getInitialMealScore(ex?.meals ?? [], 'dejeuner'),
        'gouter':         getInitialMealScore(ex?.meals ?? [], 'gouter')
      },
      mood:       (ex?.mood ?? 'calme') as MoodLevel,
      hasNap:     nap !== null && nap !== undefined,
      napQuality: (nap?.quality as NapQuality) ?? 'normale',
      changes:    ex?.changes ?? 0,
      health:     (ex?.health as { notes?: string } | null)?.notes ?? '',
      notes:      ex?.notes ?? ''
    };
  }

  let entries = $state<Record<string, ChildEntry>>(
    untrack(() => Object.fromEntries(data.children.map((c: Child) => [c.id, initEntry(c.id)])))
  );

  let healthExpanded = $state<Record<string, boolean>>({});

  let step      = $state<'saisie' | 'notes'>('saisie');
  let published = $state(false);
  let saveError = $state('');

  const allNapOn = $derived(
    data.children.length > 0 && data.children.every((c: Child) => entries[c.id]?.hasNap)
  );

  function toggleAllNap() {
    const v = !allNapOn;
    for (const id of Object.keys(entries)) entries[id].hasNap = v;
  }

  function applyNapQualityToAll(q: NapQuality) {
    for (const id of Object.keys(entries)) { entries[id].hasNap = true; entries[id].napQuality = q; }
  }

  let aiGenerating    = $state(false);
  let aiGeneratingFor = $state<Record<string, boolean>>({});
  let aiError         = $state('');
  let aiGenerated     = $state<Record<string, boolean>>({});

  const anyGenerating = $derived(
    aiGenerating || Object.values(aiGeneratingFor).some(v => v)
  );

  function isGeneratingForChild(id: string): boolean {
    return aiGenerating || (aiGeneratingFor[id] ?? false);
  }

  function buildMealsForChild(childId: string): MealEntry[] {
    const e = entries[childId];
    const out: MealEntry[] = [];
    for (const t of mealTypes) {
      const score = e.meals[t];
      if (score !== null) {
        const desc = (data.menus as Menu[]).find(m => m.mealType === t)?.description ?? '';
        out.push({ type: t, description: desc, quantity: score });
      }
    }
    return out;
  }

  async function generateAllNotes() {
    if (aiGenerating) return;
    aiGenerating = true;
    aiError = '';

    const payload = data.children.map((c: Child) => {
      const e = entries[c.id];
      return {
        childId:   c.id,
        childName: c.firstName,
        meals:     buildMealsForChild(c.id),
        nap:       e.hasNap
          ? { startTime: data.defaultNapStart ?? '13:00', endTime: data.defaultNapEnd ?? '15:00', quality: e.napQuality }
          : null,
        mood:    e.mood,
        health:  e.health,
        changes: e.changes
      };
    });

    try {
      const res    = await fetch('/app/journal/batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ children: payload })
      });
      const result = await res.json();
      if (result.success && result.notes) {
        for (const [childId, note] of Object.entries(result.notes as Record<string, string>)) {
          entries[childId].notes = note;
          aiGenerated[childId]   = true;
          setTimeout(() => { aiGenerated[childId] = false; }, 2000);
        }
      }
      if (!result.success)     aiError = result.error   ?? 'Erreur lors de la génération.';
      else if (result.warning) aiError = result.warning;
    } catch {
      aiError = "Impossible de contacter l'assistant IA.";
    } finally {
      aiGenerating = false;
    }
  }

  async function generateNoteForChild(childId: string) {
    if (anyGenerating) return;
    aiGeneratingFor = { ...aiGeneratingFor, [childId]: true };
    aiError = '';

    const child = data.children.find((c: Child) => c.id === childId);
    if (!child) { aiGeneratingFor = { ...aiGeneratingFor, [childId]: false }; return; }

    const e = entries[childId];
    const payload = [{
      childId,
      childName: child.firstName,
      meals:     buildMealsForChild(childId),
      nap:       e.hasNap
        ? { startTime: data.defaultNapStart ?? '13:00', endTime: data.defaultNapEnd ?? '15:00', quality: e.napQuality }
        : null,
      mood:    e.mood,
      health:  e.health,
      changes: e.changes
    }];

    try {
      const res    = await fetch('/app/journal/batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ children: payload })
      });
      const result = await res.json();
      if (result.success && result.notes) {
        for (const [cid, note] of Object.entries(result.notes as Record<string, string>)) {
          entries[cid].notes = note;
          aiGenerated[cid]   = true;
          setTimeout(() => { aiGenerated[cid] = false; }, 2000);
        }
      }
      if (!result.success) aiError = result.error ?? 'Erreur lors de la génération.';
    } catch {
      aiError = "Impossible de contacter l'assistant IA.";
    } finally {
      aiGeneratingFor = { ...aiGeneratingFor, [childId]: false };
    }
  }

  function applyMoodToAll(mood: MoodLevel) {
    for (const id of Object.keys(entries)) entries[id].mood = mood;
  }
  function applyMealScoreToAll(t: MealTypeKey, score: MealScore) {
    for (const id of Object.keys(entries)) entries[id].meals[t] = score;
  }
  function handlePlateChange(childId: string, t: MealTypeKey, level: MealLevel | null) {
    entries[childId].meals[t] = levelToScore(level);
  }

  function buildPayload() {
    const out: Array<{
      childId: string; meals: MealEntry[]; mood: MoodLevel;
      nap: NapEntry | null; health: { notes: string } | null;
      changes: number; notes: string;
    }> = [];

    for (const child of data.children) {
      const e     = entries[child.id];
      const meals = buildMealsForChild(child.id);
      const nap: NapEntry | null = e.hasNap
        ? { startTime: data.defaultNapStart ?? '13:00', endTime: data.defaultNapEnd ?? '15:00', quality: e.napQuality }
        : null;
      const health = e.health.trim() ? { notes: e.health.trim() } : null;
      const hasData = meals.length > 0 || e.mood !== 'calme' || nap !== null
        || e.changes > 0 || health !== null || e.notes.trim().length > 0;
      if (hasData) out.push({ childId: child.id, meals, mood: e.mood, nap, health, changes: e.changes, notes: e.notes });
    }
    return out;
  }

  let isSaving             = $state(false);
  let showMenuWarning      = $state(false);
  let showIncompleteWarning = $state(false);
  let pendingPayload       = $state('');

  const hasMenus    = $derived((data.menus as Menu[]).length > 0);

  const filledCount = $derived(
    data.children.filter((c: Child) => mealTypes.every(t => entries[c.id].meals[t] !== null)).length
  );

  const incompleteChildren = $derived(
    data.children
      .filter((c: Child) => !mealTypes.every(t => entries[c.id].meals[t] !== null))
      .map((c: Child) => c.firstName)
  );

  const incompleteWarningDesc = $derived(
    incompleteChildren.length === data.children.length
      ? `Aucun enfant n'a encore ses repas saisis. Renseignez les 3 repas (petit-déjeuner, déjeuner, goûter) pour chaque enfant avant de continuer.`
      : `Les repas de ${incompleteChildren.length} enfant${incompleteChildren.length > 1 ? 's' : ''} sont incomplets : ${incompleteChildren.join(', ')}. Chaque enfant doit avoir ses 3 repas saisis.`
  );

  function submitFormInternal(s: string) {
    isSaving = true;
    showMenuWarning = false;
    const f = document.getElementById('batch-form') as HTMLFormElement;
    (f.querySelector('input[name="entries"]') as HTMLInputElement).value = s;
    f.requestSubmit();
  }

  function handleSaveAndContinue() {
    if (filledCount < data.children.length) { showIncompleteWarning = true; return; }
    const s = JSON.stringify(buildPayload());
    if (!hasMenus) { pendingPayload = s; showMenuWarning = true; return; }
    submitFormInternal(s);
  }

  function handlePublish() {
    const payload = buildPayload();
    if (payload.length === 0) {
      published = true; // nothing to save, just mark done
      return;
    }
    submitFormInternal(JSON.stringify(payload));
  }

  function formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
</script>

<PageHeader title="Saisie rapide" description="Carnets de tous les enfants en un seul écran">
  {#snippet actions()}
    <Button variant="ghost" href="/app/journal/menu">
      <UtensilsCrossed size={16} />
        Menu du jour
    </Button>
    <Button variant="ghost" href="/app/overview">← Retour</Button>
  {/snippet}
</PageHeader>

<div class="space-y-5">

  {#if aiError}
    <Callout variant="warning" icon="⚠️">
      {aiError}
      {#snippet actions()}<Button size="sm" variant="ghost" onclick={() => (aiError = '')}>Fermer</Button>{/snippet}
    </Callout>
  {/if}
  {#if saveError}
    <Callout variant="warning">{saveError}</Callout>
  {/if}

  <!-- Date + menu -->
  <div class="flex flex-wrap items-center gap-3">
    <div class="flex items-center gap-2 px-4 py-2 bg-miel-50 rounded-xl border border-miel-100">
      <Calendar size={16} class="text-miel-600" />
      <span class="font-medium text-miel-900 capitalize text-sm">{formatDate(data.today)}</span>
    </div>
    {#if hasMenus}
      <div class="flex items-center gap-2 px-3 py-2 bg-mousse-400/15 rounded-xl border border-mousse-400/20">
        <Utensils size={14} class="text-mousse-500" />
        <span class="text-sm font-medium text-mousse-500">{(data.menus as Menu[]).length}/3 repas définis</span>
      </div>
    {:else}
      <a href="/app/journal/menu" class="flex items-center gap-2 px-3 py-2 bg-soleil-400/15 rounded-xl border border-soleil-400/20 hover:bg-soleil-400/20 transition-colors">
        <AlertTriangle size={14} class="text-soleil-500" />
        <span class="text-sm font-medium text-soleil-500">Définir le menu →</span>
      </a>
    {/if}
    <div class="ml-auto px-3 py-1.5 rounded-xl border text-sm font-semibold
                {filledCount === data.children.length
                  ? 'bg-mousse-400/15 border-mousse-400/20 text-mousse-500'
                  : filledCount > 0
                    ? 'bg-soleil-400/15 border-soleil-400/20 text-soleil-500'
                    : 'bg-warm-50 border-warm-200 text-warm-700'}">
      {filledCount} / {data.children.length} {filledCount === data.children.length ? 'complets' : 'à compléter'}
    </div>
  </div>

  {#if data.children.length === 0}
    <Card padding="lg">
      <div class="text-center py-12">
        <Baby size={64} class="text-warm-500 mx-auto mb-4" />
        <h3 class="text-xl font-display font-bold text-warm-900 mb-2">Tout est en ordre :)</h3>
        <p class="text-warm-700 mb-6">Les enfants n'ayant pas encore de carnet aujourd'hui s'afficheront ici.</p>
        <Button variant="primary" href="/app/children/add">Ajouter un enfant</Button>
      </div>
    </Card>

  {:else if step === 'saisie'}
    <div out:fly={{ y: -20, duration: 280, opacity: 0 }}
         in:fly={{ y: 20, duration: 380, opacity: 0 }}>

      <Card padding="none">

        <div class="flex items-center justify-between px-6 py-3.5 border-b border-warm-100 glass-2 rounded-t-2xl">
          <div class="flex items-center gap-2.5">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-miel-100 text-miel-700 text-xs font-semibold">
              <span class="w-4 h-4 rounded-full bg-miel-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
              Saisie des données
            </span>
            <span class="text-warm-400 text-sm">→</span>
            <span class="text-sm text-warm-400">Notes parents</span>
          </div>
          <button
            type="button"
            onclick={handleSaveAndContinue}
            disabled={isSaving}
            class="inline-flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-[color,background-color,transform]
                   {isSaving
                     ? 'bg-miel-200 text-miel-400 cursor-not-allowed'
                     : 'bg-miel-500 text-white hover:bg-miel-600 shadow-sm hover:shadow active:scale-[0.98]'}"
          >
            {#if isSaving}
              <Loader size={15} class="animate-spin" /> Sauvegarde...
            {:else}
              Continuer - Notes IA <ArrowRight size={15} />
            {/if}
          </button>
        </div>

        <div class="overflow-x-auto">
          <div class="min-w-full">

            <div class="flex items-stretch px-6 border-b-2 border-warm-200 bg-warm-50">

              <div class="w-52 py-4 flex items-center">
                <span class="text-base font-bold text-warm-900">Enfant</span>
              </div>

              <div class="w-60 border-l-2 border-warm-300 px-4 py-3 flex flex-col items-center gap-2">
                <div class="flex items-center gap-1.5">
                  <Moon size={15} class="text-bleu-500" />
                  <span class="text-base font-bold text-warm-900">Sieste</span>
                </div>
                <button
                  type="button"
                  onclick={toggleAllNap}
                  class="h-8 px-3 rounded-lg text-xs font-semibold border-2 transition-colors flex items-center gap-1.5
                         {allNapOn ? 'bg-bleu-100 border-bleu-400 text-bleu-800'
                                   : 'bg-warm-50 border-warm-300 text-warm-700 hover:border-warm-400 hover:bg-warm-50'}"
                >
                  <Moon size={12} />{allNapOn ? 'Oui → tous' : 'Non → tous'}
                </button>
                {#if allNapOn}
                  <div transition:slide={{ duration: 220, axis: 'y' }} class="flex gap-1 justify-center">
                    {#each napQualityOptions as opt}
                      <button
                        type="button"
                        onclick={() => applyNapQualityToAll(opt.value)}
                        class="h-7 px-2 text-[10px] font-semibold rounded border transition-colors whitespace-nowrap {opt.activeClass} hover:opacity-90"
                      >{opt.label}</button>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="w-44 border-l-2 border-warm-300 px-4 py-3 flex flex-col items-center gap-2">
                <div class="flex items-center gap-1.5">
                  <Smile size={15} class="text-soleil-500" />
                  <span class="text-base font-bold text-warm-900">Humeur</span>
                </div>
                <div class="flex gap-1.5">
                  {#each moodOptions as mood}
                    {@const MoodIcon = mood.icon}
                    <button
                      type="button"
                      onclick={() => applyMoodToAll(mood.value)}
                      title="{mood.label} → tous"
                      class="h-7 w-7 flex items-center justify-center rounded-md text-warm-600 border border-warm-300 bg-warm-50 hover:bg-warm-100 hover:text-warm-800 transition-colors"
                    ><MoodIcon size={14} /></button>
                  {/each}
                </div>
              </div>

              <div class="border-l-2 border-warm-300 flex flex-1">
                {#each mealTypes as mealType, i}
                  {@const MealIcon = mealLabelIcons[mealType]}
                  <div class="flex-1 min-w-[155px] {i > 0 ? 'border-l border-warm-200' : ''} px-4 py-3 flex flex-col items-center gap-2">
                    <div class="flex items-center gap-1.5">
                      <MealIcon size={15} class="text-warm-600" />
                      <span class="text-base font-bold text-warm-900">{mealLabelText[mealType]}</span>
                    </div>
                    <button
                      type="button"
                      onclick={() => applyMealScoreToAll(mealType, 'bien')}
                      class="h-7 px-2.5 text-[10px] font-semibold bg-mousse-400/15 text-mousse-500 border border-mousse-400/20 rounded-lg hover:bg-mousse-400/20 transition-colors flex items-center gap-1"
                    ><CheckCheck size={10} /> bien → tous</button>
                  </div>
                {/each}
              </div>

              <div class="w-28 border-l-2 border-warm-300 px-4 py-3 flex items-center justify-center">
                <span class="text-base font-bold text-warm-900">Changes</span>
              </div>

              <div class="w-52 border-l-2 border-warm-300 px-4 py-3 flex items-center gap-2">
                <Heart size={15} class="text-argile-400" />
                <span class="text-base font-bold text-warm-900">Santé</span>
              </div>

            </div>

            <div class="divide-y divide-warm-100">
              {#each data.children as child (child.id)}
                {@const entry = entries[child.id]}
                {@const isFilled = Object.values(entry.meals).some(s => s !== null) || entry.hasNap
                  || entry.mood !== 'calme' || entry.changes > 0 || entry.health.trim() || entry.notes.trim()}
                <div class="flex items-start px-6 py-3 hover:bg-warm-50/60 transition-colors {isFilled ? 'bg-mousse-400/5' : ''}">

                  <div class="w-52 flex items-center gap-3 pt-1.5">
                    <Avatar name={child.firstName} size="sm" />
                    <span class="text-sm font-medium text-warm-900 truncate">{child.firstName} {child.lastName}</span>
                  </div>

                  <div class="w-60 border-l-2 border-warm-200 px-4 flex flex-col items-center gap-1.5 pt-1 pb-1">
                    <button
                      type="button"
                      onclick={() => { entries[child.id].hasNap = !entry.hasNap; }}
                      class="h-8 px-3 rounded-lg text-sm font-semibold border-2 transition-colors flex items-center gap-1.5
                             {entry.hasNap
                               ? 'bg-bleu-100 border-bleu-400 text-bleu-800'
                               : 'bg-warm-50 border-warm-300 text-warm-700 hover:border-warm-400 hover:bg-warm-50'}"
                    >
                      <Moon size={14} />{entry.hasNap ? 'Oui' : 'Non'}
                    </button>
                    {#if entry.hasNap}
                      <div transition:slide={{ duration: 220, axis: 'y' }} class="flex gap-1 justify-center">
                        {#each napQualityOptions as opt}
                          <button
                            type="button"
                            onclick={() => { entries[child.id].napQuality = opt.value; }}
                            class="h-8 px-2 text-xs font-semibold rounded-lg border-2 transition-colors whitespace-nowrap
                                   {entry.napQuality === opt.value
                                     ? opt.activeClass
                                     : 'border-warm-200 text-warm-600 hover:bg-warm-100 hover:border-warm-300'}"
                          >{opt.label}</button>
                        {/each}
                      </div>
                    {/if}
                  </div>

                  <div class="w-44 border-l-2 border-warm-200 px-4 flex gap-1.5 justify-center pt-1">
                    {#each moodOptions as mood}
                      {@const MoodIcon = mood.icon}
                      <button
                        type="button"
                        onclick={() => { entries[child.id].mood = mood.value; }}
                        title={mood.label}
                        class="h-8 w-8 flex items-center justify-center rounded-lg transition-colors border-2
                               {entry.mood === mood.value
                                 ? mood.activeClass
                                 : 'border-warm-200 text-warm-500 hover:bg-warm-100 hover:border-warm-300 hover:text-warm-700'}"
                      ><MoodIcon size={17} /></button>
                    {/each}
                  </div>

                  <div class="border-l-2 border-warm-200 flex flex-1">
                    {#each mealTypes as mealType, i}
                      <div class="flex-1 min-w-[155px] {i > 0 ? 'border-l border-warm-200' : ''} px-4 py-1 flex justify-center">
                        <PlateVisual
                          level={scoreToLevel(entry.meals[mealType])}
                          size="md"
                          interactive
                          onchange={(lv) => handlePlateChange(child.id, mealType, lv)}
                        />
                      </div>
                    {/each}
                  </div>

                  <div class="w-28 border-l-2 border-warm-200 px-4 flex items-center gap-1 justify-center pt-1">
                    <button
                      type="button"
                      onclick={() => { entries[child.id].changes = Math.max(0, entry.changes - 1); }}
                      class="h-8 w-8 flex items-center justify-center rounded-lg bg-warm-100 hover:bg-warm-200 text-warm-800 font-bold text-base transition-colors"
                    >−</button>
                    <span class="w-7 text-center text-base font-bold text-warm-900">{entry.changes}</span>
                    <button
                      type="button"
                      onclick={() => { entries[child.id].changes = entry.changes + 1; }}
                      class="h-8 w-8 flex items-center justify-center rounded-lg bg-warm-100 hover:bg-warm-200 text-warm-800 font-bold text-base transition-colors"
                    >+</button>
                  </div>

                  <div class="w-52 border-l-2 border-warm-200 px-4 py-1 flex items-center">
                    <div class="relative h-8 w-full">
                      <button
                        type="button"
                        onclick={async () => {
                          healthExpanded[child.id] = true;
                          await tick();
                          const el = document.querySelector(`[data-health-id="${child.id}"]`) as HTMLInputElement | null;
                          el?.focus();
                        }}
                        class="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-warm-300
                               text-warm-500 hover:border-argile-400 hover:text-argile-500 hover:bg-argile-400/10
                               transition-opacity duration-150
                               {healthExpanded[child.id] || entry.health ? 'opacity-0 pointer-events-none' : 'opacity-100'}"
                        title="Ajouter une note santé"
                      ><Plus size={15} /></button>
                      <input
                        type="text"
                        bind:value={entries[child.id].health}
                        data-health-id={child.id}
                        placeholder="Symptômes, observations..."
                        onblur={() => { if (!entries[child.id].health) healthExpanded[child.id] = false; }}
                        class="absolute inset-0 w-full h-full text-xs rounded-lg border border-warm-300 bg-warm-50 px-3 text-warm-800
                               placeholder:text-warm-500 focus-visible:border-argile-400 focus-visible:ring-1 focus-visible:ring-argile-400/30
                               transition-opacity duration-150
                               {healthExpanded[child.id] || entry.health ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                               {entry.health ? 'border-argile-400 bg-argile-400/10' : ''}"
                      />
                    </div>
                  </div>

                </div>
              {/each}
            </div>

          </div>
        </div>

      </Card>

    </div>

  {:else}
    <div out:fly={{ y: -20, duration: 280, opacity: 0 }}
         in:fly={{ y: 20, duration: 380, opacity: 0 }}>

      {#if published}
        <div class="py-16 text-center">
          <div class="w-16 h-16 rounded-full bg-mousse-400/15 flex items-center justify-center mx-auto mb-4">
            <Send size={28} class="text-mousse-500" />
          </div>
          <h3 class="text-xl font-bold text-warm-900 mb-2">Journaux publiés !</h3>
          <p class="text-warm-600 mb-6">Les journaux du jour ont été sauvegardés avec succès.</p>
          <Button variant="primary" href="/app/overview">Voir le tableau de bord →</Button>
        </div>

      {:else}
        <div class="space-y-8">

        <div class="flex items-center justify-between">
          <button
            type="button"
            onclick={() => step = 'saisie'}
            class="inline-flex items-center gap-2 text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors"
          >
            <ArrowLeft size={16} /> Retour à la saisie
          </button>
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-miel-100 text-miel-700 text-xs font-semibold">
            <span class="w-4 h-4 rounded-full bg-miel-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
            Notes pour les parents
          </span>
        </div>

        <Card padding="none">

          <div class="flex items-center justify-between gap-6 px-8 py-6 bg-gradient-to-r from-miel-50 via-warm-50 to-white border-b border-warm-100 rounded-t-2xl">
            <div class="flex items-center gap-4 min-w-0">
              <div class="w-12 h-12 rounded-2xl bg-miel-100 flex items-center justify-center shrink-0">
                <Sparkles size={24} class="text-miel-600" />
              </div>
              <div class="min-w-0">
                <h3 class="font-bold text-warm-900 text-lg leading-tight">Notes du jour pour les parents</h3>
                <p class="text-sm text-warm-600 mt-0.5">Messages personnalisés générés depuis les observations du tableau</p>
              </div>
            </div>
            <button
              type="button"
              onclick={generateAllNotes}
              disabled={anyGenerating}
              class="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-[color,background-color,transform]
                     {anyGenerating
                       ? 'bg-miel-200 text-miel-500 cursor-not-allowed'
                       : 'bg-miel-500 text-white hover:bg-miel-600 shadow-sm hover:shadow-md active:scale-[0.98]'}"
            >
              {#if anyGenerating}
                <Loader size={16} class="animate-spin" /> Génération...
              {:else}
                <Sparkles size={16} /> Générer toutes les notes
              {/if}
            </button>
          </div>

          <div class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {#each data.children as child (child.id)}
              {@const entry = entries[child.id]}
              <div class="rounded-xl border-2 p-4 flex flex-col gap-3 transition-all duration-300
                           {aiGenerated[child.id]
                             ? 'animate-ai-note border-miel-200 bg-miel-50/30'
                             : 'border-warm-200 glass-2 hover:border-warm-300'}">

                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <Avatar name={child.firstName} size="sm" />
                    <div class="min-w-0">
                      <p class="text-sm font-semibold text-warm-900 leading-tight truncate">{child.firstName}</p>
                      <p class="text-xs text-warm-500 leading-tight truncate">{child.lastName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onclick={() => generateNoteForChild(child.id)}
                    disabled={anyGenerating}
                    title="Regénérer"
                    class="w-8 h-8 flex items-center justify-center rounded-lg border border-warm-200 text-warm-400
                           hover:border-miel-300 hover:text-miel-600 hover:bg-miel-50 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {#if aiGeneratingFor[child.id]}
                      <Loader size={14} class="animate-spin" />
                    {:else}
                      <Sparkles size={14} />
                    {/if}
                  </button>
                </div>

                {#if isGeneratingForChild(child.id)}
                  <div class="space-y-2 py-1 px-0.5">
                    <div class="h-2.5 rounded skeleton-shimmer"></div>
                    <div class="h-2.5 rounded skeleton-shimmer" style="width:83%; animation-delay:0.12s"></div>
                    <div class="h-2.5 rounded skeleton-shimmer" style="width:60%; animation-delay:0.24s"></div>
                    <div class="h-2.5 rounded skeleton-shimmer" style="width:76%; animation-delay:0.36s"></div>
                  </div>
                {:else}
                  <textarea
                    bind:value={entries[child.id].notes}
                    placeholder="Note pour les parents..."
                    rows={entry.notes ? 4 : 3}
                    class="w-full text-xs rounded-lg border border-warm-200 px-3 py-2.5 text-warm-800
                           placeholder:text-warm-500 focus-visible:border-miel-400 focus-visible:ring-1 focus-visible:ring-miel-200
                           resize-none transition-colors leading-relaxed
                           {entry.notes ? 'bg-warm-50 border-miel-200' : 'bg-warm-50/60'}"
                  ></textarea>
                {/if}

              </div>
            {/each}
          </div>

        </Card>

        <div class="flex items-center gap-4 pb-8">
          <button
            type="button"
            onclick={handlePublish}
            disabled={isSaving}
            class="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-[color,background-color,transform]
                   {isSaving
                     ? 'bg-miel-200 text-miel-400 cursor-not-allowed'
                     : 'bg-miel-500 text-white hover:bg-miel-600 shadow-sm hover:shadow active:scale-[0.98]'}"
          >
            {#if isSaving}
              <Loader size={15} class="animate-spin" /> Publication...
            {:else}
              <Send size={15} /> Publier les journaux
            {/if}
          </button>
          <button
            type="button"
            onclick={() => { published = true; }}
            class="text-sm text-warm-500 hover:text-warm-700 transition-colors"
          >Terminer sans notes IA</button>
        </div>

        </div> <!-- /space-y-8 -->
      {/if}

    </div>
  {/if}

  <!-- Hidden form — submitted programmatically via enhance (no page reload) -->
  <form
    id="batch-form"
    method="POST"
    action="?/saveBatch"
    class="hidden"
    use:enhance={() => {
      return async ({ result }) => {
        isSaving = false;
        if (result.type === 'success') {
          if (step === 'saisie') {
            step = 'notes';
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 60);
          } else {
            published = true;
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 60);
          }
        } else if (result.type === 'failure') {
          saveError = (result.data?.error as string) ?? 'Erreur lors de la sauvegarde.';
        }
      };
    }}
  >
    <input type="hidden" name="date" value={data.today} />
    <input type="hidden" name="entries" value="" />
  </form>

</div>

<ConfirmDialog
  open={showMenuWarning}
  title="Aucun menu défini"
  description="Vous n'avez pas encore défini le menu du jour. Les descriptions des repas resteront vides dans les journaux."
  confirmLabel="Définir le menu"
  cancelLabel="Continuer sans menu"
  variant="primary"
  onconfirm={() => { showMenuWarning = false; window.location.href = '/app/journal/menu'; }}
  oncancel={() => submitFormInternal(pendingPayload)}
/>

<ConfirmDialog
  open={showIncompleteWarning}
  title="Saisie incomplète"
  description={incompleteWarningDesc}
  confirmLabel="OK, je complète"
  cancelLabel="Fermer"
  variant="danger"
  onconfirm={() => { showIncompleteWarning = false; }}
  oncancel={() => { showIncompleteWarning = false; }}
/>
