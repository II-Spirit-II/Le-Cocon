<script lang="ts">
  import type { PageData } from './$types';
  import type { CalendarEvent } from '$lib/domain/parent_notes';
  import type { MealEntry, NapEntry, HealthEntry, MoodLevel } from '$lib/types';
  import { browser } from '$app/environment';
  import { agentPanelOpen } from '$lib/stores/agent.svelte';
  import { FadeIn, CalendarMonth, Avatar, Button, PlateVisual } from '$lib/ui';
  import {
    ChevronRight, Sunrise, Sun, Moon, Sunset,
    Newspaper, Baby, BookOpen, Sparkles, Inbox,
    Pencil, Smile, Meh, Frown, UtensilsCrossed, CalendarX,
    Calendar, Users, Clock, Heart, Droplets, Thermometer,
    FileText
  } from 'lucide-svelte';

  interface Props { data: PageData; }
  let { data }: Props = $props();

  type OverviewChild = {
    id: string; firstName: string; lastName: string;
    avatarPath: string | null; avatarUrl: string | null;
    isAbsent: boolean; hasLog: boolean; mood: MoodLevel | null;
    meals: MealEntry[]; nap: NapEntry | null;
    health: HealthEntry | null; changes: number; notes: string;
  };

  const isAsmmat = $derived(data.role === 'assistante');

  // -- Clock --
  let currentHour = $state(new Date().getHours());
  $effect(() => {
    if (browser) {
      currentHour = new Date().getHours();
      const iv = setInterval(() => { currentHour = new Date().getHours(); }, 60_000);
      return () => clearInterval(iv);
    }
  });

  const greeting = $derived(
    currentHour < 12 ? 'Bonjour' : currentHour < 18 ? 'Bon après-midi' : 'Bonsoir'
  );

  // -- Formatters --
  function formatToday(d: string) {
    const s = new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function timeAgo(iso: string) {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    const d = Math.floor(h / 24);
    if (h < 1) return "A l'instant";
    if (h < 24) return `Il y a ${h}h`;
    if (d === 1) return 'Hier';
    return `Il y a ${d}j`;
  }

  // -- Meteo (for ambient tint in children section) --
  const totalLogged = $derived(data.moodCounts.grognon + data.moodCounts.calme + data.moodCounts.joyeux);

  const meteo = $derived.by(() => {
    if (totalLogged === 0) return { color1: '#F0B872', color2: '#FDE8C8', glow: 'rgba(240,184,114,0.35)', Icon: Sunrise, iconClass: 'text-soleil-500', label: 'En attente' };
    const j = data.moodCounts.joyeux / totalLogged;
    const g = data.moodCounts.grognon / totalLogged;
    if (j >= 0.8) return { color1: '#8BC5A0', color2: '#B8DEC8', glow: 'rgba(139,197,160,0.4)', Icon: Sun, iconClass: 'text-mousse-500', label: 'Excellente journée' };
    if (j >= 0.5) return { color1: '#A8D5A0', color2: '#D4EBCF', glow: 'rgba(168,213,160,0.4)', Icon: Sun, iconClass: 'text-mousse-400', label: 'Belle journée' };
    if (g >= 0.6) return { color1: '#D4816B', color2: '#E8A898', glow: 'rgba(212,129,107,0.4)', Icon: Sunrise, iconClass: 'text-argile-400', label: 'Journée agitée' };
    return { color1: '#E8C060', color2: '#F4DFA0', glow: 'rgba(232,192,96,0.4)', Icon: Sun, iconClass: 'text-soleil-500', label: 'Journée variée' };
  });
  const MeteoIcon = $derived(meteo.Icon);

  // -- Mood config --
  const MOOD_CFG = {
    joyeux:  { ring: 'ring-mousse-400', dot: 'bg-mousse-400', text: 'text-mousse-600', bg: 'bg-mousse-400/10', label: 'Joyeux',  Icon: Smile },
    calme:   { ring: 'ring-soleil-400', dot: 'bg-soleil-400', text: 'text-soleil-600', bg: 'bg-soleil-400/10', label: 'Calme',   Icon: Meh   },
    grognon: { ring: 'ring-argile-400', dot: 'bg-argile-400', text: 'text-argile-500', bg: 'bg-argile-400/10', label: 'Grognon', Icon: Frown },
  } as const;
  type Mood = keyof typeof MOOD_CFG;

  // -- Derived data (assistante) --
  const absentCount    = $derived(data.children.filter((c: OverviewChild) => c.isAbsent).length);
  const toJournalCount = $derived(data.children.filter((c: OverviewChild) => !c.isAbsent && !c.hasLog).length);
  const journalPct     = $derived(data.presentCount > 0 ? Math.round((data.journaledCount / data.presentCount) * 100) : 0);
  const allDone        = $derived(journalPct === 100 && data.presentCount > 0);

  const sortedChildren = $derived.by(() => {
    const toJournal = data.children.filter((c: OverviewChild) => !c.isAbsent && !c.hasLog);
    const journaled = data.children.filter((c: OverviewChild) => !c.isAbsent && c.hasLog);
    const absent    = data.children.filter((c: OverviewChild) => c.isAbsent);
    return [...toJournal, ...journaled, ...absent];
  });

  // -- Tab state for BLOC 2 --
  type Bloc2Tab = 'enfants' | 'calendrier';
  let bloc2Tab = $state<Bloc2Tab>('enfants');

  // Height-managed tab container — both tabs always absolute, no position swap
  let contentEl: HTMLDivElement | undefined = $state();
  let enfantsEl: HTMLDivElement | undefined = $state();
  let calendarEl: HTMLDivElement | undefined = $state();

  function getActiveEl() {
    return bloc2Tab === 'enfants' ? enfantsEl : calendarEl;
  }

  // Set initial height + observe active tab resizes (e.g. calendar event panel)
  $effect(() => {
    if (!browser || !contentEl) return;
    const activeEl = getActiveEl();
    if (!activeEl) return;

    // Init
    contentEl.style.height = `${activeEl.offsetHeight}px`;

    // Watch for content size changes (event panel open/close, show more, etc.)
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newH = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        if (contentEl && Math.abs(newH - contentEl.offsetHeight) > 1) {
          contentEl.style.height = `${newH}px`;
        }
      }
    });
    ro.observe(activeEl);
    return () => ro.disconnect();
  });

  function switchTab(to: Bloc2Tab) {
    if (to === bloc2Tab || !contentEl || !enfantsEl || !calendarEl) return;

    const fromH = contentEl.offsetHeight;
    const targetEl = to === 'enfants' ? enfantsEl : calendarEl;
    const toH = targetEl.offsetHeight;

    // Lock from height
    contentEl.style.height = `${fromH}px`;
    contentEl.offsetHeight; // single reflow

    // Switch tab (only opacity+transform change, no position swap)
    bloc2Tab = to;

    // Animate to target height
    requestAnimationFrame(() => {
      if (contentEl) contentEl.style.height = `${toH}px`;
    });
  }

  // -- Responsive: 2 rows max of children --
  let innerWidth = $state(1024);

  const mobileCols = 3;
  const desktopCols = $derived(
    sortedChildren.length > 6 && innerWidth >= 1024 ? 4
    : sortedChildren.length > 4 ? 3
    : 2
  );
  const visibleLimit = $derived((innerWidth < 768 ? mobileCols : desktopCols) * 2);
  const displayedChildren = $derived(sortedChildren.slice(0, visibleLimit));
  const hasMore = $derived(sortedChildren.length > visibleLimit);

  // -- Calendar state --
  let calYear = $state(0);
  let calMonth = $state(0);
  let calEvents = $state<CalendarEvent[]>([]);
  let calLoading = $state(false);

  $effect(() => {
    calYear = data.calendarYear;
    calMonth = data.calendarMonth;
    calEvents = data.calendarEvents;
  });

  let selectedEvent = $state<CalendarEvent | null>(null);
  let eventModalClosing = $state(false);

  function closeEventModal() {
    eventModalClosing = true;
    setTimeout(() => {
      selectedEvent = null;
      eventModalClosing = false;
    }, 250);
  }

  async function navigateCalendar(year: number, month: number) {
    calYear = year;
    calMonth = month;
    calLoading = true;
    try {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      const pad = (n: number) => String(n).padStart(2, '0');
      const fromStr = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
      const toStr = `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`;
      const res = await fetch(`/api/calendar-events?from=${fromStr}&to=${toStr}`);
      if (res.ok) {
        calEvents = await res.json();
      }
    } catch {
      // silent
    }
    calLoading = false;
  }

  function formatEventDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function formatEventPeriod(start: string, end: string): string {
    if (start === end) return formatEventDate(start);
    const s = new Date(start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const e = new Date(end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `Du ${s} au ${e}`;
  }

  const kindLabels: Record<string, { label: string; Icon: typeof Calendar; color: string }> = {
    absence: { label: 'Absence', Icon: Calendar, color: 'bg-sienne-100 text-sienne-600' },
    retard: { label: 'Retard', Icon: Clock, color: 'bg-soleil-100 text-soleil-700' }
  };

  // -- Avatar color from name --
  const avatarColors = [
    'bg-miel-200 text-miel-700',
    'bg-bleu-400/20 text-bleu-500',
    'bg-mousse-400/20 text-mousse-500',
    'bg-sienne-200 text-sienne-700',
    'bg-argile-400/20 text-argile-500'
  ];
  function avatarColor(name: string) {
    const i = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length;
    return avatarColors[i];
  }

  // -- Parent helpers --
  const MEAL_LABELS: Record<string, string> = {
    'petit-dejeuner': 'Petit-déj.',
    'dejeuner': 'Déjeuner',
    'gouter': 'Goûter',
    'diner': 'Dîner'
  };

  const QUANTITY_LABELS: Record<string, string> = {
    'non-mange': 'Pas mangé',
    'peu': 'Peu mangé',
    'bien': 'Bien mangé',
    'tres-bien': 'Très bien mangé'
  };

  const QUANTITY_TO_LEVEL: Record<string, 0 | 1 | 2 | 3> = {
    'non-mange': 0,
    'peu': 1,
    'bien': 2,
    'tres-bien': 3
  };

  const NAP_QUALITY_LABELS: Record<string, string> = {
    'agitee': 'Agitée',
    'normale': 'Normale',
    'paisible': 'Paisible'
  };

  function formatNapDuration(nap: NapEntry): string {
    if (!nap.startTime || !nap.endTime) return '';
    return `${nap.startTime} - ${nap.endTime}`;
  }
</script>

<style>
  .ring-pulse {
    animation: ring-pulse 3.5s ease-in-out infinite;
  }
  @keyframes ring-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(232, 145, 58, 0.45); }
    50% { box-shadow: 0 0 0 8px rgba(232, 145, 58, 0), 0 0 12px 2px rgba(232, 145, 58, 0.08); }
  }

  .bar-shimmer {
    position: relative;
    overflow: hidden;
  }
  .bar-shimmer::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255, 255, 255, 0.3) 45%,
      rgba(255, 255, 255, 0.45) 50%,
      rgba(255, 255, 255, 0.3) 55%,
      transparent 70%
    );
    animation: bar-shimmer 3s ease-in-out infinite;
  }

  .bar-done {
    position: relative;
    overflow: hidden;
  }
  .bar-done::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255, 255, 255, 0.15) 45%,
      rgba(255, 255, 255, 0.25) 50%,
      rgba(255, 255, 255, 0.15) 55%,
      transparent 70%
    );
    animation: bar-shimmer 4s ease-in-out infinite;
  }

  @keyframes bar-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  .child-card {
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
  }
  .child-card:hover {
    transform: translateY(-3px);
  }

  /* Neutralize CalendarMonth's own glass-1 when embedded */
  .calendar-embed :global(.glass-1) {
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }

  /* Improve calendar readability inside the dashboard */
  .calendar-embed :global(.glass-2) {
    background: rgba(255, 248, 238, 0.55);
    border-color: rgba(194, 140, 100, 0.15);
  }
  .calendar-embed :global(.border-white\/15) {
    border-color: rgba(194, 140, 100, 0.12);
  }

  /* Tab transition — both tabs always absolute, only opacity/transform animate */
  .bloc2-content {
    position: relative;
    overflow: hidden;
    transition: height 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .bloc2-tab {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .bloc2-tab-active {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    z-index: 1;
    visibility: visible;
  }
  .bloc2-tab-hidden {
    opacity: 0;
    transform: translateY(4px);
    pointer-events: none;
    z-index: 0;
    visibility: hidden;
  }

  /* Desktop: tabs in grid overlay, stretch to fill */
  @media (min-width: 640px) {
    .bloc2-content {
      display: grid;
      grid-template: 1fr / 1fr;
      overflow: visible;
      transition: none;
      height: auto !important;
      flex: 1;
    }
    .bloc2-tab {
      position: static;
      grid-area: 1 / 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bloc2-content { transition: none !important; }
    .bloc2-tab { transition: none !important; }
  }

  /* Dashboard layout — mobile: natural flow; desktop: viewport fit */
  .dashboard-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  @media (min-width: 1024px) {
    .dashboard-grid {
      height: calc(100dvh - 4rem);
      overflow: clip;
    }
  }

  .bloc-middle {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
    min-height: 0;
  }

  .bloc-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  /* The glass card and its content stretch to fill (desktop only) */
  .bloc-main :global(.glass-1) {
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 640px) {
    .bloc-main :global(.glass-1) {
      flex: 1;
    }
  }

  .bloc2-stretch {
    min-height: 0;
  }

  @media (min-width: 640px) {
    .bloc2-stretch {
      flex: 1;
    }
  }

  /* Children grid: compact on mobile, stretch on desktop */
  .children-grid-stretch {
    align-content: start;
  }

  @media (min-width: 640px) {
    .children-grid-stretch {
      flex: 1;
      align-content: stretch;
    }

    .children-grid-stretch > a {
      min-height: 0;
    }
  }

  .bloc-sidebar {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  @media (min-width: 1024px) {
    .bloc-middle {
      flex-direction: row;
      align-items: stretch;
    }
    .bloc-main {
      flex: 1;
      min-width: 0;
    }
    .bloc-sidebar {
      width: 240px;
      flex-shrink: 0;
      min-height: 0;
    }
    /* First child in sidebar (news) stretches to fill */
    .bloc-sidebar > :first-child {
      flex: 1;
      min-height: 0;
    }
  }

  /* Subtle scrollbar for news sidebar */
  .news-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(184, 158, 134, 0.3) transparent;
  }
  .news-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .news-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .news-scroll::-webkit-scrollbar-thumb {
    background: rgba(184, 158, 134, 0.3);
    border-radius: 4px;
  }

  .action-row {
    transition: background-color 0.15s ease;
  }
  .action-row:active {
    transform: scale(0.99);
  }

  /* Parent child hero card */
  .parent-hero {
    display: block;
  }

  /* Mood orb ambient glow behind avatar */
  .mood-glow {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    filter: blur(12px);
    opacity: 0.4;
    animation: mood-breathe 4s ease-in-out infinite;
  }
  @keyframes mood-breathe {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.05); }
  }

  @media (prefers-reduced-motion: reduce) {
    .mood-glow { animation: none !important; opacity: 0.3; }
    .ring-pulse { animation: none !important; }
    .bar-shimmer::after, .bar-done::after { animation: none !important; }
    .modal-enter, .modal-exit { animation: none !important; }
    .modal-backdrop, .modal-backdrop-out { animation: none !important; }
  }

  /* Modal — shared animation for event detail + confirm dialogs */
  .modal-backdrop {
    background: rgba(26, 22, 18, 0.25);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: backdrop-in 0.3s ease forwards;
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .modal-glass {
    background: rgba(255, 248, 240, 0.88);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    border-radius: 1.75rem;
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 20px 60px rgba(194, 101, 58, 0.12),
      0 4px 16px rgba(194, 101, 58, 0.06);
  }

  @keyframes modal-in {
    0%   { opacity: 0; transform: scale(0.92) translateY(12px); }
    60%  { opacity: 1; transform: scale(1.02) translateY(-2px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  .modal-enter {
    animation: modal-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .modal-backdrop-out {
    animation: backdrop-out 0.25s ease forwards;
  }

  @keyframes backdrop-out {
    from { opacity: 1; }
    to   { opacity: 0; }
  }

  @keyframes modal-out {
    from { opacity: 1; transform: scale(1) translateY(0); }
    to   { opacity: 0; transform: scale(0.95) translateY(8px); }
  }

  .modal-exit {
    animation: modal-out 0.25s cubic-bezier(0.4, 0, 1, 1) forwards;
  }
</style>

<svelte:window bind:innerWidth />

<!-- ═══════════════════════════════════════════════════════════
     PARENT DASHBOARD
     ═══════════════════════════════════════════════════════════ -->
{#if !isAsmmat}
  <div class="dashboard-grid">

    <!-- BLOC 1 — Greeting + status -->
    <FadeIn>
      <div class="glass-1 rounded-3xl p-5 sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-display font-bold text-warm-900 leading-tight">
              {greeting}, {data.firstName}
            </h1>
            <p class="text-sm text-warm-500 mt-0.5">{formatToday(data.today)}</p>
          </div>
          {#if data.pendingCount > 0}
            <a href="/app/notes"
              class="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-sienne-400/10 ring-1 ring-sienne-400/20 hover:bg-sienne-400/15 transition-colors">
              <span class="w-2 h-2 rounded-full bg-sienne-500 animate-pulse"></span>
              <span class="text-xs font-semibold text-sienne-600">
                {data.pendingCount} réponse{data.pendingCount > 1 ? 's' : ''}
              </span>
            </a>
          {/if}
        </div>

        <!-- Simple status line -->
        {#if data.children.length > 0}
          <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
            {#if data.journaledCount > 0}
              <span class="flex items-center gap-1.5 text-mousse-600">
                <span class="w-2 h-2 rounded-full bg-mousse-400 shrink-0"></span>
                {data.journaledCount} carnet{data.journaledCount > 1 ? 's' : ''} du jour disponible{data.journaledCount > 1 ? 's' : ''}
              </span>
            {:else}
              <span class="flex items-center gap-1.5 text-warm-500">
                <span class="w-2 h-2 rounded-full bg-warm-300 shrink-0"></span>
                Pas encore de carnet aujourd'hui
              </span>
            {/if}
          </div>
        {/if}
      </div>
    </FadeIn>

    <!-- BLOC 2 — Child hero cards with journal details -->
    {#if data.children.length > 0}
      {#each data.children as child, i (child.id)}
        <FadeIn delay={60 + i * 40}>
          <a href="/app/children/{child.id}" class="block parent-hero">
            <div class="glass-1 rounded-3xl overflow-hidden">

              <!-- Header: avatar centered + name + mood -->
              <div class="p-5 sm:p-6">
                <div class="flex items-center gap-4">
                  <!-- Avatar with mood glow -->
                  <div class="relative shrink-0">
                    {#if child.hasLog && child.mood && child.mood in MOOD_CFG}
                      {@const moodKey = child.mood as Mood}
                      <div class="mood-glow {MOOD_CFG[moodKey].dot}"></div>
                      {#if child.avatarUrl}
                        <img src={child.avatarUrl} alt={child.firstName}
                          class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-[3px] {MOOD_CFG[moodKey].ring}"
                          loading="lazy" decoding="async" />
                      {:else}
                        <div class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-base sm:text-lg ring-[3px] {MOOD_CFG[moodKey].ring}
                          {avatarColor(child.firstName + child.lastName)}">
                          {child.firstName[0]}{child.lastName[0]}
                        </div>
                      {/if}
                    {:else}
                      {#if child.avatarUrl}
                        <img src={child.avatarUrl} alt={child.firstName}
                          class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-[3px] ring-warm-200"
                          loading="lazy" decoding="async" />
                      {:else}
                        <div class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-base sm:text-lg ring-[3px] ring-warm-200
                          {avatarColor(child.firstName + child.lastName)}">
                          {child.firstName[0]}{child.lastName[0]}
                        </div>
                      {/if}
                    {/if}
                  </div>

                  <div class="flex-1 min-w-0">
                    <h2 class="text-lg sm:text-xl font-display font-bold text-warm-900 truncate leading-tight">
                      {child.firstName}
                    </h2>
                    {#if child.hasLog && child.mood && child.mood in MOOD_CFG}
                      {@const moodKey = child.mood as Mood}
                      {@const MoodIcon = MOOD_CFG[moodKey].Icon}
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold {MOOD_CFG[moodKey].bg} {MOOD_CFG[moodKey].text} mt-1.5">
                        <MoodIcon size={12} />
                        {MOOD_CFG[moodKey].label}
                      </span>
                    {:else}
                      <p class="text-xs text-warm-400 mt-1">En attente du carnet</p>
                    {/if}
                  </div>

                  <ChevronRight size={18} class="text-warm-300 shrink-0" />
                </div>
              </div>

              <!-- Journal details (only if log exists) -->
              {#if child.hasLog}
                <div class="border-t border-white/10 px-5 sm:px-6 py-4 space-y-3">

                  <!-- Meals — horizontal row of plates -->
                  {#if child.meals.length > 0}
                    <div class="glass-2 rounded-2xl p-3.5">
                      <div class="flex items-center gap-1.5 justify-center mb-2.5">
                        <UtensilsCrossed size={13} class="text-sienne-500" />
                        <span class="text-[11px] font-bold text-warm-600 uppercase tracking-wider">Repas</span>
                      </div>
                      <div class="flex items-start justify-center gap-4 flex-wrap">
                        {#each child.meals as meal}
                          <div class="flex flex-col items-center gap-1 min-w-15">
                            <PlateVisual level={QUANTITY_TO_LEVEL[meal.quantity] ?? null} size="sm" />
                            <p class="text-[10px] font-semibold text-warm-800 leading-tight text-center">{MEAL_LABELS[meal.type] ?? meal.type}</p>
                            <p class="text-[9px] text-warm-500">{QUANTITY_LABELS[meal.quantity] ?? meal.quantity}</p>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Nap + Changes + Health — compact row -->
                  <div class="grid grid-cols-3 gap-2.5">
                    <div class="glass-2 rounded-2xl p-3 text-center">
                      <div class="flex items-center gap-1 justify-center mb-1.5">
                        <Moon size={12} class="text-bleu-400" />
                        <span class="text-[10px] font-bold text-warm-600 uppercase tracking-wider">Sieste</span>
                      </div>
                      {#if child.nap}
                        <p class="text-sm font-bold text-warm-900 leading-tight">{formatNapDuration(child.nap)}</p>
                        <p class="text-[10px] text-bleu-400 font-medium mt-0.5">{NAP_QUALITY_LABELS[child.nap.quality] ?? child.nap.quality}</p>
                      {:else}
                        <p class="text-[11px] text-warm-400 italic">Pas de sieste</p>
                      {/if}
                    </div>

                    <div class="glass-2 rounded-2xl p-3 text-center">
                      <div class="flex items-center gap-1 justify-center mb-1.5">
                        <Droplets size={12} class="text-bleu-400" />
                        <span class="text-[10px] font-bold text-warm-600 uppercase tracking-wider">Changes</span>
                      </div>
                      <p class="text-lg font-bold text-warm-900 leading-tight">{child.changes}</p>
                    </div>

                    <div class="glass-2 rounded-2xl p-3 text-center">
                      {#if child.health && (child.health.temperature || child.health.symptoms || child.health.medication)}
                        <div class="flex items-center gap-1 justify-center mb-1.5">
                          <Thermometer size={12} class="text-argile-400" />
                          <span class="text-[10px] font-bold text-warm-600 uppercase tracking-wider">Sante</span>
                        </div>
                        <div class="space-y-0.5">
                          {#if child.health.temperature}
                            <p class="text-sm font-bold text-warm-900">{child.health.temperature}°C</p>
                          {/if}
                          {#if child.health.symptoms}
                            <p class="text-[9px] text-warm-600 line-clamp-1">{child.health.symptoms}</p>
                          {/if}
                        </div>
                      {:else}
                        <div class="flex items-center gap-1 justify-center mb-1.5">
                          <Heart size={12} class="text-mousse-400" />
                          <span class="text-[10px] font-bold text-warm-600 uppercase tracking-wider">Sante</span>
                        </div>
                        <p class="text-[11px] text-mousse-500 font-medium">Tout va bien</p>
                      {/if}
                    </div>
                  </div>
                </div>

                <!-- Notes from assistante -->
                {#if child.notes}
                  <div class="border-t border-white/10 px-5 sm:px-6 py-3.5">
                    <div class="flex items-start gap-3">
                      <div class="w-6 h-6 rounded-xl bg-miel-100/80 flex items-center justify-center shrink-0 mt-0.5">
                        <Pencil size={11} class="text-miel-600" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-[10px] font-bold text-miel-500 uppercase tracking-widest mb-0.5">Note de l'assistante</p>
                        <p class="text-[13px] text-warm-800 leading-relaxed line-clamp-2">{child.notes}</p>
                      </div>
                    </div>
                  </div>
                {/if}

              {:else}
                <!-- No journal yet -->
                <div class="border-t border-white/10 px-5 sm:px-6 py-6 text-center">
                  <div class="flex justify-center mb-3">
                    <div class="w-10 h-10 rounded-2xl bg-warm-100/60 flex items-center justify-center">
                      <BookOpen size={20} class="text-warm-400" />
                    </div>
                  </div>
                  <p class="text-sm text-warm-600 font-medium">Pas encore de carnet aujourd'hui</p>
                  <p class="text-[11px] text-warm-400 mt-1">L'assistante n'a pas encore saisi le carnet</p>
                </div>
              {/if}

            </div>
          </a>
        </FadeIn>
      {/each}
    {:else}
      <!-- Empty state: no children -->
      <FadeIn delay={60}>
        <div class="glass-1 rounded-3xl p-8 sm:p-10 text-center">
          <div class="flex justify-center mb-4">
            <div class="w-16 h-16 rounded-2xl bg-miel-100 flex items-center justify-center">
              <Baby size={32} class="text-miel-500" />
            </div>
          </div>
          <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
            Associez votre enfant
          </h3>
          <p class="text-sm text-warm-600 mb-6 max-w-sm mx-auto leading-relaxed">
            Demandez un code d'invitation a votre assistante maternelle pour acceder au carnet et aux news de votre enfant.
          </p>
          <Button variant="primary" href="/app/settings/invite">
            Utiliser un code d'invitation
          </Button>
        </div>
      </FadeIn>
    {/if}

    <!-- BLOC 3 — Recent news from assistante -->
    {#if data.recentNews.length > 0}
      <FadeIn delay={120}>
        <div class="glass-1 rounded-3xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
            <h2 class="font-display font-bold text-warm-900 text-sm">News recentes</h2>
            <a href="/app/feed" class="text-xs text-miel-500 hover:text-miel-700 flex items-center gap-0.5 transition-colors font-medium">
              Tout voir <ChevronRight size={12} />
            </a>
          </div>
          <div class="divide-y divide-white/10">
            {#each data.recentNews.slice(0, 4) as news (news.id)}
              <a href="/app/feed" class="flex items-start gap-3 px-5 py-3.5 hover:bg-warm-100/10 transition-colors group">
                <div class="w-8 h-8 rounded-xl bg-soleil-400/15 flex items-center justify-center shrink-0 mt-0.5">
                  <span class="text-sm">{news.emoji ?? '📰'}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-xs font-semibold text-miel-600">{news.childName}</span>
                    <span class="text-[10px] text-warm-400">{timeAgo(news.createdAt)}</span>
                  </div>
                  <p class="text-sm text-warm-700 leading-snug line-clamp-2 group-hover:text-warm-900 transition-colors">{news.content}</p>
                </div>
              </a>
            {/each}
          </div>
        </div>
      </FadeIn>
    {/if}

    <!-- BLOC 4 — Quick actions -->
    <FadeIn delay={160}>
      <div class="glass-1 rounded-3xl overflow-hidden divide-y divide-white/10">
        <a href="/app/notes"
          class="action-row flex items-center gap-4 px-5 py-3.5 hover:bg-warm-100/10
            {data.pendingCount > 0 ? 'border-l-[3px] border-l-sienne-500' : ''}">
          <div class="w-9 h-9 rounded-xl bg-miel-100 flex items-center justify-center shrink-0">
            <FileText size={18} class="text-miel-600" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-warm-900">Notes a l'assistante</p>
            <p class="text-xs text-warm-500 mt-0.5">
              {data.pendingCount > 0
                ? `${data.pendingCount} réponse${data.pendingCount > 1 ? 's' : ''} non lue${data.pendingCount > 1 ? 's' : ''}`
                : 'Absence, retard, santé...'}
            </p>
          </div>
          <ChevronRight size={16} class="text-warm-300 shrink-0" />
        </a>

        <a href="/app/feed"
          class="action-row flex items-center gap-4 px-5 py-3.5 hover:bg-warm-100/10">
          <div class="w-9 h-9 rounded-xl bg-soleil-100 flex items-center justify-center shrink-0">
            <Newspaper size={18} class="text-soleil-500" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-warm-900">News</p>
            <p class="text-xs text-warm-500 mt-0.5">Photos et nouvelles</p>
          </div>
          <ChevronRight size={16} class="text-warm-300 shrink-0" />
        </a>

        <a href="/app/children"
          class="action-row flex items-center gap-4 px-5 py-3.5 hover:bg-warm-100/10">
          <div class="w-9 h-9 rounded-xl bg-mousse-400/15 flex items-center justify-center shrink-0">
            <Baby size={18} class="text-mousse-500" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-warm-900">Fiche enfant</p>
            <p class="text-xs text-warm-500 mt-0.5">Informations et historique</p>
          </div>
          <ChevronRight size={16} class="text-warm-300 shrink-0" />
        </a>
      </div>
    </FadeIn>

  </div>

<!-- ═══════════════════════════════════════════════════════════
     ASSISTANTE DASHBOARD (unchanged)
     ═══════════════════════════════════════════════════════════ -->
{:else}
  <div class="dashboard-grid">

    <!-- BLOC 1 — Aujourd'hui (Le résumé) -->
    <FadeIn>
      <div class="glass-1 rounded-3xl p-5 sm:p-6">

        <!-- Greeting -->
        <div class="mb-4">
          <h1 class="text-2xl sm:text-3xl font-display font-bold text-warm-900 leading-tight">
            {greeting}, {data.firstName}
          </h1>
          <p class="text-sm text-warm-500 mt-0.5">{formatToday(data.today)}</p>
        </div>

        <!-- Progress bar (assistante) -->
        {#if data.presentCount > 0}
          <a href="/app/journal/batch" class="block group mb-4">
            <div class="flex items-baseline justify-between mb-1.5">
              <span class="text-sm font-semibold {allDone ? 'text-mousse-600' : 'text-warm-800'}">
                {#if allDone}
                  <span class="inline-flex items-center gap-1.5">
                    <Sparkles size={15} class="text-mousse-500" />
                    Tous les carnets sont à jour
                  </span>
                {:else}
                  {data.journaledCount}/{data.presentCount} carnets saisis
                {/if}
              </span>
              <span class="text-xs text-miel-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                Saisie rapide <ChevronRight size={11} />
              </span>
            </div>
            <div class="h-3 rounded-full {allDone ? 'bg-mousse-400 bar-done' : 'bg-warm-200/70 ring-1 ring-warm-300/40 bar-shimmer'}">
              {#if !allDone}
                <div
                  class="h-full rounded-full transition-all duration-700 ease-out bg-linear-to-r from-miel-400 to-miel-500"
                  style="width: {journalPct}%"
                ></div>
              {/if}
            </div>
            {#if !allDone}
              <p class="text-xs text-miel-600 font-medium mt-1.5">
                {toJournalCount} enfant{toJournalCount > 1 ? 's' : ''} en attente de saisie
              </p>
            {/if}
          </a>
        {/if}

        <!-- Indicators as readable text line -->
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <span class="flex items-center gap-1.5 text-warm-700">
            <span class="w-2 h-2 rounded-full bg-sienne-400 shrink-0"></span>
            {data.presentCount} présent{data.presentCount !== 1 ? 's' : ''}
          </span>

          {#if absentCount > 0}
            <span class="flex items-center gap-1.5 text-warm-500">
              <span class="w-2 h-2 rounded-full bg-warm-300 shrink-0"></span>
              {absentCount} absent{absentCount > 1 ? 's' : ''}
            </span>
          {/if}

          {#if data.hasTodayMenu}
            <a href="/app/journal/menu" class="flex items-center gap-1.5 text-mousse-600 hover:underline">
              <span class="w-2 h-2 rounded-full bg-mousse-400 shrink-0"></span>
              Menu défini
            </a>
          {/if}

          {#if data.pendingCount > 0}
            <a href="/app/inbox"
              class="flex items-center gap-1.5 text-sienne-600 font-semibold hover:underline">
              <span class="w-2 h-2 rounded-full bg-sienne-500 animate-pulse shrink-0"></span>
              {data.pendingCount} note{data.pendingCount > 1 ? 's' : ''} à traiter
            </a>
          {/if}
        </div>

        <!-- Menu callout (not defined) -->
        {#if !data.hasTodayMenu}
          <a href="/app/journal/menu"
            class="mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-soleil-400/10 ring-1 ring-soleil-400/25 hover:bg-soleil-400/15 transition-colors group">
            <div class="w-9 h-9 rounded-xl bg-soleil-400/20 flex items-center justify-center shrink-0">
              <UtensilsCrossed size={18} class="text-soleil-600" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-soleil-700">Menu du jour à définir</p>
              <p class="text-xs text-soleil-600/70">Renseignez les repas pour pré-remplir les journaux</p>
            </div>
            <ChevronRight size={14} class="text-soleil-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </a>
        {/if}

      </div>
    </FadeIn>

    <!-- BLOC 2 + BLOC 4 — Side by side on desktop -->
    <div class="bloc-middle">
    <div class="bloc-main">
    {#if data.children.length > 0}
      <FadeIn delay={40} class="flex-1 flex flex-col">
        <div class="glass-1 rounded-3xl overflow-hidden relative">

          <!-- Ambient meteo tint -->
          {#if totalLogged > 0 && bloc2Tab === 'enfants'}
            <div class="absolute top-0 right-0 w-32 h-32 pointer-events-none transition-opacity duration-300"
              style="background: radial-gradient(circle at 100% 0%, {meteo.color1}20, transparent 70%); filter: blur(8px);">
            </div>
          {/if}

          <!-- Header with tabs -->
          <div class="relative flex items-center justify-between px-5 py-3.5 border-b border-white/10">
            <div class="flex items-center gap-1 bg-warm-200/30 rounded-xl p-0.5">
              <button
                type="button"
                onclick={() => switchTab('enfants')}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-[color,background-color,box-shadow] duration-200
                  {bloc2Tab === 'enfants' ? 'bg-warm-50/70 text-warm-900 shadow-sm' : 'text-warm-500 hover:text-warm-700'}"
              >
                <Users size={13} />
                Les enfants
              </button>
              <button
                type="button"
                onclick={() => switchTab('calendrier')}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-[color,background-color,box-shadow] duration-200
                  {bloc2Tab === 'calendrier' ? 'bg-warm-50/70 text-warm-900 shadow-sm' : 'text-warm-500 hover:text-warm-700'}"
              >
                <Calendar size={13} />
                Calendrier
              </button>
            </div>
            <div class="flex items-center gap-3">
              {#if bloc2Tab === 'enfants'}
                <!-- Meteo micro-orb -->
                {#if totalLogged > 0}
                  <div class="flex items-center gap-1.5 text-xs font-medium {meteo.iconClass}">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center"
                      style="background: radial-gradient(circle at 35% 35%, white 0%, {meteo.color1} 60%, {meteo.color2} 100%); box-shadow: 0 2px 8px {meteo.glow};">
                      <MeteoIcon size={12} class={meteo.iconClass} />
                    </div>
                    <span class="hidden sm:inline">{meteo.label}</span>
                  </div>
                {/if}
                <a href="/app/children" class="text-xs text-miel-500 hover:text-miel-700 flex items-center gap-0.5 transition-colors font-medium">
                  Tout voir <ChevronRight size={12} />
                </a>
              {:else}
                <a href="/app/stats" class="text-xs text-miel-500 hover:text-miel-700 flex items-center gap-0.5 transition-colors font-medium">
                  Statistiques <ChevronRight size={12} />
                </a>
              {/if}
            </div>
          </div>

          <!-- Tab content with crossfade -->
          <div
            class="relative bloc2-content bloc2-stretch"
            bind:this={contentEl}
          >
            <!-- Enfants tab -->
            <div
              class="bloc2-tab {bloc2Tab === 'enfants' ? 'bloc2-tab-active' : 'bloc2-tab-hidden'} flex flex-col"
              bind:this={enfantsEl}
            >
              <div class="relative p-1.5 sm:p-4 grid grid-cols-3 sm:grid-cols-2 {sortedChildren.length > 4 ? 'sm:grid-cols-3' : ''} {sortedChildren.length > 6 ? 'lg:grid-cols-4' : ''} gap-1 sm:gap-3 children-grid-stretch">
                {#each displayedChildren as child, i (child.id)}
                  {@const isAbsent = child.isAbsent}
                  {@const needsJournal = !isAbsent && !child.hasLog}
                  {@const hasMood = child.hasLog && child.mood && child.mood in MOOD_CFG}
                  {@const moodKey = child.mood as Mood}
                  <a href="/app/children/{child.id}"
                    class="child-card glass-2 rounded-xl sm:rounded-2xl py-3 px-2 sm:p-5
                      flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2.5
                      {isAbsent ? 'opacity-45' : ''}">
                    <!-- Avatar -->
                    <div class="relative">
                      {#if child.avatarUrl}
                        <img src={child.avatarUrl} alt={child.firstName}
                          class="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover ring-[2.5px] sm:ring-[3px]
                            {isAbsent ? 'ring-warm-200 grayscale'
                            : needsJournal ? 'ring-miel-400 ring-pulse'
                            : hasMood ? MOOD_CFG[moodKey].ring
                            : 'ring-mousse-300'}"
                          loading="lazy" decoding="async" />
                      {:else}
                        <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ring-[2.5px] sm:ring-[3px]
                          {isAbsent ? 'ring-warm-200 grayscale'
                          : needsJournal ? 'ring-miel-400 ring-pulse'
                          : hasMood ? MOOD_CFG[moodKey].ring
                          : 'ring-mousse-300'}
                          {avatarColor(child.firstName + child.lastName)}">
                          {child.firstName[0]}{child.lastName[0]}
                        </div>
                      {/if}

                      <!-- Status indicator -->
                      {#if isAbsent}
                        <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full border-2 border-soie bg-warm-300 flex items-center justify-center">
                          <CalendarX size={7} class="text-white sm:hidden" /><CalendarX size={9} class="text-white hidden sm:block" />
                        </span>
                      {:else if hasMood}
                        <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full border-2 border-soie {MOOD_CFG[moodKey].dot}"></span>
                      {:else if needsJournal}
                        <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full border-2 border-soie bg-miel-400 flex items-center justify-center">
                          <Pencil size={6} class="text-white sm:hidden" /><Pencil size={8} class="text-white hidden sm:block" />
                        </span>
                      {/if}
                    </div>

                    <!-- Name + status -->
                    <div class="flex flex-col items-center gap-0 min-w-0 w-full">
                      <p class="text-[11px] sm:text-[13px] font-bold text-warm-900 truncate w-full text-center leading-tight">{child.firstName}</p>

                      {#if isAbsent}
                        <span class="text-[9px] sm:text-[10px] text-warm-400 font-medium leading-tight">Absent</span>
                      {:else if hasMood}
                        {@const MoodIcon = MOOD_CFG[moodKey].Icon}
                        <span class="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold {MOOD_CFG[moodKey].text} leading-tight">
                          <MoodIcon size={9} class="sm:hidden" /><MoodIcon size={10} class="hidden sm:inline" />
                          {MOOD_CFG[moodKey].label}
                        </span>
                      {:else if needsJournal}
                        <span class="text-[9px] sm:text-[10px] font-bold text-miel-600 leading-tight">Pas de carnet</span>
                      {:else}
                        <span class="text-[9px] sm:text-[10px] text-mousse-500 font-medium leading-tight">Saisi</span>
                      {/if}
                    </div>
                  </a>
                {/each}
              </div>

              {#if hasMore}
                <div class="px-4 py-2 border-t border-white/10 text-center">
                  <a href="/app/children" class="text-xs text-miel-500 hover:text-miel-700 font-semibold transition-colors">
                    + {sortedChildren.length - visibleLimit} enfant{sortedChildren.length - visibleLimit > 1 ? 's' : ''}
                  </a>
                </div>
              {/if}
            </div>

            <!-- Calendrier tab -->
            <div
              class="bloc2-tab {bloc2Tab === 'calendrier' ? 'bloc2-tab-active' : 'bloc2-tab-hidden'}"
              bind:this={calendarEl}
            >
              <div class="calendar-embed h-full">
                <CalendarMonth
                  year={calYear}
                  month={calMonth}
                  events={calEvents}
                  onEventClick={(e) => selectedEvent = e}
                  onNavigate={navigateCalendar}
                />
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    {:else}
      <!-- Empty state -->
      <FadeIn delay={40}>
        <div class="glass-1 rounded-3xl p-8 sm:p-10 flex flex-col items-center text-center">
          <div class="w-16 h-16 rounded-2xl bg-miel-100 flex items-center justify-center mb-4">
            <Baby size={32} class="text-miel-500" />
          </div>
          <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
            Aucun enfant enregistré
          </h3>
          <p class="text-sm text-warm-600 mb-6 max-w-sm leading-relaxed">
            Commencez par ajouter les enfants que vous accueillez pour suivre leur quotidien.
          </p>
          <Button variant="primary" href="/app/children/add">
            Ajouter un enfant
          </Button>
        </div>
      </FadeIn>
    {/if}
    </div>

    <!-- Sidebar: News + Raccourcis stacked -->
    <div class="bloc-sidebar">
      <!-- News -->
      <FadeIn delay={120} class="flex-1 flex flex-col min-h-0">
        <div class="glass-1 rounded-3xl overflow-hidden flex flex-col flex-1 min-h-0">
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <h2 class="font-display font-bold text-warm-900 text-sm">News</h2>
            {#if data.recentNews.length > 0}
              <a href="/app/feed" class="text-xs text-miel-500 hover:text-miel-700 flex items-center gap-0.5 transition-colors font-medium">
                Tout <ChevronRight size={12} />
              </a>
            {/if}
          </div>
          {#if data.recentNews.length > 0}
            <div class="flex-1 overflow-y-auto flex flex-col divide-y divide-white/10 news-scroll min-h-0">
              {#each data.recentNews as news (news.id)}
                <a href="/app/feed" class="news-item flex flex-col gap-1 px-4 py-3 hover:bg-warm-100/10 transition-colors group">
                  <div class="flex items-center gap-2">
                    <span class="text-sm shrink-0">{news.emoji ?? '📸'}</span>
                    <span class="text-xs font-semibold text-miel-600 truncate">{news.childName}</span>
                    <span class="text-[10px] text-warm-400 shrink-0 ml-auto">{timeAgo(news.createdAt)}</span>
                  </div>
                  <p class="text-xs text-warm-700 leading-snug line-clamp-3 group-hover:text-warm-900 transition-colors">
                    {news.content}
                  </p>
                </a>
              {/each}
            </div>
          {:else}
            <div class="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center">
              <Newspaper size={28} class="text-warm-300 mb-2" />
              <p class="text-xs text-warm-500 leading-relaxed">
                Les news apparaitront ici en direct !
              </p>
            </div>
          {/if}
        </div>
      </FadeIn>

    </div>
    </div>

  </div>
{/if}

<!-- Event detail modal (outside grid) -->
{#if selectedEvent}
  {@const EventIcon = kindLabels[selectedEvent.kind]?.Icon ?? Calendar}
  {@const isAbsence = selectedEvent.kind === 'absence'}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop {eventModalClosing ? 'modal-backdrop-out' : ''}"
    onkeydown={(e) => e.key === 'Escape' && closeEventModal()}
  >
    <button
      type="button"
      class="absolute inset-0 cursor-default"
      onclick={closeEventModal}
      aria-label="Fermer le modal"
      tabindex="-1"
    ></button>

    <div class="relative modal-glass max-w-sm w-full {eventModalClosing ? 'modal-exit' : 'modal-enter'}" role="dialog" aria-modal="true">
      <!-- Header with avatar + kind badge -->
      <div class="flex items-center gap-3.5 p-5 pb-4">
        <Avatar name={selectedEvent.childName} size="lg" />
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-display font-bold text-warm-900 leading-tight">{selectedEvent.childName}</h3>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold mt-1
            {isAbsence ? 'bg-sienne-400/12 text-sienne-600' : 'bg-soleil-400/12 text-soleil-700'}">
            <EventIcon size={11} />
            {kindLabels[selectedEvent.kind]?.label ?? selectedEvent.kind}
          </span>
        </div>
        <button
          type="button"
          onclick={closeEventModal}
          class="p-1.5 hover:bg-warm-200/50 rounded-xl transition-colors shrink-0"
          aria-label="Fermer"
        >
          <svg class="w-4 h-4 text-warm-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="px-5 pb-4 space-y-3">
        <div class="glass-2 rounded-xl p-3">
          <p class="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-1">Période</p>
          <p class="text-sm font-medium text-warm-900">{formatEventPeriod(selectedEvent.startDate, selectedEvent.endDate)}</p>
        </div>

        {#if selectedEvent.content}
          <div class="glass-2 rounded-xl p-3">
            <p class="text-[10px] font-bold text-warm-400 uppercase tracking-widest mb-1">Détails</p>
            <p class="text-sm text-warm-800 whitespace-pre-wrap leading-relaxed">{selectedEvent.content}</p>
          </div>
        {/if}

        <div class="flex items-center justify-between">
          <p class="text-[10px] font-bold text-warm-400 uppercase tracking-widest">Statut</p>
          {#if selectedEvent.acknowledgedAt}
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-mousse-400/12 text-mousse-600">
              <span class="w-1.5 h-1.5 rounded-full bg-mousse-400"></span>
              Pris en compte
            </span>
          {:else}
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-miel-400/12 text-miel-700">
              <span class="w-1.5 h-1.5 rounded-full bg-miel-400"></span>
              Nouveau
            </span>
          {/if}
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 pb-5">
        <Button variant="secondary" href="/app/inbox" class="w-full">
          Voir dans la boîte de réception
        </Button>
      </div>
    </div>
  </div>
{/if}
