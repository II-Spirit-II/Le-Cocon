<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Card, FadeIn, PageHeader } from '$lib/ui';
  import {
    Users, CalendarX, Clock, BookOpen, Smile, Meh, Frown,
    UtensilsCrossed, Moon, Droplets, Thermometer, TrendingUp,
    Heart, BarChart3
  } from 'lucide-svelte';

  interface Props { data: PageData; }
  let { data }: Props = $props();

  const period = $derived(data.periodDays);

  function setPeriod(days: number) {
    const url = new URL($page.url);
    url.searchParams.set('period', String(days));
    goto(url.toString(), { replaceState: true, noScroll: true });
  }

  // Mood helpers
  const MOOD_CFG = {
    joyeux:  { label: 'Joyeux',  Icon: Smile, color: 'text-mousse-500', bg: 'bg-mousse-100', bar: 'bg-mousse-400' },
    calme:   { label: 'Calme',   Icon: Meh,   color: 'text-soleil-500', bg: 'bg-soleil-400/15', bar: 'bg-soleil-400' },
    grognon: { label: 'Grognon', Icon: Frown,  color: 'text-argile-500', bg: 'bg-argile-400/15', bar: 'bg-argile-400' },
  } as const;

  // Meal score label
  const mealLabel = $derived(
    data.avgMealScore >= 2.5 ? 'Excellent' :
    data.avgMealScore >= 1.5 ? 'Bon' :
    data.avgMealScore >= 0.5 ? 'Moyen' : 'Faible'
  );

  const mealColor = $derived(
    data.avgMealScore >= 2.5 ? 'text-mousse-500' :
    data.avgMealScore >= 1.5 ? 'text-miel-600' :
    data.avgMealScore >= 0.5 ? 'text-soleil-500' : 'text-argile-500'
  );

  // Nap label
  const napLabel = $derived(() => {
    const m = data.avgNapMinutes;
    if (m === 0) return 'Pas de données';
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h${min > 0 ? String(min).padStart(2, '0') : ''}` : `${min}min`;
  });

  // Completion ring
  const ringCircumference = 2 * Math.PI * 36;
  const ringOffset = $derived(ringCircumference - (data.completionRate / 100) * ringCircumference);
</script>

<PageHeader title="Statistiques">
  {#snippet actions()}
    <div class="flex gap-1 glass-2 rounded-xl p-1">
      <button
        type="button"
        onclick={() => setPeriod(7)}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer
          {period === 7 ? 'bg-miel-500 text-white shadow-sm' : 'text-warm-600 hover:text-warm-900'}">
        7 jours
      </button>
      <button
        type="button"
        onclick={() => setPeriod(30)}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer
          {period === 30 ? 'bg-miel-500 text-white shadow-sm' : 'text-warm-600 hover:text-warm-900'}">
        30 jours
      </button>
    </div>
  {/snippet}
</PageHeader>

<div class="stats-grid">

  <!-- ══════ ROW 1: Key metrics ══════ -->
  <FadeIn delay={0} class="stat-children">
    <Card padding="md" class="h-full">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-miel-100 flex items-center justify-center shrink-0">
          <Users size={22} class="text-miel-600" />
        </div>
        <div>
          <p class="text-2xl font-display font-bold text-warm-900">{data.totalChildren}</p>
          <p class="text-xs text-warm-500 font-medium">Enfants gardés</p>
        </div>
      </div>
    </Card>
  </FadeIn>

  <FadeIn delay={40} class="stat-absences">
    <Card padding="md" class="h-full">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-sienne-100 flex items-center justify-center shrink-0">
          <CalendarX size={22} class="text-sienne-600" />
        </div>
        <div>
          <p class="text-2xl font-display font-bold text-warm-900">{data.insights.absenceDaysLast30}</p>
          <p class="text-xs text-warm-500 font-medium">Jours d'absence (30j)</p>
        </div>
      </div>
    </Card>
  </FadeIn>

  <FadeIn delay={80} class="stat-retards">
    <Card padding="md" class="h-full">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-soleil-400/15 flex items-center justify-center shrink-0">
          <Clock size={22} class="text-soleil-500" />
        </div>
        <div>
          <p class="text-2xl font-display font-bold text-warm-900">{data.insights.retardsLast30Days}</p>
          <p class="text-xs text-warm-500 font-medium">Retards (30j)</p>
        </div>
      </div>
    </Card>
  </FadeIn>

  <FadeIn delay={120} class="stat-health">
    <Card padding="md" class="h-full">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-argile-400/10 flex items-center justify-center shrink-0">
          <Thermometer size={22} class="text-argile-500" />
        </div>
        <div>
          <p class="text-2xl font-display font-bold text-warm-900">{data.healthAlerts}</p>
          <p class="text-xs text-warm-500 font-medium">Alertes santé</p>
        </div>
      </div>
    </Card>
  </FadeIn>

  <!-- ══════ ROW 2: Completion ring + Mood chart ══════ -->
  <FadeIn delay={160} class="stat-completion">
    <Card padding="md" class="h-full flex flex-col items-center justify-center">
      <div class="relative w-24 h-24 mb-3">
        <svg viewBox="0 0 80 80" class="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(184,158,134,0.12)" stroke-width="6" />
          <circle cx="40" cy="40" r="36" fill="none"
            stroke="url(#completionGrad)" stroke-width="6" stroke-linecap="round"
            stroke-dasharray={ringCircumference}
            stroke-dashoffset={ringOffset}
            class="completion-ring" />
          <defs>
            <linearGradient id="completionGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#E8913A" />
              <stop offset="100%" stop-color="#5FA05B" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-xl font-display font-bold text-warm-900">{data.completionRate}%</span>
        </div>
      </div>
      <p class="text-sm font-semibold text-warm-700">Taux de complétion</p>
      <p class="text-[11px] text-warm-400 mt-0.5">{data.totalLogs} journaux saisis</p>
    </Card>
  </FadeIn>

  <FadeIn delay={200} class="stat-mood">
    <Card padding="md" class="h-full">
      <div class="flex items-center gap-2 mb-4">
        <BarChart3 size={16} class="text-miel-500" />
        <h3 class="font-display font-bold text-base text-warm-900">Humeurs</h3>
        <span class="text-[10px] text-warm-400 ml-auto">{data.totalMoods} relevés</span>
      </div>

      <div class="space-y-3">
        {#each (['joyeux', 'calme', 'grognon'] as const) as mood}
          {@const count = data.moodCounts[mood]}
          {@const pct = data.totalMoods > 0 ? Math.round((count / data.totalMoods) * 100) : 0}
          {@const cfg = MOOD_CFG[mood]}
          <div>
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <cfg.Icon size={14} class={cfg.color} />
                <span class="text-xs font-semibold text-warm-700">{cfg.label}</span>
              </div>
              <span class="text-xs font-bold {cfg.color}">{pct}%</span>
            </div>
            <div class="h-2.5 rounded-full bg-warm-100/50 overflow-hidden">
              <div class="h-full rounded-full {cfg.bar} mood-bar" style="width: {pct}%"></div>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  </FadeIn>

  <!-- ══════ ROW 3: Daily averages ══════ -->
  <FadeIn delay={240} class="stat-averages">
    <Card padding="md" class="h-full">
      <div class="flex items-center gap-2 mb-4">
        <TrendingUp size={16} class="text-miel-500" />
        <h3 class="font-display font-bold text-base text-warm-900">Moyennes quotidiennes</h3>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <!-- Meals -->
        <div class="glass-2 rounded-xl p-3 text-center">
          <UtensilsCrossed size={18} class="text-sienne-500 mx-auto mb-1.5" />
          <p class="text-lg font-bold {mealColor}">{data.avgMealScore.toFixed(1)}<span class="text-warm-400 text-xs">/3</span></p>
          <p class="text-[10px] font-semibold text-warm-500 mt-0.5">{mealLabel}</p>
        </div>

        <!-- Nap -->
        <div class="glass-2 rounded-xl p-3 text-center">
          <Moon size={18} class="text-bleu-400 mx-auto mb-1.5" />
          <p class="text-lg font-bold text-bleu-500">{napLabel()}</p>
          <p class="text-[10px] font-semibold text-warm-500 mt-0.5">Sieste moy.</p>
        </div>

        <!-- Changes -->
        <div class="glass-2 rounded-xl p-3 text-center">
          <Droplets size={18} class="text-bleu-400 mx-auto mb-1.5" />
          <p class="text-lg font-bold text-bleu-500">{data.avgChanges}</p>
          <p class="text-[10px] font-semibold text-warm-500 mt-0.5">Changes moy.</p>
        </div>
      </div>
    </Card>
  </FadeIn>

  <!-- ══════ ROW 3 continued: Attendance by child ══════ -->
  <FadeIn delay={280} class="stat-attendance">
    <Card padding="md" class="h-full">
      <div class="flex items-center gap-2 mb-4">
        <CalendarX size={16} class="text-sienne-500" />
        <h3 class="font-display font-bold text-base text-warm-900">Présence par enfant</h3>
      </div>

      {#if data.childAbsenceRanking.length > 0}
        <div class="space-y-2.5">
          {#each data.childAbsenceRanking as child}
            <div class="flex items-center gap-3">
              <span class="text-sm font-semibold text-warm-800 w-20 truncate">{child.name}</span>
              <div class="flex-1 flex gap-1.5">
                {#if child.absences > 0}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sienne-100 text-sienne-700 text-[10px] font-bold">
                    <CalendarX size={10} />
                    {child.absences} abs.
                  </span>
                {/if}
                {#if child.retards > 0}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-soleil-400/15 text-soleil-500 text-[10px] font-bold">
                    <Clock size={10} />
                    {child.retards} ret.
                  </span>
                {/if}
                {#if child.absences === 0 && child.retards === 0}
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-mousse-100 text-mousse-600 text-[10px] font-bold">
                    <Heart size={10} />
                    Parfait
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-warm-400 text-center py-4">Aucun enfant</p>
      {/if}
    </Card>
  </FadeIn>

  <!-- ══════ ROW 4: Mood per child ══════ -->
  <FadeIn delay={320} class="stat-childmood">
    <Card padding="md" class="h-full">
      <div class="flex items-center gap-2 mb-4">
        <Smile size={16} class="text-mousse-500" />
        <h3 class="font-display font-bold text-base text-warm-900">Humeur par enfant</h3>
      </div>

      {#if data.childMoods.length > 0}
        <div class="space-y-3">
          {#each data.childMoods as child}
            {@const total = child.total || 1}
            <div>
              <p class="text-xs font-semibold text-warm-700 mb-1">{child.name}</p>
              <div class="flex h-3 rounded-full overflow-hidden bg-warm-100/30">
                {#if child.joyeux > 0}
                  <div class="bg-mousse-400 h-full" style="width: {(child.joyeux / total) * 100}%"></div>
                {/if}
                {#if child.calme > 0}
                  <div class="bg-soleil-400 h-full" style="width: {(child.calme / total) * 100}%"></div>
                {/if}
                {#if child.grognon > 0}
                  <div class="bg-argile-400 h-full" style="width: {(child.grognon / total) * 100}%"></div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <!-- Legend -->
        <div class="flex items-center gap-4 mt-4 pt-3 border-t border-warm-100/20">
          {#each (['joyeux', 'calme', 'grognon'] as const) as mood}
            {@const cfg = MOOD_CFG[mood]}
            <div class="flex items-center gap-1.5">
              <div class="w-2 h-2 rounded-full {cfg.bar}"></div>
              <span class="text-[10px] font-semibold text-warm-500">{cfg.label}</span>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-warm-400 text-center py-4">Aucune donnée</p>
      {/if}
    </Card>
  </FadeIn>

</div>

<style>
  .stats-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
  }

  @media (min-width: 640px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .stats-grid {
      grid-template-columns: repeat(4, 1fr);
      grid-template-areas:
        "children absences  retards    health"
        "complete mood      mood       mood"
        "averages averages  attendance attendance"
        "cmood    cmood     cmood      cmood";
    }

    .stats-grid :global(.stat-children)  { grid-area: children; }
    .stats-grid :global(.stat-absences)  { grid-area: absences; }
    .stats-grid :global(.stat-retards)   { grid-area: retards; }
    .stats-grid :global(.stat-health)    { grid-area: health; }
    .stats-grid :global(.stat-completion){ grid-area: complete; }
    .stats-grid :global(.stat-mood)      { grid-area: mood; }
    .stats-grid :global(.stat-averages)  { grid-area: averages; }
    .stats-grid :global(.stat-attendance){ grid-area: attendance; }
    .stats-grid :global(.stat-childmood) { grid-area: cmood; }
  }

  /* Animated completion ring */
  .completion-ring {
    transition: stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* Mood bars animate in */
  .mood-bar {
    animation: barGrow 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes barGrow {
    from { width: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .completion-ring { transition: none; }
    .mood-bar { animation: none; }
  }
</style>
