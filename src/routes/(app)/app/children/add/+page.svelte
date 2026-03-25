<script lang="ts">
  import type { ActionData } from './$types';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { fly } from 'svelte/transition';
  import { Card, Button, Input } from '$lib/ui';
  import { DURATION } from '$lib/ui/motion';
  import { Baby, Clock, ChevronLeft } from 'lucide-svelte';
  import type { CareWeekday, CareDay } from '$lib/types';

  interface Props { form: ActionData; }
  let { form }: Props = $props();

  // ── Step management ────────────────────────────────────────────────
  let step = $state(1);
  let direction = $state<'forward' | 'backward'>('forward');

  const getDuration = () => {
    if (!browser) return 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return DURATION.page;
  };

  // Dynamic height — measure active step content
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

  // ── Step 1: Identity ───────────────────────────────────────────────
  let firstName = $state('');
  let lastName = $state('');
  let birthDate = $state('');
  let isSubmitting = $state(false);

  $effect(() => {
    if (form?.firstName) firstName = form.firstName as string;
    if (form?.lastName) lastName = form.lastName as string;
    if (form?.birthDate) birthDate = form.birthDate as string;
  });

  const now = new Date();
  const maxDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const step1Valid = $derived(
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    birthDate.length > 0
  );

  function goToSchedule() {
    if (!step1Valid) return;
    direction = 'forward';
    step = 2;
  }

  function goBack() {
    direction = 'backward';
    step = 1;
  }

  // ── Step 2: Care schedule ──────────────────────────────────────────
  const WEEKDAYS: { key: CareWeekday; label: string; short: string }[] = [
    { key: 'lundi', label: 'Lundi', short: 'L' },
    { key: 'mardi', label: 'Mardi', short: 'M' },
    { key: 'mercredi', label: 'Mercredi', short: 'M' },
    { key: 'jeudi', label: 'Jeudi', short: 'J' },
    { key: 'vendredi', label: 'Vendredi', short: 'V' },
    { key: 'samedi', label: 'Samedi', short: 'S' },
    { key: 'dimanche', label: 'Dimanche', short: 'D' },
  ];

  const WEEKDAY_LABELS: Record<CareWeekday, string> = {
    lundi: 'Lun', mardi: 'Mar', mercredi: 'Mer', jeudi: 'Jeu',
    vendredi: 'Ven', samedi: 'Sam', dimanche: 'Dim',
  };

  let activeDays = $state<Record<CareWeekday, boolean>>({
    lundi: false, mardi: false, mercredi: false, jeudi: false,
    vendredi: false, samedi: false, dimanche: false,
  });

  let dayTimes = $state<Record<CareWeekday, CareDay>>({
    lundi: { start: '08:00', end: '17:30' },
    mardi: { start: '08:00', end: '17:30' },
    mercredi: { start: '08:00', end: '17:30' },
    jeudi: { start: '08:00', end: '17:30' },
    vendredi: { start: '08:00', end: '17:30' },
    samedi: { start: '08:00', end: '17:30' },
    dimanche: { start: '08:00', end: '17:30' },
  });

  let scheduleError = $state('');
  const activeDayCount = $derived(WEEKDAYS.filter(d => activeDays[d.key]).length);

  const careScheduleJson = $derived.by(() => {
    const schedule: Record<string, CareDay> = {};
    for (const day of WEEKDAYS) {
      if (activeDays[day.key]) {
        schedule[day.key] = dayTimes[day.key];
      }
    }
    return JSON.stringify(schedule);
  });

  function toggleDay(key: CareWeekday) {
    activeDays[key] = !activeDays[key];
    scheduleError = '';
    // Re-measure after toggle changes DOM
    if (browser) requestAnimationFrame(measureStep);
  }

  function applyToAll(sourceKey: CareWeekday) {
    const source = dayTimes[sourceKey];
    for (const day of WEEKDAYS) {
      if (activeDays[day.key] && day.key !== sourceKey) {
        dayTimes[day.key] = { ...source };
      }
    }
  }

  function validateSchedule(): boolean {
    for (const day of WEEKDAYS) {
      if (activeDays[day.key]) {
        const { start, end } = dayTimes[day.key];
        if (end <= start) {
          scheduleError = `${day.label} : l'heure de fin doit etre apres l'heure de debut`;
          return false;
        }
      }
    }
    scheduleError = '';
    return true;
  }

  // Computed initials for avatar preview
  const initials = $derived.by(() => {
    const f = firstName.trim();
    const l = lastName.trim();
    if (!f) return '';
    return (f[0] + (l?.[0] ?? '')).toUpperCase();
  });
</script>

<div class="min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4 sm:p-8">
  <div class="w-full max-w-md">

    <!-- Progress indicator -->
    <div class="flex items-center justify-center gap-2 mb-6">
      {#each [1, 2] as s}
        <div class="step-dot {step >= s ? 'step-dot-active' : 'step-dot-inactive'}">
          {s}
        </div>
        {#if s < 2}
          <div class="w-10 h-1 rounded-full transition-colors duration-300 {step > s ? 'bg-miel-500' : 'bg-warm-200/60'}"></div>
        {/if}
      {/each}
    </div>

    <Card padding="lg">
      <form
        method="POST"
        use:enhance={({ cancel }) => {
          if (!validateSchedule()) { cancel(); return; }
          isSubmitting = true;
          return async ({ update }) => {
            isSubmitting = false;
            update();
          };
        }}
      >
        <!-- Hidden fields -->
        <input type="hidden" name="firstName" value={firstName} />
        <input type="hidden" name="lastName" value={lastName} />
        <input type="hidden" name="birthDate" value={birthDate} />
        <input type="hidden" name="careSchedule" value={careScheduleJson} />

        <div
          class="relative overflow-hidden transition-[height] duration-500"
          style="height: {containerHeight ? containerHeight + 'px' : 'auto'}; --ease-silk: cubic-bezier(0.22, 1, 0.36, 1);"
          style:transition-timing-function="var(--ease-silk)"
        >

          <!-- ═══ STEP 1 — Identity ═══ -->
          {#if step === 1}
            <div
              bind:this={stepEls[1]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'backward' ? -20 : 0, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: -20, duration: getDuration(), opacity: 0 }}
            >
              <!-- Avatar preview -->
              <div class="flex justify-center mb-5">
                <div class="avatar-preview {initials ? 'avatar-preview-active' : ''}">
                  {#if initials}
                    <span class="text-xl font-display font-bold text-miel-700">{initials}</span>
                  {:else}
                    <Baby size={28} class="text-warm-400" />
                  {/if}
                </div>
              </div>

              <h1 class="text-xl font-display font-bold text-warm-900 text-center mb-1">
                Nouvel enfant
              </h1>
              <p class="text-sm text-warm-600 text-center mb-6">
                Renseignez les informations de l'enfant
              </p>

              {#if form?.error}
                <div
                  class="mb-4 p-3 bg-argile-400/10 border border-argile-400/20 rounded-xl text-argile-500 text-sm"
                  in:fly={{ y: -10, duration: 200 }}
                >
                  {form.error}
                </div>
              {/if}

              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                  <Input
                    label="Prenom"
                    name="_firstName"
                    placeholder="Emma"
                    bind:value={firstName}
                    required
                    disabled={isSubmitting}
                  />
                  <Input
                    label="Nom"
                    name="_lastName"
                    placeholder="Dupont"
                    bind:value={lastName}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <Input
                  type="date"
                  label="Date de naissance"
                  name="_birthDate"
                  bind:value={birthDate}
                  max={maxDate}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div class="flex gap-3 mt-8">
                <button
                  type="button"
                  onclick={goToSchedule}
                  disabled={!step1Valid}
                  class="step-next-btn {step1Valid ? 'step-next-btn-active' : 'step-next-btn-disabled'}"
                >
                  Continuer
                </button>
              </div>

              <div class="mt-4 text-center">
                <a href="/app/children" class="text-xs text-warm-500 hover:text-warm-700 transition-colors">
                  Annuler
                </a>
              </div>
            </div>

          <!-- ═══ STEP 2 — Schedule ═══ -->
          {:else if step === 2}
            <div
              bind:this={stepEls[2]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'forward' ? 20 : -20, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: direction === 'forward' ? -20 : 20, duration: getDuration(), opacity: 0 }}
            >
              <div class="mb-4">
                <button
                  type="button"
                  onclick={goBack}
                  class="text-sm text-warm-500 hover:text-warm-700 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  Retour
                </button>
              </div>

              <div class="flex items-center gap-2 justify-center mb-1">
                <Clock size={18} class="text-miel-500" />
                <h1 class="text-xl font-display font-bold text-warm-900">
                  Horaires de garde
                </h1>
              </div>
              <p class="text-sm text-warm-600 text-center mb-6">
                Quels jours accueillez-vous <strong class="text-warm-800">{firstName}</strong> ?
              </p>

              <!-- Day toggles — large, tactile -->
              <div class="grid grid-cols-7 gap-1.5 mb-5">
                {#each WEEKDAYS as day, i}
                  <button
                    type="button"
                    onclick={() => toggleDay(day.key)}
                    disabled={isSubmitting}
                    class="day-pill {activeDays[day.key] ? 'day-pill-active' : 'day-pill-inactive'}"
                    style="--delay: {i * 30}ms"
                  >
                    <span class="text-[10px] sm:hidden">{day.short}</span>
                    <span class="text-[10px] hidden sm:inline">{WEEKDAY_LABELS[day.key]}</span>
                  </button>
                {/each}
              </div>

              <!-- Time slots -->
              {#if activeDayCount > 0}
                <div class="space-y-2">
                  {#each WEEKDAYS as day, i}
                    {#if activeDays[day.key]}
                      <div class="time-row" style="--stagger: {i * 40}ms">
                        <span class="time-row-label">{WEEKDAY_LABELS[day.key]}</span>
                        <div class="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            bind:value={dayTimes[day.key].start}
                            class="time-input"
                            disabled={isSubmitting}
                          />
                          <span class="text-warm-400 text-xs font-medium">a</span>
                          <input
                            type="time"
                            bind:value={dayTimes[day.key].end}
                            class="time-input"
                            disabled={isSubmitting}
                          />
                        </div>
                        {#if i === WEEKDAYS.findIndex(d => activeDays[d.key]) && activeDayCount > 1}
                          <button
                            type="button"
                            onclick={() => applyToAll(day.key)}
                            class="apply-all-btn"
                            title="Appliquer a tous les jours"
                          >
                            Tous
                          </button>
                        {/if}
                      </div>
                    {/if}
                  {/each}
                </div>
              {:else}
                <div class="text-center py-6">
                  <p class="text-sm text-warm-500">Selectionnez les jours de garde ci-dessus</p>
                  <p class="text-xs text-warm-400 mt-1">Vous pourrez les modifier plus tard</p>
                </div>
              {/if}

              {#if scheduleError}
                <div class="mt-3 p-2.5 bg-argile-400/10 border border-argile-400/20 rounded-xl text-argile-500 text-xs" in:fly={{ y: -6, duration: 150 }}>
                  {scheduleError}
                </div>
              {/if}

              <div class="flex gap-3 mt-8">
                <Button type="submit" variant="primary" disabled={isSubmitting} class="flex-1">
                  {isSubmitting ? 'Creation...' : 'Ajouter l\'enfant'}
                </Button>
              </div>

              <p class="text-[10px] text-warm-400 text-center mt-3">
                Les horaires sont optionnels — vous pourrez les definir plus tard
              </p>
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
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8125rem;
    font-weight: 600;
    transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .step-dot-active {
    background: var(--color-miel-500);
    color: white;
    box-shadow: 0 4px 12px rgba(232, 145, 58, 0.25);
  }
  .step-dot-inactive {
    background: rgba(184, 158, 134, 0.15);
    color: var(--color-warm-500);
    box-shadow: inset 0 0 0 2px rgba(184, 158, 134, 0.3);
  }

  /* ── Avatar preview ── */
  .avatar-preview {
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 248, 238, 0.6);
    border: 2px dashed rgba(184, 158, 134, 0.3);
    transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .avatar-preview-active {
    background: rgba(232, 145, 58, 0.08);
    border: 2px solid rgba(232, 145, 58, 0.3);
    box-shadow: 0 8px 24px rgba(232, 145, 58, 0.1);
  }

  /* ── Continue button ── */
  .step-next-btn {
    flex: 1;
    padding: 0.75rem 1.5rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    outline: none;
  }
  .step-next-btn:focus-visible {
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3);
  }
  .step-next-btn-active {
    background: var(--color-miel-500);
    color: white;
    box-shadow: 0 4px 16px rgba(232, 145, 58, 0.25);
  }
  .step-next-btn-active:hover {
    background: var(--color-miel-600);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.3);
  }
  .step-next-btn-active:active {
    transform: translateY(0) scale(0.98);
  }
  .step-next-btn-disabled {
    background: rgba(184, 158, 134, 0.15);
    color: var(--color-warm-400);
    cursor: not-allowed;
  }

  /* ── Day pills ── */
  .day-pill {
    padding: 0.625rem 0;
    border-radius: 0.75rem;
    font-weight: 700;
    border: 1.5px solid transparent;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    outline: none;
    text-align: center;
    animation: pill-appear 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }
  .day-pill:focus-visible {
    box-shadow: 0 0 0 2px rgba(232, 145, 58, 0.4);
  }
  .day-pill-active {
    background: var(--color-miel-500);
    color: white;
    border-color: var(--color-miel-500);
    box-shadow: 0 3px 10px rgba(232, 145, 58, 0.2);
  }
  .day-pill-active:hover {
    background: var(--color-miel-600);
    transform: translateY(-1px);
  }
  .day-pill-inactive {
    background: rgba(255, 255, 255, 0.35);
    color: var(--color-warm-500);
    border-color: rgba(184, 158, 134, 0.2);
  }
  .day-pill-inactive:hover {
    background: rgba(255, 248, 240, 0.7);
    color: var(--color-warm-700);
    border-color: rgba(232, 145, 58, 0.2);
    transform: translateY(-1px);
  }
  @keyframes pill-appear {
    from { opacity: 0; transform: scale(0.85) translateY(4px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  /* ── Time rows ── */
  .time-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    background: rgba(255, 248, 238, 0.5);
    border: 1px solid rgba(255, 240, 220, 0.4);
    border-radius: 0.875rem;
    animation: row-slide 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--stagger, 0ms);
  }
  @keyframes row-slide {
    from { opacity: 0; transform: translateX(10px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .time-row-label {
    font-size: 0.6875rem;
    font-weight: 800;
    color: var(--color-miel-600);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: 1.75rem;
    flex-shrink: 0;
  }
  .time-input {
    display: block;
    width: 100%;
    max-width: 6.5rem;
    border-radius: 0.5rem;
    padding: 0.375rem 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-warm-900);
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .time-input:focus {
    border-color: rgba(232, 145, 58, 0.5);
    box-shadow: 0 0 0 2px rgba(232, 145, 58, 0.12);
  }
  .apply-all-btn {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--color-miel-500);
    background: rgba(232, 145, 58, 0.08);
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .apply-all-btn:hover {
    background: rgba(232, 145, 58, 0.15);
    color: var(--color-miel-700);
  }

  @media (prefers-reduced-motion: reduce) {
    .day-pill, .time-row { animation: none !important; }
    .step-dot, .avatar-preview, .step-next-btn, .day-pill { transition: none !important; }
  }
</style>
