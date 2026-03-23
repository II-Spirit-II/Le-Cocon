<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import type { MealLevel, MealEntry, NapEntry, DailyLog } from '$lib/types';
  import { enhance } from '$app/forms';
  import { fly } from 'svelte/transition';
  import { goto, invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import { toLocalDateStr } from '$lib/utils/date';
  import { Card, Button, Avatar, Callout, FadeIn, PlateVisual } from '$lib/ui';
  import {
    Smile, Meh, Frown, Moon, UtensilsCrossed, CalendarDays,
    BookOpen, Newspaper, Trash2, Check, ChevronLeft,
    Thermometer, Heart, ChevronRight, Copy, Pencil, Droplets,
    TrendingUp
  } from 'lucide-svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const isAsmmat = $derived(data.role === 'assistante');

  // === State ===
  let isGenerating = $state(false);
  let copiedCode = $state<string | null>(null);
  let highlightedCode = $state<string | null>(null);

  // === Derived data ===
  const lastLog = $derived(data.recentLogs[0] ?? null);
  const lastMood = $derived(lastLog?.mood ?? null);

  // === Helpers ===
  const MOOD_CONFIG = {
    joyeux: { icon: Smile, color: 'text-mousse-600', bg: 'bg-mousse-50', border: 'border-mousse-200', label: 'Joyeux' },
    calme: { icon: Meh, color: 'text-soleil-600', bg: 'bg-soleil-400/10', border: 'border-soleil-400/20', label: 'Calme' },
    grognon: { icon: Frown, color: 'text-argile-500', bg: 'bg-argile-400/10', border: 'border-argile-400/20', label: 'Grognon' }
  } as const;

  const MOOD_DOT = {
    joyeux: 'bg-mousse-400',
    calme: 'bg-soleil-400',
    grognon: 'bg-argile-400'
  } as const;

  type Mood = keyof typeof MOOD_CONFIG;

  const NAP_QUALITY: Record<string, string> = {
    paisible: 'Paisible',
    normale: 'Normale',
    agitee: 'Agitée'
  };

  const MEAL_LABELS: Record<string, string> = {
    'petit-dejeuner': 'Petit-déj.',
    'dejeuner': 'Déjeuner',
    'gouter': 'Goûter',
    'diner': 'Dîner'
  };

  const QUANTITY_LABELS: Record<string, string> = {
    'non-mange': 'Pas mangé', 'peu': 'Peu mangé', 'bien': 'Bien mangé', 'tres-bien': 'Très bien mangé'
  };

  function quantityToLevel(q: string): MealLevel {
    const map: Record<string, MealLevel> = {
      'non-mange': 0, 'peu': 1, 'bien': 2, 'tres-bien': 3
    };
    return map[q] ?? 0;
  }

  function calculateAge(birthDate: string): string {
    const birth = new Date(birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

    if (months < 12) return `${months} mois`;

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (remainingMonths === 0) return `${years} an${years > 1 ? 's' : ''}`;
    return `${years} an${years > 1 ? 's' : ''} et ${remainingMonths} mois`;
  }

  function formatDate(dateStr: string | Date): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function relativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "A l'instant";
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return date.toLocaleDateString('fr-FR', { weekday: 'long' });
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function napDuration(nap: NapEntry): string {
    const [sh, sm] = nap.startTime.split(':').map(Number);
    const [eh, em] = nap.endTime.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return '-';
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
  }

  // ─── Week navigation ──────────────────────────────────────────
  const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const weekDays = $derived.by(() => {
    if (!data.weekStart) return [];
    const days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(data.weekStart + 'T00:00:00');
      d.setDate(d.getDate() + i);
      days.push(toLocalDateStr(d));
    }
    return days;
  });

  const journalsByDate = $derived.by(() => {
    const map = new Map<string, DailyLog>();
    for (const j of data.recentLogs) {
      map.set(j.date, j);
    }
    return map;
  });

  let selectedDay = $state('');
  $effect(() => {
    if (data.today) {
      selectedDay = weekDays.includes(data.today) ? data.today : (weekDays[0] ?? '');
    }
  });

  const selectedDayJournal = $derived(journalsByDate.get(selectedDay) ?? null);

  function navigateWeek(direction: -1 | 1) {
    const d = new Date(data.weekStart + 'T00:00:00');
    d.setDate(d.getDate() + direction * 7);
    const newWeek = toLocalDateStr(d);
    goto(`/app/children/${data.child.id}?week=${newWeek}`, { replaceState: false });
  }

  const isCurrentWeek = $derived.by(() => {
    if (!data.weekStart || !data.today) return false;
    const todayDate = new Date(data.today + 'T00:00:00');
    const weekStartDate = new Date(data.weekStart + 'T00:00:00');
    const weekEndDate = new Date(data.weekEnd + 'T00:00:00');
    return todayDate >= weekStartDate && todayDate <= weekEndDate;
  });

  function formatWeekLabel(start: string, end: string): string {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const sDay = s.getDate();
    const eDay = e.getDate();
    const sMonth = s.toLocaleDateString('fr-FR', { month: 'short' });
    const eMonth = e.toLocaleDateString('fr-FR', { month: 'short' });
    if (sMonth === eMonth) return `${sDay} - ${eDay} ${sMonth}`;
    return `${sDay} ${sMonth} - ${eDay} ${eMonth}`;
  }

  function formatDayLabel(dateStr: string): string {
    return String(new Date(dateStr + 'T00:00:00').getDate());
  }

  function isDayFuture(dateStr: string): boolean {
    return dateStr > data.today;
  }

  function formatJournalDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.getTime() === today.getTime()) return "Aujourd'hui";
    if (date.getTime() === yesterday.getTime()) return 'Hier';
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ─── Weekly summary ───────────────────────────────────────────
  const weeklyStats = $derived.by(() => {
    const logs = data.recentLogs;
    const count = logs.length;
    if (count === 0) return null;

    const moods = { joyeux: 0, calme: 0, grognon: 0 };
    logs.forEach((l: DailyLog) => { if (l.mood in moods) moods[l.mood as Mood]++; });
    const dominantMood = (Object.entries(moods) as [Mood, number][])
      .sort((a, b) => b[1] - a[1])[0];

    const qMap: Record<string, number> = { 'non-mange': 0, 'peu': 1, 'bien': 2, 'tres-bien': 3 };
    let mealTotal = 0, mealCount = 0;
    logs.forEach((l: DailyLog) => {
      l.meals.forEach((m) => {
        if (m.quantity in qMap) { mealTotal += qMap[m.quantity]; mealCount++; }
      });
    });
    const mealAvg = mealCount > 0 ? mealTotal / mealCount : null;
    const mealLabel = mealAvg === null ? null
      : mealAvg >= 2.5 ? 'Très bien mangé'
      : mealAvg >= 1.5 ? 'Bien mangé'
      : mealAvg >= 0.5 ? 'Peu mangé'
      : 'Très peu mangé';

    let napMinutes = 0, napCount = 0;
    logs.forEach((l: DailyLog) => {
      if (l.nap?.startTime && l.nap?.endTime) {
        const [sh, sm] = l.nap.startTime.split(':').map(Number);
        const [eh, em] = l.nap.endTime.split(':').map(Number);
        const dur = (eh * 60 + em) - (sh * 60 + sm);
        if (dur > 0) { napMinutes += dur; napCount++; }
      }
    });
    const napAvg = napCount > 0 ? Math.round(napMinutes / napCount) : null;
    const napLabel = napAvg === null ? null
      : napAvg >= 60 ? `${Math.floor(napAvg / 60)}h${napAvg % 60 > 0 ? String(napAvg % 60).padStart(2, '0') : ''} en moy.`
      : `${napAvg} min en moy.`;

    const changesTotal = logs.reduce((a: number, l: DailyLog) => a + l.changes, 0);
    const changesAvg = Math.round(changesTotal / count);

    return {
      count,
      dominantMood: dominantMood[0] as Mood,
      dominantMoodCount: dominantMood[1],
      moods,
      mealAvg,
      mealLabel,
      napAvg,
      napLabel,
      changesAvg
    };
  });

  // ─── Sparkline graph ──────────────────────────────────────────
  type GraphTab = 'mood' | 'meals' | 'nap' | 'changes';
  const MOOD_NUM: Record<string, number> = { grognon: 0, calme: 1, joyeux: 2 };
  const MEAL_NUM: Record<string, number> = { 'non-mange': 0, 'peu': 1, 'bien': 2, 'tres-bien': 3 };

  interface SparkPoint { x: number; y: number; val: number; idx: number }

  const GRAPH_PAD_L = 48;
  const GRAPH_PAD_R = 20;
  const GRAPH_PAD_T = 20;
  const GRAPH_PAD_B = 20;

  function buildSpark(
    values: (number | null)[],
    w: number, h: number,
    minV: number, maxV: number
  ): { line: string; area: string; dots: SparkPoint[] } {
    const uw = w - GRAPH_PAD_L - GRAPH_PAD_R;
    const uh = h - GRAPH_PAD_T - GRAPH_PAD_B;
    const colW = uw / 7;
    const dots: SparkPoint[] = [];

    for (let i = 0; i < values.length; i++) {
      if (values[i] !== null) {
        const x = GRAPH_PAD_L + (i + 0.5) * colW;
        const norm = maxV === minV ? 0.5 : (values[i]! - minV) / (maxV - minV);
        const y = GRAPH_PAD_T + uh - norm * uh;
        dots.push({ x, y, val: values[i]!, idx: i });
      }
    }
    if (dots.length < 2) return { line: '', area: '', dots };

    let line = `M${dots[0].x},${dots[0].y}`;
    for (let i = 1; i < dots.length; i++) {
      line += `L${dots[i].x},${dots[i].y}`;
    }
    return { line, area: '', dots };
  }

  function gridY(level: 0 | 1 | 2): number {
    const uh = GRAPH_H - GRAPH_PAD_T - GRAPH_PAD_B;
    return GRAPH_PAD_T + uh - (level / 2) * uh;
  }

  const GRAPH_W = 480, GRAPH_H = 200;

  type YAxisLevel = { icon: typeof Smile; color: string; level: 0 | 1 | 2 };
  const Y_AXIS_ICONS: Record<GraphTab, YAxisLevel[]> = {
    mood:    [{ icon: Frown,  color: '#C2635A', level: 0 }, { icon: Meh,   color: '#E5B03A', level: 1 }, { icon: Smile, color: '#5FA05B', level: 2 }],
    meals:   [{ icon: UtensilsCrossed, color: '#B89E86', level: 0 }, { icon: UtensilsCrossed, color: '#C2653A80', level: 1 }, { icon: UtensilsCrossed, color: '#C2653A', level: 2 }],
    nap:     [{ icon: Moon, color: '#B89E86', level: 0 }, { icon: Moon, color: '#6A96AB80', level: 1 }, { icon: Moon, color: '#6A96AB', level: 2 }],
    changes: [{ icon: Droplets, color: '#B89E86', level: 0 }, { icon: Droplets, color: '#6A96AB80', level: 1 }, { icon: Droplets, color: '#6A96AB', level: 2 }],
  };

  const sparklines = $derived.by(() => {
    const moodVals: (number | null)[] = [];
    const mealVals: (number | null)[] = [];
    const napVals: (number | null)[] = [];
    const changeVals: (number | null)[] = [];

    for (const dayStr of weekDays) {
      const j = journalsByDate.get(dayStr);
      if (!j) { moodVals.push(null); mealVals.push(null); napVals.push(null); changeVals.push(null); continue; }

      moodVals.push(MOOD_NUM[j.mood] ?? null);
      changeVals.push(j.changes);

      if (j.meals.length > 0) {
        mealVals.push(j.meals.reduce((s, m) => s + (MEAL_NUM[m.quantity] ?? 0), 0) / j.meals.length);
      } else { mealVals.push(null); }

      if (j.nap?.startTime && j.nap?.endTime) {
        const [sh, sm] = j.nap.startTime.split(':').map(Number);
        const [eh, em] = j.nap.endTime.split(':').map(Number);
        const dur = (eh * 60 + em) - (sh * 60 + sm);
        napVals.push(dur > 0 ? dur : null);
      } else { napVals.push(null); }
    }

    return {
      mood:    buildSpark(moodVals, GRAPH_W, GRAPH_H, 0, 2),
      meals:   buildSpark(mealVals, GRAPH_W, GRAPH_H, 0, 3),
      nap:     buildSpark(napVals, GRAPH_W, GRAPH_H, 0, Math.max(...napVals.filter(v => v !== null) as number[], 60)),
      changes: buildSpark(changeVals, GRAPH_W, GRAPH_H, 0, Math.max(...changeVals.filter(v => v !== null) as number[], 4)),
    };
  });

  function estimatePathLength(dots: SparkPoint[]): number {
    if (dots.length < 2) return 0;
    let len = 0;
    for (let i = 1; i < dots.length; i++) {
      const dx = dots[i].x - dots[i - 1].x;
      const dy = dots[i].y - dots[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return Math.ceil(len);
  }

  const GRAPH_TABS: { key: GraphTab; label: string; icon: typeof Smile; color: string; stroke: string; avgLabel: () => string | null }[] = [
    { key: 'mood', label: 'Humeur', icon: Smile, color: 'text-mousse-500', stroke: '#5FA05B',
      avgLabel: () => weeklyStats ? MOOD_CONFIG[weeklyStats.dominantMood].label : null },
    { key: 'meals', label: 'Repas', icon: UtensilsCrossed, color: 'text-sienne-500', stroke: '#C2653A',
      avgLabel: () => weeklyStats?.mealLabel ?? null },
    { key: 'nap', label: 'Sieste', icon: Moon, color: 'text-bleu-400', stroke: '#6A96AB',
      avgLabel: () => weeklyStats?.napLabel ?? null },
    { key: 'changes', label: 'Changes', icon: Droplets, color: 'text-bleu-400', stroke: '#6A96AB',
      avgLabel: () => weeklyStats ? `${weeklyStats.changesAvg}/j` : null },
  ];
  let activeGraph = $state<GraphTab>('mood');
  const activeGraphIndex = $derived(GRAPH_TABS.findIndex(t => t.key === activeGraph));

  // Touch swipe for graph
  let touchStartX = $state(0);
  let touchDeltaX = $state(0);
  let isSwiping = $state(false);

  function onTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchDeltaX = 0;
    isSwiping = true;
  }
  function onTouchMove(e: TouchEvent) {
    if (!isSwiping) return;
    touchDeltaX = e.touches[0].clientX - touchStartX;
  }
  function onTouchEnd() {
    if (!isSwiping) return;
    isSwiping = false;
    if (Math.abs(touchDeltaX) > 50) {
      const dir = touchDeltaX < 0 ? 1 : -1;
      const next = activeGraphIndex + dir;
      if (next >= 0 && next < GRAPH_TABS.length) {
        activeGraph = GRAPH_TABS[next].key;
      }
    }
    touchDeltaX = 0;
  }

  // ─── Actions helpers ──────────────────────────────────────────
  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    copiedCode = code;
    setTimeout(() => copiedCode = null, 2000);
  }

  $effect(() => {
    if (form?.avatarUploaded || form?.avatarDeleted) {
      invalidateAll();
    }
  });

  $effect(() => {
    if (form?.newCode) {
      highlightedCode = form.newCode;
      setTimeout(() => highlightedCode = null, 3000);
    }
  });
</script>

<style>
  .day-btn {
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
  }
  .day-btn:hover:not(:disabled) {
    transform: scale(1.1);
  }

  .graph-carousel {
    transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .graph-tab {
    transition: color 0.2s, background-color 0.2s;
  }

  .curve-glow {
    stroke-dasharray: var(--path-length);
    stroke-dashoffset: var(--path-length);
    animation: curveDraw 2.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0.4;
  }
  .curve-line {
    stroke-dasharray: var(--path-length);
    stroke-dashoffset: var(--path-length);
    animation: curveDraw 2.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes curveDraw {
    to { stroke-dashoffset: 0; }
  }

  .mood-icon-pop {
    animation: moodPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  @keyframes moodPop {
    0% { opacity: 0; transform: scale(0.6) translateY(4px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .curve-line, .curve-glow, .mood-icon-pop {
      animation: none !important;
      stroke-dashoffset: 0 !important;
      opacity: 1 !important;
      transform: none !important;
    }
    .day-btn, .graph-tab { transition: none !important; }
    .graph-carousel { transition: none !important; }
  }

  /* Codes card: fixed cell height, internal scroll */
  .bento :global(.bento-codes) {
    height: 200px;
    min-height: 200px;
    max-height: 200px;
  }
  .bento :global(.bento-codes .glass-1) {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .codes-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(184, 158, 134, 0.3) transparent;
  }
  .codes-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .codes-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .codes-scroll::-webkit-scrollbar-thumb {
    background: rgba(184, 158, 134, 0.3);
    border-radius: 4px;
  }

  /* ── Bento grid ── */

  /* Mobile: single column, natural flow, each block scrollable */
  .bento {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* On mobile, journal gets auto height (no constraint) */
  .bento :global(.bento-hero) { order: 0; }
  .bento :global(.bento-journal) { order: 1; }
  .bento :global(.bento-trends) { order: 2; }
  .bento :global(.bento-news) { order: 3; }
  .bento :global(.bento-codes) { order: 4; }
  .bento :global(.bento-presence) { order: 5; }

  /* Tablet: 2-column grid */
  @media (min-width: 768px) {
    .bento {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-template-areas:
        "hero     hero"
        "journal  journal"
        "trends   trends"
        "news     codes"
        "presence .";
    }
    .bento-parent {
      grid-template-areas:
        "hero     hero"
        "journal  journal"
        "trends   trends"
        "news     presence";
    }
    .bento :global(.bento-hero) { grid-area: hero; }
    .bento :global(.bento-journal) { grid-area: journal; }
    .bento :global(.bento-trends) { grid-area: trends; }
    .bento :global(.bento-news) { grid-area: news; }
    .bento :global(.bento-codes) { grid-area: codes; }
    .bento :global(.bento-presence) { grid-area: presence; }
  }

  /* Desktop: 2-column with journal spanning 2 rows, grid constrains heights */
  @media (min-width: 1024px) {
    .bento {
      grid-template-columns: 3fr 2fr;
      grid-template-areas:
        "hero     hero"
        "journal  trends"
        "journal  news"
        "codes    presence";
    }
    .bento-parent {
      grid-template-areas:
        "hero     hero"
        "journal  trends"
        "journal  news"
        "journal  presence";
    }
    .bento :global(.bento-journal) { min-height: 0; }
    .bento :global(.bento-trends) { min-height: 0; }
    .bento :global(.bento-news) { min-height: 0; }
  }

  /* Subtle scrollbar for journal content */
  .journal-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(184, 158, 134, 0.2) transparent;
  }
  .journal-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .journal-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .journal-scroll::-webkit-scrollbar-thumb {
    background: rgba(184, 158, 134, 0.2);
    border-radius: 4px;
  }
  .journal-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(184, 158, 134, 0.35);
  }
</style>

<!-- Alerts -->
{#if form?.error}
  <Callout variant="warning">{form.error}</Callout>
{/if}
{#if form?.avatarUploaded}
  <Callout variant="success">Photo mise à jour</Callout>
{/if}

{#key data.weekStart}
<div class="bento {isAsmmat ? '' : 'bento-parent'}">

  <!-- ══════ HERO: Identity + Week nav + Day selector ══════ -->
  <FadeIn class="bento-hero">
    <div class="glass-1 rounded-3xl p-5 sm:p-6">

      <!-- Top: avatar + name + week nav -->
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-4 min-w-0">
          <div class="relative shrink-0">
            {#if data.avatarUrl}
              <img src={data.avatarUrl} alt={data.child.firstName}
                class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-miel-100 shadow-sm"
                loading="lazy" decoding="async" />
            {:else}
              <Avatar name={data.child.firstName} size="xl" />
            {/if}
            {#if lastMood && lastMood in MOOD_DOT}
              <div class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-soie {MOOD_DOT[lastMood as Mood]}"></div>
            {/if}
          </div>
          <div class="min-w-0">
            <h1 class="text-xl sm:text-2xl font-display font-bold text-warm-900 truncate leading-tight">
              {data.child.firstName} {data.child.lastName}
            </h1>
            <p class="text-warm-500 text-sm">{calculateAge(data.child.birthDate)}</p>
          </div>
        </div>

        <!-- Action buttons (assistante only) -->
        {#if isAsmmat}
          <div class="flex gap-2 w-full sm:w-auto">
            <a href="/app/journal/new?child={data.child.id}"
              class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                bg-miel-500 text-white hover:bg-miel-600 transition-colors shadow-sm shadow-miel-500/20">
              <BookOpen size={15} />
              Rédiger le carnet
            </a>
            <a href="/app/journal/batch"
              class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                glass-2 text-warm-700 hover:text-warm-900 hover:bg-warm-100/60 transition-colors">
              <Pencil size={15} />
              Saisie rapide
            </a>
          </div>
        {/if}

        <!-- Week navigation -->
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" onclick={() => navigateWeek(-1)}
            class="p-1.5 rounded-lg glass-2 text-warm-500 hover:text-warm-800 transition-colors cursor-pointer outline-none"
            aria-label="Semaine précédente">
            <ChevronLeft size={16} />
          </button>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-2">
            <CalendarDays size={13} class="text-miel-500" />
            <span class="text-xs font-semibold text-warm-700">
              {formatWeekLabel(data.weekStart, data.weekEnd)}
            </span>
          </div>
          <button type="button" onclick={() => navigateWeek(1)} disabled={isCurrentWeek}
            class="p-1.5 rounded-lg glass-2 transition-colors cursor-pointer outline-none
              {isCurrentWeek ? 'text-warm-300 cursor-default' : 'text-warm-500 hover:text-warm-800'}"
            aria-label="Semaine suivante">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <!-- Day selector strip -->
      <div class="grid grid-cols-7 mt-4 pt-3 border-t border-white/10">
        {#each weekDays as dayStr, i (dayStr)}
          {@const isFuture = isDayFuture(dayStr)}
          {@const isToday = dayStr === data.today}
          {@const isSelected = dayStr === selectedDay}
          {@const dayJournal = journalsByDate.get(dayStr)}
          <button type="button" disabled={isFuture}
            onclick={() => { if (!isFuture) selectedDay = dayStr; }}
            class="day-btn flex flex-col items-center gap-1 py-1 cursor-pointer outline-none
              {isFuture ? 'opacity-30 cursor-default' : ''}">
            <span class="text-[10px] font-semibold uppercase tracking-wider
              {isSelected ? 'text-miel-600' : 'text-warm-400'}">{DAYS_FR[i]}</span>
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-200
              {isSelected
                ? 'bg-miel-500 text-white shadow-md shadow-miel-500/25'
                : isToday
                  ? 'ring-1 ring-miel-300/50 text-miel-600'
                  : 'text-warm-600 hover:bg-warm-100/50'}">
              {formatDayLabel(dayStr)}
            </div>
            {#if dayJournal?.mood && dayJournal.mood in MOOD_DOT}
              <div class="w-1.5 h-1.5 rounded-full {MOOD_DOT[dayJournal.mood as Mood]}"></div>
            {:else}
              <div class="w-1.5 h-1.5"></div>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Weekly summary badges -->
      {#if weeklyStats}
        {@const mc = MOOD_CONFIG[weeklyStats.dominantMood]}
        <div class="flex items-center gap-2 mt-3 flex-wrap">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-2 text-[11px] font-medium text-warm-700">
            <mc.icon size={12} class={mc.color} />
            {mc.label}
          </div>
          {#if weeklyStats.mealLabel}
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-2 text-[11px] font-medium text-warm-700">
              <UtensilsCrossed size={12} class="text-sienne-400" />
              {weeklyStats.mealLabel}
            </div>
          {/if}
          {#if weeklyStats.napLabel}
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-2 text-[11px] font-medium text-warm-700">
              <Moon size={12} class="text-bleu-400" />
              {weeklyStats.napLabel}
            </div>
          {/if}
        </div>
      {/if}

    </div>
  </FadeIn>

  <!-- ══════ JOURNAL ══════ -->
  <FadeIn delay={40} class="bento-journal h-full">
    <Card padding="md" class="h-full flex flex-col">
          <!-- Header: date + mood badge -->
          <div class="flex items-center justify-between mb-3 shrink-0">
            <div>
              <h2 class="font-display font-bold text-lg text-warm-900">{formatJournalDate(selectedDay)}</h2>
              {#if selectedDayJournal}
                <p class="text-[11px] text-warm-400 mt-0.5">Carnet du jour</p>
              {/if}
            </div>
            {#if selectedDayJournal?.mood && selectedDayJournal.mood in MOOD_CONFIG}
              {@const moodKey = selectedDayJournal.mood as Mood}
              {@const mc = MOOD_CONFIG[moodKey]}
              <div class="flex items-center gap-2 px-3 py-1.5 rounded-2xl {mc.bg} {mc.border} border">
                <mc.icon size={16} class={mc.color} />
                <span class="text-xs font-bold {mc.color}">{mc.label}</span>
              </div>
            {/if}
          </div>

          <div class="flex-1 overflow-y-auto overflow-x-hidden journal-scroll">
          {#if selectedDayJournal}
            {@const journal = selectedDayJournal}
            <div class="flex flex-col gap-3 h-full">

              <!-- Meals -->
              {#if journal.meals.length > 0}
                <div class="glass-2 rounded-xl p-3.5">
                  <div class="flex items-center gap-1.5 mb-2.5">
                    <UtensilsCrossed size={14} class="text-sienne-500" />
                    <span class="text-[11px] font-bold text-warm-700 uppercase tracking-wider">Repas</span>
                  </div>
                  <div class="flex items-center justify-center gap-4 flex-wrap">
                    {#each journal.meals as meal}
                      <div class="flex flex-col items-center gap-1.5 min-w-[65px]">
                        <PlateVisual level={quantityToLevel(meal.quantity)} size="sm" />
                        <p class="text-[11px] font-semibold text-warm-800 leading-tight">{MEAL_LABELS[meal.type] ?? meal.type}</p>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Nap + Changes -->
              <div class="grid grid-cols-2 gap-2.5">
                <div class="glass-2 rounded-xl p-3 text-center">
                  <div class="flex items-center gap-1.5 justify-center mb-1.5">
                    <Moon size={13} class="text-bleu-400" />
                    <span class="text-[11px] font-bold text-warm-600 uppercase tracking-wider">Sieste</span>
                  </div>
                  {#if journal.nap}
                    <p class="text-base font-bold text-warm-900 tabular-nums leading-tight">{journal.nap.startTime} - {journal.nap.endTime}</p>
                    {#if journal.nap.quality && NAP_QUALITY[journal.nap.quality]}
                      <p class="text-[11px] text-bleu-400 font-medium mt-0.5">{NAP_QUALITY[journal.nap.quality]}</p>
                    {/if}
                  {:else}
                    <p class="text-sm text-warm-400 italic">Pas de sieste</p>
                  {/if}
                </div>

                <div class="glass-2 rounded-xl p-3 text-center">
                  <div class="flex items-center gap-1.5 justify-center mb-1.5">
                    <Droplets size={13} class="text-bleu-400" />
                    <span class="text-[11px] font-bold text-warm-600 uppercase tracking-wider">Changes</span>
                  </div>
                  <p class="text-base font-bold text-warm-900 leading-tight">{journal.changes}</p>
                </div>
              </div>

              <!-- Health — always visible, same size -->
              <div class="rounded-xl px-3.5 py-3 {journal.health && (journal.health.temperature || journal.health.symptoms || journal.health.medication) ? 'bg-argile-400/8 ring-1 ring-argile-400/15' : 'glass-2'}">
                {#if journal.health && (journal.health.temperature || journal.health.symptoms || journal.health.medication)}
                  <div class="flex items-center gap-3 flex-wrap text-sm">
                    <Thermometer size={14} class="text-argile-400 shrink-0" />
                    {#if journal.health.temperature}
                      <span class="font-semibold text-warm-800">{journal.health.temperature}°C</span>
                    {/if}
                    {#if journal.health.symptoms}
                      <span class="text-warm-700">{journal.health.symptoms}</span>
                    {/if}
                    {#if journal.health.medication}
                      <span class="text-sienne-600 font-medium">{journal.health.medication}</span>
                    {/if}
                  </div>
                {:else}
                  <div class="flex items-center gap-2 text-sm text-mousse-500">
                    <Heart size={14} />
                    <span class="font-medium">Tout va bien</span>
                  </div>
                {/if}
              </div>

              <!-- Notes -->
              {#if journal.notes}
                <div class="border-t border-warm-200/30 pt-3">
                  <div class="flex items-start gap-2.5">
                    <Pencil size={13} class="text-miel-500 shrink-0 mt-0.5" />
                    <p class="text-sm text-warm-700 leading-snug line-clamp-3">{journal.notes}</p>
                  </div>
                </div>
              {/if}

            </div>

          {:else if isDayFuture(selectedDay)}
            <div class="flex flex-col items-center justify-center text-center h-full">
              <CalendarDays size={36} class="text-warm-300/60 mb-3" />
              <p class="text-sm text-warm-500 font-medium">Ce jour n'est pas encore arrivé</p>
            </div>
          {:else}
            <div class="flex flex-col items-center justify-center text-center h-full">
              <div class="w-12 h-12 rounded-2xl bg-warm-100/60 flex items-center justify-center mb-3">
                <BookOpen size={22} class="text-warm-400" />
              </div>
              <p class="text-sm text-warm-600 font-medium">Pas de carnet</p>
              <p class="text-[11px] text-warm-400 mt-1">L'assistante n'a pas encore saisi le carnet</p>
            </div>
          {/if}
          </div>
    </Card>
  </FadeIn>

  <!-- ══════ TENDANCES ══════ -->
  <FadeIn delay={80} class="bento-trends h-full">
    <Card padding="md" class="h-full flex flex-col overflow-hidden">
          <div class="flex items-center justify-between mb-2 shrink-0">
            <h3 class="font-display font-bold text-base text-warm-900">Tendances</h3>
            <div class="flex gap-0.5">
              {#each GRAPH_TABS as tab (tab.key)}
                <button type="button" onclick={() => activeGraph = tab.key}
                  class="graph-tab p-1.5 rounded-lg cursor-pointer outline-none
                    {activeGraph === tab.key ? 'glass-2 text-warm-900' : 'text-warm-400 hover:text-warm-600'}">
                  <tab.icon size={14} class={activeGraph === tab.key ? tab.color : ''} />
                </button>
              {/each}
            </div>
          </div>

          <!-- Average pill (fixed height to prevent layout shift) -->
          <div class="h-6 mb-1">
          {#each GRAPH_TABS as tab (tab.key)}
            {#if tab.key === activeGraph}
              {@const avg = tab.avgLabel()}
              {#if avg}
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg glass-2"
                    style="color: {tab.stroke}">
                    <TrendingUp size={10} />
                    Moy. : {avg}
                  </span>
              {/if}
            {/if}
          {/each}
          </div>

          <!-- Chart area -->
          <div class="h-36 overflow-hidden rounded-xl" role="region" aria-label="Graphiques de tendances"
            ontouchstart={onTouchStart} ontouchmove={onTouchMove} ontouchend={onTouchEnd}>
            <div class="graph-carousel flex h-full"
              style="transform: translateX(calc(-{activeGraphIndex * 100}% + {isSwiping ? touchDeltaX : 0}px));
                     {isSwiping ? 'transition: none;' : ''}">
              {#each GRAPH_TABS as tab (tab.key)}
                {@const spark = sparklines[tab.key]}
                {@const pathLen = estimatePathLength(spark.dots)}
                <div class="w-full shrink-0 relative">
                  <!-- Y-axis icons -->
                  <div class="absolute left-0.5 flex flex-col justify-between pointer-events-none"
                    style="top: {(GRAPH_PAD_T / GRAPH_H) * 100}%; bottom: {(GRAPH_PAD_B / GRAPH_H) * 100}%;">
                    {#each [...Y_AXIS_ICONS[tab.key]].reverse() as lvl}
                      <div style="color: {lvl.color}; opacity: 0.85">
                        <lvl.icon size={14} />
                      </div>
                    {/each}
                  </div>
                  <!-- SVG chart -->
                  <svg viewBox="0 0 {GRAPH_W} {GRAPH_H}" class="w-full h-full" preserveAspectRatio="none">
                    {#each [0, 1, 2] as level}
                      {@const ly = gridY(level as 0 | 1 | 2)}
                      <line x1={GRAPH_PAD_L} y1={ly} x2={GRAPH_W - GRAPH_PAD_R} y2={ly}
                        stroke="#B89E86" stroke-opacity={level === 0 ? '0.12' : '0.06'} stroke-width="0.5" stroke-dasharray="4,3" />
                    {/each}
                    {#if spark.line}
                      {#key activeGraph}
                        <path d={spark.line} fill="none" stroke={tab.stroke} stroke-width="6" stroke-linecap="round" stroke-linejoin="round"
                          filter="blur(4px)" class="curve-glow" style="--path-length: {pathLen}" />
                        <path d={spark.line} fill="none" stroke={tab.stroke} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                          class="curve-line" style="--path-length: {pathLen}" />
                      {/key}
                      {@const selIdx = weekDays.indexOf(selectedDay)}
                      {#if selIdx >= 0}
                        {@const selX = GRAPH_PAD_L + (selIdx + 0.5) * ((GRAPH_W - GRAPH_PAD_L - GRAPH_PAD_R) / 7)}
                        <line x1={selX} y1={GRAPH_PAD_T} x2={selX} y2={GRAPH_H - GRAPH_PAD_B}
                          stroke="#E8913A" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="3,3" />
                      {/if}
                    {:else}
                      {@const demoPath = `M${GRAPH_PAD_L + 0.5 * ((GRAPH_W - GRAPH_PAD_L - GRAPH_PAD_R) / 7)},${GRAPH_PAD_T + (GRAPH_H - GRAPH_PAD_T - GRAPH_PAD_B) * 0.55}L${GRAPH_PAD_L + 1.5 * ((GRAPH_W - GRAPH_PAD_L - GRAPH_PAD_R) / 7)},${GRAPH_PAD_T + (GRAPH_H - GRAPH_PAD_T - GRAPH_PAD_B) * 0.35}L${GRAPH_PAD_L + 2.5 * ((GRAPH_W - GRAPH_PAD_L - GRAPH_PAD_R) / 7)},${GRAPH_PAD_T + (GRAPH_H - GRAPH_PAD_T - GRAPH_PAD_B) * 0.6}L${GRAPH_PAD_L + 3.5 * ((GRAPH_W - GRAPH_PAD_L - GRAPH_PAD_R) / 7)},${GRAPH_PAD_T + (GRAPH_H - GRAPH_PAD_T - GRAPH_PAD_B) * 0.25}L${GRAPH_PAD_L + 4.5 * ((GRAPH_W - GRAPH_PAD_L - GRAPH_PAD_R) / 7)},${GRAPH_PAD_T + (GRAPH_H - GRAPH_PAD_T - GRAPH_PAD_B) * 0.45}L${GRAPH_PAD_L + 5.5 * ((GRAPH_W - GRAPH_PAD_L - GRAPH_PAD_R) / 7)},${GRAPH_PAD_T + (GRAPH_H - GRAPH_PAD_T - GRAPH_PAD_B) * 0.2}`}
                      {#key activeGraph}
                        <path d={demoPath} fill="none" stroke={tab.stroke} stroke-width="6" stroke-linecap="round" stroke-linejoin="round"
                          filter="blur(4px)" class="curve-glow" style="--path-length: 600" opacity="0.15" />
                        <path d={demoPath} fill="none" stroke={tab.stroke} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
                          class="curve-line" style="--path-length: 600" opacity="0.18" />
                      {/key}
                    {/if}
                  </svg>
                  {#if !spark.line}
                    <div class="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
                      <p class="text-[10px] text-warm-400 text-center font-medium">
                        Donnees insuffisantes
                      </p>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Selected day data + carousel dots (fixed height to prevent layout shift) -->
          <div class="flex items-center justify-between mt-2 h-5">
            <div class="flex-1 min-w-0">
              {#if selectedDayJournal}
                {#key `${selectedDay}-${activeGraph}`}
                  <div class="mood-icon-pop">
                    {#if activeGraph === 'mood' && selectedDayJournal.mood}
                      {@const moodKey = selectedDayJournal.mood as Mood}
                      {@const mc = MOOD_CONFIG[moodKey]}
                      <span class="inline-flex items-center gap-1 text-[10px] font-semibold {mc.color}">
                        <mc.icon size={12} /> {mc.label}
                      </span>
                    {:else if activeGraph === 'meals' && selectedDayJournal.meals.length > 0}
                      {@const avgQ = selectedDayJournal.meals.reduce((s, m) => s + (MEAL_NUM[m.quantity] ?? 0), 0) / selectedDayJournal.meals.length}
                      <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-sienne-500">
                        <UtensilsCrossed size={12} /> {avgQ >= 2.5 ? 'Tres bien' : avgQ >= 1.5 ? 'Bien' : 'Peu'}
                      </span>
                    {:else if activeGraph === 'nap' && selectedDayJournal.nap?.startTime && selectedDayJournal.nap?.endTime}
                      <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-bleu-500">
                        <Moon size={12} /> {napDuration(selectedDayJournal.nap)}
                      </span>
                    {:else if activeGraph === 'changes'}
                      <span class="inline-flex items-center gap-1 text-[10px] font-semibold text-bleu-500">
                        <Droplets size={12} /> {selectedDayJournal.changes}
                      </span>
                    {/if}
                  </div>
                {/key}
              {/if}
            </div>
            <div class="flex gap-1">
              {#each GRAPH_TABS as tab (tab.key)}
                <button type="button" onclick={() => activeGraph = tab.key}
                  aria-label={tab.label}
                  class="w-1.5 h-1.5 rounded-full transition-[width,background-color] duration-300 cursor-pointer outline-none
                    {activeGraph === tab.key ? 'w-3.5 bg-miel-400' : 'bg-warm-300 hover:bg-warm-400'}"></button>
              {/each}
            </div>
          </div>
    </Card>
  </FadeIn>

  <!-- ══════ NEWS ══════ -->
  <FadeIn delay={120} class="bento-news h-full">
    <Card padding="md" class="h-full">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-display font-bold text-base text-warm-900">News</h3>
            <a href="/app/feed" class="text-xs text-miel-600 hover:text-miel-700 font-medium flex items-center gap-0.5">
              Tout <ChevronRight size={12} />
            </a>
          </div>
          {#if data.recentNews.length > 0}
            <div class="space-y-2.5">
              {#each data.recentNews.slice(0, 2) as news (news.id)}
                <div class="flex items-start gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-miel-50 flex items-center justify-center shrink-0 mt-0.5">
                    {#if news.emoji}
                      <span class="text-xs">{news.emoji}</span>
                    {:else}
                      <Newspaper size={12} class="text-miel-500" />
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-warm-800 line-clamp-2 leading-snug">{news.content}</p>
                    <p class="text-[10px] text-warm-400 mt-0.5">{relativeTime(news.createdAt)}</p>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex items-center justify-center py-8">
              <p class="text-xs text-warm-400">Aucune news</p>
            </div>
          {/if}
    </Card>
  </FadeIn>

  <!-- ══════ CODES (assistante only) ══════ -->
  {#if isAsmmat}
    <FadeIn delay={140} class="bento-codes h-full">
      <Card padding="md" class="flex flex-col">
        <div class="flex items-center justify-between mb-3 shrink-0">
          <h3 class="font-display font-bold text-base text-warm-900">Codes d'invitation</h3>
          <form method="POST" action="?/generateCode"
            use:enhance={() => { isGenerating = true; return async ({ update }) => { isGenerating = false; update(); }; }}>
            <Button type="submit" variant="primary" size="sm" disabled={isGenerating}>
              {isGenerating ? 'Generation...' : 'Generer'}
            </Button>
          </form>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto codes-scroll">
          {#if data.inviteCodes.length > 0}
            <div class="space-y-2">
              {#each data.inviteCodes as invite (invite.id)}
                <div
                  class="flex items-center justify-between p-2 rounded-lg transition-colors duration-700
                    {highlightedCode === invite.code ? 'bg-mousse-400/20 ring-1 ring-mousse-400/30' : 'glass-2'}"
                  in:fly={{ y: -10, duration: 250 }}
                >
                  <div>
                    <span class="font-mono font-bold tracking-wider text-xs transition-colors duration-700
                      {highlightedCode === invite.code ? 'text-mousse-600' : 'text-warm-900'}">{invite.code}</span>
                    <p class="text-[9px] text-warm-500 mt-0.5">Expire le {formatDate(invite.expiresAt)}</p>
                  </div>
                  <div class="flex items-center gap-0.5">
                    <button type="button" onclick={() => copyCode(invite.code)}
                      class="p-1 text-warm-500 hover:text-warm-700 transition-colors outline-none cursor-pointer" title="Copier">
                      {#if copiedCode === invite.code}<Check size={12} />{:else}<Copy size={12} />{/if}
                    </button>
                    <form method="POST" action="?/deleteCode" use:enhance>
                      <input type="hidden" name="codeId" value={invite.id} />
                      <button type="submit" class="p-1 text-warm-500 hover:text-argile-400 transition-colors outline-none cursor-pointer" title="Supprimer">
                        <Trash2 size={12} />
                      </button>
                    </form>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-xs text-warm-400 text-center py-3">
              Aucun code actif
            </p>
          {/if}
        </div>
      </Card>
    </FadeIn>
  {/if}

  <!-- ══════ PRESENCE ══════ -->
  <FadeIn delay={160} class="bento-presence h-full">
    <Card padding="md" class="h-full">
          <h3 class="font-display font-bold text-base text-warm-900 mb-3">Presence</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-warm-600">Absences a venir (7j)</span>
              <span class="text-xs font-bold text-warm-900">{data.insights.absencesNext7Days}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-warm-600">Absences a venir (30j)</span>
              <span class="text-xs font-bold text-warm-900">{data.insights.absencesNext30Days}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-warm-600">Jours d'absence (30j)</span>
              <span class="text-xs font-bold text-warm-900">{data.insights.absenceDaysLast30}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-warm-600">Retards (30j)</span>
              <span class="text-xs font-bold text-warm-900">{data.insights.retardsLast30Days}</span>
            </div>
          </div>
    </Card>
  </FadeIn>

</div>
{/key}
