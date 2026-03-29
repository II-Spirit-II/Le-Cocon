<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { FadeIn, Card, Badge, Avatar, Button, PageHeader } from '$lib/ui';
  import {
    ChevronLeft, ChevronRight, Printer, Clock, CalendarCheck,
    TrendingUp, TrendingDown, Minus, ArrowLeft
  } from 'lucide-svelte';

  interface Props { data: PageData; }
  let { data }: Props = $props();

  const MONTH_NAMES = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  function navigateMonth(offset: number) {
    let y = data.year;
    let m = data.month + offset;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    goto(`/app/attendance/report?year=${y}&month=${m}`);
  }

  function formatHours(h: number): string {
    const abs = Math.abs(h);
    const hours = Math.floor(abs);
    const minutes = Math.round((abs - hours) * 60);
    const sign = h < 0 ? '-' : '';
    return `${sign}${hours}h${minutes.toString().padStart(2, '0')}`;
  }

  function deltaColor(delta: number): string {
    if (Math.abs(delta) < 0.25) return 'text-mousse-500';
    return delta > 0 ? 'text-sienne-500' : 'text-bleu-500';
  }

  function deltaBadgeVariant(delta: number): 'success' | 'warning' | 'info' {
    if (Math.abs(delta) < 0.25) return 'success';
    return delta > 0 ? 'warning' : 'info';
  }

  function progressPercent(actual: number, expected: number): number {
    if (expected <= 0) return 0;
    return Math.min(100, Math.round((actual / expected) * 100));
  }

  function handlePrint() {
    if (browser) window.print();
  }
</script>

<svelte:head>
  <title>Rapport mensuel — Le Cocon</title>
</svelte:head>

<div class="max-w-4xl mx-auto">

  <!-- Back link -->
  <div class="mb-2 print:hidden">
    <a
      href="/app/attendance"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-warm-600 hover:text-miel-600 transition-colors"
    >
      <ArrowLeft size={16} />
      Présences
    </a>
  </div>

  <PageHeader title="Rapport mensuel" description="{MONTH_NAMES[data.month]} {data.year}">
    {#snippet actions()}
      <div class="flex items-center gap-2 print:hidden">
        <button
          type="button"
          onclick={() => navigateMonth(-1)}
          class="p-2 rounded-xl text-warm-600 hover:bg-warm-100/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
          aria-label="Mois précédent"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onclick={() => navigateMonth(1)}
          class="p-2 rounded-xl text-warm-600 hover:bg-warm-100/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
          aria-label="Mois suivant"
        >
          <ChevronRight size={20} />
        </button>
        <Button variant="secondary" size="sm" onclick={handlePrint}>
          <span class="flex items-center gap-1.5"><Printer size={14} /> Imprimer</span>
        </Button>
      </div>
    {/snippet}
  </PageHeader>

  <!-- Global summary -->
  <FadeIn>
    <Card padding="md" class="mb-6">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="text-center">
          <p class="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-1">Heures prévues</p>
          <p class="text-xl font-display font-bold text-warm-900">{formatHours(data.totalExpected)}</p>
        </div>
        <div class="text-center">
          <p class="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-1">Heures réelles</p>
          <p class="text-xl font-display font-bold text-warm-900">{formatHours(data.totalActual)}</p>
        </div>
        <div class="text-center">
          <p class="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-1">Écart</p>
          <p class="text-xl font-display font-bold {deltaColor(data.totalDelta)}">
            {data.totalDelta >= 0 ? '+' : ''}{formatHours(data.totalDelta)}
          </p>
        </div>
        <div class="text-center">
          <p class="text-xs font-semibold text-warm-500 uppercase tracking-wider mb-1">Jours présence</p>
          <p class="text-xl font-display font-bold text-warm-900">{data.totalPresent}</p>
        </div>
      </div>
    </Card>
  </FadeIn>

  <!-- Per-child report -->
  {#if data.report.length === 0}
    <FadeIn delay={60}>
      <Card padding="lg" class="text-center">
        <CalendarCheck size={40} class="text-warm-300 mx-auto mb-3" />
        <p class="text-warm-600 font-medium">Aucun enfant enregistré</p>
      </Card>
    </FadeIn>
  {:else}
    <div class="space-y-4">
      {#each data.report as child, i}
        {@const pct = progressPercent(child.actualHours, child.expectedHours)}
        {@const barColor = Math.abs(child.deltaHours) < 0.25 ? 'bg-mousse-400' : child.deltaHours > 0 ? 'bg-sienne-400' : 'bg-bleu-400'}
        <FadeIn delay={i * 50}>
          <Card padding="md" hover>
            <div class="flex items-start gap-4">
              <!-- Avatar + name -->
              <Avatar name="{child.childFirstName} {child.childLastName}" size="lg" kind="child" />

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="font-display font-bold text-warm-900 truncate">
                    {child.childFirstName} {child.childLastName}
                  </h3>
                  <Badge variant={deltaBadgeVariant(child.deltaHours)} size="sm">
                    {#if Math.abs(child.deltaHours) < 0.25}
                      <span class="flex items-center gap-1"><Minus size={11} /> Dans les clous</span>
                    {:else if child.deltaHours > 0}
                      <span class="flex items-center gap-1"><TrendingUp size={11} /> +{formatHours(child.deltaHours)}</span>
                    {:else}
                      <span class="flex items-center gap-1"><TrendingDown size={11} /> {formatHours(child.deltaHours)}</span>
                    {/if}
                  </Badge>
                </div>

                <!-- Hours comparison -->
                <div class="grid grid-cols-3 gap-3 mb-3 text-center">
                  <div class="glass-2 rounded-xl p-2">
                    <p class="text-[10px] font-semibold text-warm-500 uppercase tracking-wider">Prévu</p>
                    <p class="text-sm font-bold text-warm-900">{formatHours(child.expectedHours)}</p>
                  </div>
                  <div class="glass-2 rounded-xl p-2">
                    <p class="text-[10px] font-semibold text-warm-500 uppercase tracking-wider">Réel</p>
                    <p class="text-sm font-bold text-warm-900">{formatHours(child.actualHours)}</p>
                  </div>
                  <div class="glass-2 rounded-xl p-2">
                    <p class="text-[10px] font-semibold text-warm-500 uppercase tracking-wider">Écart</p>
                    <p class="text-sm font-bold {deltaColor(child.deltaHours)}">
                      {child.deltaHours >= 0 ? '+' : ''}{formatHours(child.deltaHours)}
                    </p>
                  </div>
                </div>

                <!-- Progress bar -->
                <div class="h-2 rounded-full bg-warm-200/60 overflow-hidden mb-2">
                  <div
                    class="h-full rounded-full {barColor} transition-all duration-500"
                    style="width: {pct}%"
                  ></div>
                </div>

                <!-- Days breakdown -->
                <div class="flex flex-wrap gap-3 text-xs text-warm-500">
                  <span>{child.daysPresent} jour{child.daysPresent > 1 ? 's' : ''} présent{child.daysPresent > 1 ? 's' : ''}</span>
                  {#if child.daysAbsentPlanned > 0}
                    <span class="text-soleil-500">{child.daysAbsentPlanned} abs. prévu{child.daysAbsentPlanned > 1 ? 'es' : 'e'}</span>
                  {/if}
                  {#if child.daysAbsentUnplanned > 0}
                    <span class="text-argile-500">{child.daysAbsentUnplanned} abs. imprévue{child.daysAbsentUnplanned > 1 ? 's' : ''}</span>
                  {/if}
                  <span class="text-warm-400">sur {child.daysExpected} jours attendus</span>
                </div>
              </div>
            </div>
          </Card>
        </FadeIn>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Print-friendly styles */
  @media print {
    :global(body) {
      background: white !important;
    }
    :global(.sidebar-glass),
    :global(.mobile-header),
    :global(.orb),
    :global(nav),
    :global(aside) {
      display: none !important;
    }
    :global(main) {
      margin: 0 !important;
      padding: 0 !important;
    }
  }
</style>
