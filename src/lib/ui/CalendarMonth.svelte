<script lang="ts">
  import type { CalendarEvent } from '$lib/types';
  import { CalendarOff, Clock } from 'lucide-svelte';

  interface Props {
    year: number;
    month: number;
    events: CalendarEvent[];
    onEventClick?: (event: CalendarEvent) => void;
    onNavigate?: (year: number, month: number) => void;
    onDaySelect?: (dateKey: string) => void;
    onDayHover?: (dateKey: string | null) => void;
  }

  let { year, month, events, onEventClick, onNavigate, onDaySelect, onDayHover }: Props = $props();

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const dayNamesShort = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const monthNamesShort = [
    'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
    'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
  ];

  let innerWidth = $state(1024);
  const isMobile = $derived(innerWidth < 640);

  // Mobile: selected day to show events
  let selectedDayKey = $state<string | null>(null);

  function formatDateKey(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function parseDateString(dateStr: string): { year: number; month: number; day: number } {
    const [y, m, d] = dateStr.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
  }

  const calendarDays = $derived(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const days: { dateKey: string; day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    const today = new Date();
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const dateKey = formatDateKey(prevYear, prevMonth, day);
      days.push({ dateKey, day, isCurrentMonth: false, isToday: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = formatDateKey(year, month, day);
      days.push({ dateKey, day, isCurrentMonth: true, isToday: dateKey === todayKey });
    }

    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const dateKey = formatDateKey(nextYear, nextMonth, day);
      days.push({ dateKey, day, isCurrentMonth: false, isToday: false });
    }

    return days;
  });

  const eventsByDate = $derived(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      const start = parseDateString(event.startDate);
      const end = parseDateString(event.endDate);

      let currentYear = start.year;
      let currentMonth = start.month;
      let currentDay = start.day;

      while (true) {
        const dateKey = formatDateKey(currentYear, currentMonth, currentDay);
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(event);

        if (currentYear === end.year && currentMonth === end.month && currentDay === end.day) {
          break;
        }

        currentDay++;
        const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        if (currentDay > daysInCurrentMonth) {
          currentDay = 1;
          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
        }
      }
    }

    return map;
  });

  function getEventsForDay(dateKey: string): CalendarEvent[] {
    return eventsByDate().get(dateKey) ?? [];
  }

  // All events for the current month, sorted by date
  const monthEvents = $derived.by(() => {
    const all: { event: CalendarEvent; dateKey: string }[] = [];
    const map = eventsByDate();
    for (const [dateKey, evts] of map) {
      const parsed = parseDateString(dateKey);
      if (parsed.month === month && parsed.year === year) {
        for (const event of evts) {
          if (!all.some(e => e.event === event)) {
            all.push({ event, dateKey });
          }
        }
      }
    }
    return all.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  });

  // Events for selected day on mobile
  const selectedDayEvents = $derived(
    selectedDayKey ? getEventsForDay(selectedDayKey) : []
  );

  function goToPreviousMonth() {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    selectedDayKey = null;
    onNavigate?.(newYear, newMonth);
  }

  function goToNextMonth() {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) { newMonth = 0; newYear++; }
    selectedDayKey = null;
    onNavigate?.(newYear, newMonth);
  }

  function goToToday() {
    const now = new Date();
    selectedDayKey = null;
    onNavigate?.(now.getFullYear(), now.getMonth());
  }

  function handleDayClick(dayInfo: { dateKey: string; isCurrentMonth: boolean }) {
    if (!dayInfo.isCurrentMonth) return;

    // Track selected day visually
    selectedDayKey = selectedDayKey === dayInfo.dateKey ? null : dayInfo.dateKey;

    // Notify parent of day selection
    onDaySelect?.(dayInfo.dateKey);
  }

  function getEventStyle(kind: string): string {
    if (kind === 'absence') {
      return 'bg-sienne-200/50 text-sienne-600 border-sienne-300/30';
    }
    return 'bg-miel-100 text-miel-700 border-miel-200/30';
  }

  function getEventDotColor(kind: string): string {
    return kind === 'absence' ? 'bg-sienne-400' : 'bg-miel-500';
  }

  function getEventIcon(kind: string) {
    return kind === 'absence' ? CalendarOff : Clock;
  }

  function formatDayLabel(dateKey: string): string {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
</script>

<svelte:window bind:innerWidth />

<div class="glass-1 rounded-3xl overflow-hidden calendar-root">
  <!-- Header -->
  <div class="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-warm-100/15">
    <button
      type="button"
      onclick={goToPreviousMonth}
      class="p-1.5 sm:p-2 hover:bg-warm-100/30 rounded-lg transition-colors cursor-pointer"
      aria-label="Mois précédent"
    >
      <svg class="w-4 h-4 sm:w-5 sm:h-5 text-warm-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <button
      type="button"
      onclick={goToToday}
      class="flex items-center gap-1.5 sm:gap-2 hover:bg-warm-100/20 px-2.5 py-1 rounded-xl transition-colors cursor-pointer"
    >
      <h2 class="text-sm sm:text-lg font-display font-semibold text-warm-900">
        {isMobile ? monthNamesShort[month] : monthNames[month]} {year}
      </h2>
      <span class="text-[9px] sm:text-xs text-miel-500 font-medium">Auj.</span>
    </button>

    <button
      type="button"
      onclick={goToNextMonth}
      class="p-1.5 sm:p-2 hover:bg-warm-100/30 rounded-lg transition-colors cursor-pointer"
      aria-label="Mois suivant"
    >
      <svg class="w-4 h-4 sm:w-5 sm:h-5 text-warm-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>

  <!-- Day grid -->
  <div class="px-1.5 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-2">
    <!-- Day names -->
    <div class="grid grid-cols-7">
      {#each dayNames as dayName, i}
        <div class="text-center text-[10px] sm:text-xs font-semibold text-warm-400 uppercase tracking-wide py-1 sm:py-2">
          {isMobile ? dayNamesShort[i] : dayName}
        </div>
      {/each}
    </div>

    <!-- Calendar cells -->
    <div class="grid grid-cols-7 gap-px sm:gap-1">
      {#each calendarDays() as dayInfo}
        {@const dayEvents = getEventsForDay(dayInfo.dateKey)}
        {@const hasEvents = dayInfo.isCurrentMonth && dayEvents.length > 0}
        {@const isSelected = selectedDayKey === dayInfo.dateKey}

        <!-- Mobile cell -->
        <button
          type="button"
          class="cal-cell-mobile sm:hidden flex flex-col items-center py-1 rounded-lg transition-[color,background-color,transform] duration-150
            {dayInfo.isCurrentMonth ? 'cursor-pointer' : 'opacity-30 cursor-default'}
            {dayInfo.isToday && !isSelected ? 'bg-miel-400/12' : ''}
            {isSelected ? 'cal-cell-selected bg-miel-400/15 scale-105' : ''}"
          onclick={() => handleDayClick(dayInfo)}
          disabled={!dayInfo.isCurrentMonth}
        >
          <span
            class="cal-day-number inline-flex items-center justify-center w-7 h-7 text-[11px] font-medium rounded-full transition-colors
              {dayInfo.isToday || isSelected ? 'bg-miel-500 text-white font-bold' : ''}
              {!dayInfo.isToday && !isSelected && dayInfo.isCurrentMonth ? 'text-warm-800' : ''}
              {!dayInfo.isCurrentMonth ? 'text-warm-400' : ''}"
          >
            {dayInfo.day}
          </span>
          {#if hasEvents}
            <div class="flex gap-0.5 mt-0.5 h-1.5 items-center">
              {#each dayEvents.slice(0, 3) as event}
                <span class="w-[5px] h-[5px] rounded-full {getEventDotColor(event.kind)}"></span>
              {/each}
            </div>
          {:else}
            <div class="h-1.5 mt-0.5"></div>
          {/if}
        </button>

        <!-- Desktop cell -->
        <button
          type="button"
          class="cal-cell-desktop hidden sm:block p-1 rounded-xl border text-left w-full
            {dayInfo.isCurrentMonth ? 'glass-2 border-warm-100/15 cursor-pointer' : 'bg-warm-50/10 border-transparent cursor-default'}
            {dayInfo.isToday ? 'ring-2 ring-miel-400 ring-offset-1' : ''}
            {isSelected && !dayInfo.isToday ? 'cal-cell-selected ring-2 ring-miel-400/60 ring-offset-1' : ''}"
          onclick={() => handleDayClick(dayInfo)}
          onmouseenter={() => dayInfo.isCurrentMonth && onDayHover?.(dayInfo.dateKey)}
          onmouseleave={() => onDayHover?.(null)}
          disabled={!dayInfo.isCurrentMonth}
        >
          <div class="text-right mb-1">
            <span
              class="cal-day-number inline-flex items-center justify-center w-6 h-6 text-xs rounded-full transition-colors
                {dayInfo.isToday || isSelected ? 'bg-miel-500 text-white font-semibold' : ''}
                {!dayInfo.isToday && !isSelected && dayInfo.isCurrentMonth ? 'text-warm-700' : ''}
                {!dayInfo.isCurrentMonth ? 'text-warm-400' : ''}"
            >
              {dayInfo.day}
            </span>
          </div>

          {#if hasEvents}
            <div class="space-y-0.5">
              {#each dayEvents.slice(0, 2) as event}
                {@const Icon = getEventIcon(event.kind)}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="w-full text-left px-1.5 py-0.5 rounded text-xs truncate border cursor-pointer hover:opacity-80 transition-opacity {getEventStyle(event.kind)}"
                  title="{event.childName} - {event.content}"
                  onclick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
                >
                  <Icon size={11} class="inline-block mr-0.5 -mt-px" />
                  <span class="font-medium">{event.childName.split(' ')[0]}</span>
                </div>
              {/each}
              {#if dayEvents.length > 2}
                <div class="text-xs text-warm-500 px-1.5">
                  +{dayEvents.length - 2} autre{dayEvents.length - 2 > 1 ? 's' : ''}
                </div>
              {/if}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- Mobile: selected day events panel -->
  {#if isMobile && selectedDayKey && selectedDayEvents.length > 0}
    <div class="border-t border-warm-100/15 px-3 py-2 space-y-1.5 animate-slide-down">
      <p class="text-[10px] font-bold text-warm-500 uppercase tracking-wider">{formatDayLabel(selectedDayKey)}</p>
      {#each selectedDayEvents as event}
        <button
          type="button"
          onclick={() => onEventClick?.(event)}
          class="w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-colors
            {event.kind === 'absence' ? 'bg-sienne-400/10 hover:bg-sienne-400/15' : 'bg-miel-400/10 hover:bg-miel-400/15'}"
        >
          <span class="w-2 h-2 rounded-full shrink-0 {getEventDotColor(event.kind)}"></span>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold {event.kind === 'absence' ? 'text-sienne-600' : 'text-miel-700'} truncate">
              {event.childName}
            </p>
            <p class="text-[10px] text-warm-500 truncate">{event.content}</p>
          </div>
        </button>
      {/each}
    </div>
  {:else if isMobile && monthEvents.length > 0 && !selectedDayKey}
    <div class="border-t border-warm-100/15 px-3 py-2 space-y-1 max-h-28 overflow-y-auto">
      <p class="text-[10px] font-bold text-warm-500 uppercase tracking-wider">Ce mois</p>
      {#each monthEvents.slice(0, 4) as { event, dateKey }}
        <button
          type="button"
          onclick={() => onEventClick?.(event)}
          class="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-warm-100/20 transition-colors"
        >
          <span class="w-1.5 h-1.5 rounded-full shrink-0 {getEventDotColor(event.kind)}"></span>
          <span class="text-[10px] font-medium text-warm-600 shrink-0">{dateKey.slice(8)}/{dateKey.slice(5,7)}</span>
          <span class="text-[10px] text-warm-800 font-semibold truncate">{event.childName.split(' ')[0]}</span>
          <span class="text-[10px] text-warm-500 truncate ml-auto">{event.kind === 'absence' ? 'Absence' : 'Retard'}</span>
        </button>
      {/each}
      {#if monthEvents.length > 4}
        <p class="text-[10px] text-warm-400 text-center py-0.5">+{monthEvents.length - 4} autre{monthEvents.length - 4 > 1 ? 's' : ''}</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Calendar stretches to fill its container on desktop */
  @media (min-width: 640px) {
    .calendar-root {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .calendar-root > div:last-of-type {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .calendar-root > div:last-of-type > .grid:last-child {
      flex: 1;
      grid-auto-rows: 1fr;
    }
  }

  /* Mobile: hover/active — only on unselected cells */
  .cal-cell-mobile:not(:disabled):not(.cal-cell-selected):hover .cal-day-number {
    background: rgba(232, 145, 58, 0.15);
    color: var(--color-miel-700);
  }
  .cal-cell-mobile:not(:disabled):active {
    transform: scale(0.95);
  }

  /* Desktop: transitions */
  .cal-cell-desktop:not(:disabled) {
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  /* Desktop: hover — only on unselected cells (selected keeps solid miel) */
  .cal-cell-desktop:not(:disabled):not(.cal-cell-selected):hover {
    border-color: rgba(232, 145, 58, 0.25);
    background: rgba(255, 248, 238, 0.6);
  }
  .cal-cell-desktop:not(:disabled):not(.cal-cell-selected):hover .cal-day-number {
    background: rgba(232, 145, 58, 0.15);
    color: var(--color-miel-700);
    font-weight: 600;
  }

  /* Selected cell: warm glow to reinforce the active state */
  .cal-cell-desktop.cal-cell-selected {
    background: rgba(232, 145, 58, 0.08);
    border-color: rgba(232, 145, 58, 0.2);
  }

  @keyframes slide-down {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .animate-slide-down {
    animation: slide-down 0.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-slide-down { animation: none !important; }
  }
</style>
