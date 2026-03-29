<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { FadeIn, Card, Badge, Avatar, Button, PageHeader, Select } from '$lib/ui';
  import {
    UserCheck, Clock, LogIn, LogOut, X, ChevronLeft, ChevronRight,
    Pencil, Ban, CircleCheck, CircleMinus, CalendarClock, ScanLine, FileText, AlertTriangle
  } from 'lucide-svelte';

  interface Props { data: PageData; form: ActionData; }
  let { data, form }: Props = $props();

  // ── Modal state ───────────────────────────────────────────────────────────

  let checkinChildId = $state<string | null>(null);
  let checkoutChildId = $state<string | null>(null);
  let absentChildId = $state<string | null>(null);
  let editChildId = $state<string | null>(null);

  // Form fields
  let selectedPersonType = $state<string>('parent');
  let selectedPersonId = $state<string>('');
  let timeOverride = $state<string>('');
  let absentStatus = $state<'absent_planned' | 'absent_unplanned'>('absent_planned');
  let absentNotes = $state<string>('');
  let editArrivalTime = $state<string>('');
  let editDepartureTime = $state<string>('');
  let editNotes = $state<string>('');
  let isSubmitting = $state(false);

  // Late alert — check current hour
  let currentHour = $state(new Date().getHours());
  $effect(() => {
    if (browser) {
      currentHour = new Date().getHours();
      const iv = setInterval(() => { currentHour = new Date().getHours(); }, 60_000);
      return () => clearInterval(iv);
    }
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const presentCount = $derived(
    data.attendances.filter(a => a.id && a.arrivalTime && !a.departureTime && a.status === 'present').length
  );
  const departedCount = $derived(
    data.attendances.filter(a => a.id && a.arrivalTime && a.departureTime && a.status === 'present').length
  );
  const absentCount = $derived(
    data.attendances.filter(a => a.id && (a.status === 'absent_planned' || a.status === 'absent_unplanned')).length
  );
  const totalChildren = $derived(data.attendances.length);
  const progressPercent = $derived(totalChildren > 0 ? Math.round((presentCount / totalChildren) * 100) : 0);

  // Person options for check-in/out modals
  function getPersonOptions(childId: string) {
    const child = data.attendances.find(a => a.childId === childId);
    if (!child) return [];

    const options: Array<{ value: string; label: string; type: string }> = [];

    // Parents
    for (const pid of child.parentIds) {
      const name = data.parentsMap[pid];
      if (name) options.push({ value: pid, label: `${name} (parent)`, type: 'parent' });
    }

    // Authorized persons
    const authorized = data.authorizedPersonsMap[childId] ?? [];
    for (const ap of authorized) {
      options.push({ value: ap.id, label: `${ap.name} (${ap.relationship})`, type: 'authorized_person' });
    }

    return options;
  }

  function openCheckin(childId: string) {
    checkinChildId = childId;
    const options = getPersonOptions(childId);
    if (options.length > 0) {
      selectedPersonType = options[0].type;
      selectedPersonId = options[0].value;
    }
    timeOverride = '';
  }

  function openCheckout(childId: string) {
    checkoutChildId = childId;
    const options = getPersonOptions(childId);
    if (options.length > 0) {
      selectedPersonType = options[0].type;
      selectedPersonId = options[0].value;
    }
    timeOverride = '';
  }

  function openAbsent(childId: string) {
    absentChildId = childId;
    absentStatus = 'absent_planned';
    absentNotes = '';
  }

  function openEdit(childId: string) {
    editChildId = childId;
    const att = data.attendances.find(a => a.childId === childId);
    editArrivalTime = att?.arrivalTime ? formatTime(att.arrivalTime) : '';
    editDepartureTime = att?.departureTime ? formatTime(att.departureTime) : '';
    editNotes = att?.notes ?? '';
  }

  function closeModals() {
    checkinChildId = null;
    checkoutChildId = null;
    absentChildId = null;
    editChildId = null;
    isSubmitting = false;
  }

  // Close modal on successful action
  $effect(() => {
    if (form?.success) closeModals();
  });

  function handlePersonSelect(value: string) {
    const allOptions = checkinChildId
      ? getPersonOptions(checkinChildId)
      : checkoutChildId
        ? getPersonOptions(checkoutChildId)
        : [];
    const option = allOptions.find(o => o.value === value);
    if (option) {
      selectedPersonType = option.type;
      selectedPersonId = option.value;
    }
  }

  // ── Date navigation ───────────────────────────────────────────────────────

  function navigateDate(offset: number) {
    const d = new Date(data.date + 'T12:00:00');
    d.setDate(d.getDate() + offset);
    const newDate = d.toISOString().split('T')[0];
    goto(`/app/attendance?date=${newDate}`);
  }

  // ── Format helpers ────────────────────────────────────────────────────────

  function formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  }

  function formatDateDisplay(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris'
    });
  }

  function computeDuration(arrival: string, departure: string): string {
    const a = new Date(arrival);
    const dep = new Date(departure);
    const diffMs = dep.getTime() - a.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  }

  function computeExpectedDuration(start: string | null, end: string | null): string | null {
    if (!start || !end) return null;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin <= 0) return null;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  }

  function computeDeltaMinutes(arrival: string, departure: string, expectedStart: string | null, expectedEnd: string | null): number | null {
    if (!expectedStart || !expectedEnd) return null;
    const actualMs = new Date(departure).getTime() - new Date(arrival).getTime();
    const [sh, sm] = expectedStart.split(':').map(Number);
    const [eh, em] = expectedEnd.split(':').map(Number);
    const expectedMs = ((eh * 60 + em) - (sh * 60 + sm)) * 60000;
    return Math.round((actualMs - expectedMs) / 60000);
  }

  function formatDelta(minutes: number): string {
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const sign = minutes >= 0 ? '+' : '-';
    return h > 0 ? `${sign}${h}h${m.toString().padStart(2, '0')}` : `${sign}${m}min`;
  }

  function deltaColorClass(minutes: number): string {
    if (Math.abs(minutes) <= 15) return 'text-mousse-500';
    return minutes > 0 ? 'text-sienne-500' : 'text-bleu-500';
  }

  type ChildStatus = 'expected' | 'not_expected' | 'present' | 'departed' | 'absent_planned' | 'absent_unplanned';

  function getChildStatus(att: typeof data.attendances[0]): ChildStatus {
    if (att.id && (att.status === 'absent_planned' || att.status === 'absent_unplanned')) {
      return att.status;
    }
    if (att.id && att.arrivalTime && att.departureTime) return 'departed';
    if (att.id && att.arrivalTime) return 'present';
    if (att.expectedStart) return 'expected';
    return 'not_expected';
  }

  const statusConfig: Record<ChildStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; icon: typeof Clock }> = {
    expected: { label: 'Attendu', variant: 'default', icon: CalendarClock },
    not_expected: { label: 'Pas prévu', variant: 'default', icon: CircleMinus },
    present: { label: 'Présent', variant: 'success', icon: CircleCheck },
    departed: { label: 'Parti', variant: 'info', icon: LogOut },
    absent_planned: { label: 'Absent (prévu)', variant: 'warning', icon: Ban },
    absent_unplanned: { label: 'Absent (imprévu)', variant: 'danger', icon: Ban },
  };
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') closeModals(); }} />

<svelte:head>
  <title>Présences — Le Cocon</title>
</svelte:head>

<div class="max-w-4xl mx-auto">

  <!-- Header with date navigation -->
  <PageHeader title="Présences" description={formatDateDisplay(data.date)}>
    {#snippet actions()}
      <div class="flex items-center gap-2">
        {#if data.role === 'assistante'}
          <a
            href="/app/attendance/report"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold
              text-warm-600 hover:bg-warm-100/50 transition-colors
              outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
          >
            <FileText size={15} />
            <span class="hidden sm:inline">Rapport</span>
          </a>
          {#if data.isToday}
            <a
              href="/app/scan"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold
                bg-miel-500 text-white hover:bg-miel-600 transition-colors shadow-sm shadow-miel-500/20
                outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
            >
              <ScanLine size={15} />
              <span class="hidden sm:inline">Scanner QR</span>
            </a>
          {/if}
        {/if}
        <button
          type="button"
          onclick={() => navigateDate(-1)}
          class="p-2 rounded-xl text-warm-600 hover:bg-warm-100/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
          aria-label="Jour précédent"
        >
          <ChevronLeft size={20} />
        </button>
        {#if !data.isToday}
          <button
            type="button"
            onclick={() => goto('/app/attendance')}
            class="px-3 py-1.5 rounded-xl text-sm font-semibold text-miel-600 hover:bg-miel-100/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
          >
            Aujourd'hui
          </button>
        {/if}
        <button
          type="button"
          onclick={() => navigateDate(1)}
          class="p-2 rounded-xl text-warm-600 hover:bg-warm-100/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
          aria-label="Jour suivant"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    {/snippet}
  </PageHeader>

  <!-- Summary card -->
  <FadeIn>
    <Card padding="md" class="mb-6">
      <div class="flex items-center gap-4 mb-3">
        <div class="w-11 h-11 rounded-2xl bg-mousse-400/15 flex items-center justify-center shrink-0">
          <UserCheck size={22} class="text-mousse-500" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-lg font-display font-bold text-warm-900">
            {presentCount}<span class="text-warm-400 font-normal">/{totalChildren}</span>
            <span class="text-base font-normal text-warm-600 ml-1">présents</span>
          </p>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="h-2.5 rounded-full bg-warm-200/60 overflow-hidden mb-3">
        <div
          class="h-full rounded-full bg-mousse-400 transition-all duration-700"
          style="width: {progressPercent}%"
          style:--easing="cubic-bezier(0.22, 1, 0.36, 1)"
        ></div>
      </div>

      <!-- Mini stats -->
      <div class="flex flex-wrap gap-3 text-sm">
        {#if presentCount > 0}
          <span class="inline-flex items-center gap-1.5 text-mousse-500">
            <CircleCheck size={14} />
            {presentCount} présent{presentCount > 1 ? 's' : ''}
          </span>
        {/if}
        {#if departedCount > 0}
          <span class="inline-flex items-center gap-1.5 text-bleu-500">
            <LogOut size={14} />
            {departedCount} parti{departedCount > 1 ? 's' : ''}
          </span>
        {/if}
        {#if absentCount > 0}
          <span class="inline-flex items-center gap-1.5 text-argile-500">
            <Ban size={14} />
            {absentCount} absent{absentCount > 1 ? 's' : ''}
          </span>
        {/if}
      </div>
    </Card>
  </FadeIn>

  <!-- Error message -->
  {#if form && !form.success && 'error' in form}
    <FadeIn>
      <div class="mb-4 px-4 py-3 rounded-2xl bg-argile-400/10 text-argile-500 text-sm font-medium" role="alert">
        {form.error}
      </div>
    </FadeIn>
  {/if}

  <!-- Late alert: children still present after 18h -->
  {#if data.isToday && data.role === 'assistante' && currentHour >= 18 && presentCount > 0}
    <FadeIn>
      <div class="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-sienne-400/10 ring-1 ring-sienne-400/25" role="alert">
        <AlertTriangle size={18} class="text-sienne-600 shrink-0" />
        <p class="text-sm text-sienne-700">
          <strong>{presentCount} enfant{presentCount > 1 ? 's' : ''}</strong> encore marqué{presentCount > 1 ? 's' : ''} présent{presentCount > 1 ? 's' : ''}. Pensez à pointer les départs.
        </p>
      </div>
    </FadeIn>
  {/if}

  <!-- Children list -->
  {#if data.attendances.length === 0}
    <FadeIn delay={60}>
      <Card padding="lg" class="text-center">
        <UserCheck size={40} class="text-warm-300 mx-auto mb-3" />
        <p class="text-warm-600 font-medium">Aucun enfant enregistré</p>
      </Card>
    </FadeIn>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each data.attendances as att, i}
        {@const status = getChildStatus(att)}
        {@const config = statusConfig[status]}
        {@const StatusIcon = config.icon}
        <FadeIn delay={i * 60}>
          <Card padding="md" hover class="h-full">
            <!-- Child info row -->
            <div class="flex items-center gap-3 mb-3">
              <Avatar name="{att.childFirstName} {att.childLastName}" size="lg" kind="child"
                src={att.childAvatar ?? undefined} />
              <div class="flex-1 min-w-0">
                <h3 class="font-display font-bold text-warm-900 truncate">
                  {att.childFirstName} {att.childLastName}
                </h3>
                {#if att.expectedStart && att.expectedEnd}
                  <p class="text-xs text-warm-500 flex items-center gap-1 mt-0.5">
                    <Clock size={11} />
                    {att.expectedStart} – {att.expectedEnd}
                  </p>
                {/if}
              </div>
              <Badge variant={config.variant} size="sm">
                <span class="flex items-center gap-1">
                  <StatusIcon size={12} />
                  {config.label}
                </span>
              </Badge>
            </div>

            <!-- Time details -->
            {#if status === 'present' && att.arrivalTime}
              <p class="text-sm text-mousse-600 mb-3 flex items-center gap-1.5">
                <LogIn size={14} />
                Arrivé à <span class="font-semibold">{formatTime(att.arrivalTime)}</span>
              </p>
            {/if}
            {#if status === 'departed' && att.arrivalTime && att.departureTime}
              {@const delta = computeDeltaMinutes(att.arrivalTime, att.departureTime, att.expectedStart, att.expectedEnd)}
              <div class="text-sm text-bleu-500 mb-3 flex flex-wrap items-center gap-3">
                <span class="flex items-center gap-1">
                  <LogIn size={14} />
                  {formatTime(att.arrivalTime)}
                </span>
                <span class="text-warm-300">→</span>
                <span class="flex items-center gap-1">
                  <LogOut size={14} />
                  {formatTime(att.departureTime)}
                </span>
                <Badge variant="info" size="sm">{computeDuration(att.arrivalTime, att.departureTime)}</Badge>
                {#if delta !== null}
                  <span class="text-xs font-semibold {deltaColorClass(delta)}">
                    {formatDelta(delta)}
                  </span>
                {/if}
              </div>
              {#if att.expectedStart && att.expectedEnd}
                <p class="text-xs text-warm-400 mb-3">
                  Prévu : {att.expectedStart} – {att.expectedEnd} ({computeExpectedDuration(att.expectedStart, att.expectedEnd)})
                </p>
              {/if}
            {/if}
            {#if att.notes && att.id}
              <p class="text-xs text-warm-500 italic mb-3">{att.notes}</p>
            {/if}

            <!-- Actions (assistante only, today only) -->
            {#if data.role === 'assistante' && data.isToday}
              <div class="flex flex-wrap gap-2 pt-2 border-t border-warm-200/40">
                {#if status === 'expected' || status === 'not_expected'}
                  <Button size="sm" variant="primary" onclick={() => openCheckin(att.childId)}>
                    <span class="flex items-center gap-1.5"><LogIn size={14} /> Pointer arrivée</span>
                  </Button>
                  <Button size="sm" variant="ghost" onclick={() => openAbsent(att.childId)}>
                    <span class="flex items-center gap-1.5"><Ban size={14} /> Absent</span>
                  </Button>
                {:else if status === 'present'}
                  <Button size="sm" variant="secondary" onclick={() => openCheckout(att.childId)}>
                    <span class="flex items-center gap-1.5"><LogOut size={14} /> Pointer départ</span>
                  </Button>
                  <button
                    type="button"
                    onclick={() => openEdit(att.childId)}
                    class="p-2 rounded-xl text-warm-500 hover:text-miel-600 hover:bg-warm-100/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
                    aria-label="Modifier"
                  >
                    <Pencil size={15} />
                  </button>
                {:else if status === 'departed'}
                  <button
                    type="button"
                    onclick={() => openEdit(att.childId)}
                    class="p-2 rounded-xl text-warm-500 hover:text-miel-600 hover:bg-warm-100/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-miel-400/40"
                    aria-label="Modifier les horaires"
                  >
                    <Pencil size={15} />
                  </button>
                {:else if status === 'absent_planned' || status === 'absent_unplanned'}
                  <form method="POST" action="?/cancel" use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => { isSubmitting = false; update(); };
                  }}>
                    <input type="hidden" name="childId" value={att.childId} />
                    <Button size="sm" variant="ghost" type="submit" disabled={isSubmitting}>
                      <span class="flex items-center gap-1.5"><X size={14} /> Annuler absence</span>
                    </Button>
                  </form>
                {/if}
              </div>
            {/if}
          </Card>
        </FadeIn>
      {/each}
    </div>
  {/if}
</div>

<!-- ── Checkin Modal ──────────────────────────────────────────────────────── -->

{#if checkinChildId}
  {@const child = data.attendances.find(a => a.childId === checkinChildId)}
  {@const personOptions = getPersonOptions(checkinChildId)}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Pointer l'arrivée"
  >
    <!-- Backdrop -->
    <button
      type="button"
      class="absolute inset-0 bg-nuit/25 backdrop-blur-sm"
      onclick={closeModals}
      aria-label="Fermer"
    ></button>

    <!-- Dialog -->
    <div class="modal-glass relative w-full max-w-md p-6 animate-modal-enter">
      <h2 class="text-lg font-display font-bold text-warm-900 mb-1">
        Pointer l'arrivée
      </h2>
      <p class="text-sm text-warm-600 mb-5">
        {child?.childFirstName} {child?.childLastName}
      </p>

      <form method="POST" action="?/checkin" use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => { isSubmitting = false; update(); };
      }}>
        <input type="hidden" name="childId" value={checkinChildId} />
        <input type="hidden" name="personType" value={selectedPersonType} />
        <input type="hidden" name="personId" value={selectedPersonId} />

        <Select
          label="Qui accompagne ?"
          name="personSelect"
          required
          options={personOptions.map(o => ({ value: o.value, label: o.label }))}
          value={selectedPersonId}
          onchange={(e) => handlePersonSelect((e.target as HTMLSelectElement).value)}
          class="mb-4"
        />

        <div class="mb-5">
          <label for="checkin-time" class="block text-sm font-semibold text-warm-700 mb-1.5">
            Heure (optionnel)
          </label>
          <input
            id="checkin-time"
            type="time"
            name="time"
            bind:value={timeOverride}
            class="schedule-time-input w-full"
            placeholder="Laisser vide = maintenant"
          />
          <p class="text-xs text-warm-400 mt-1">Laisser vide pour l'heure actuelle</p>
        </div>

        <div class="flex gap-3 justify-end">
          <Button variant="ghost" onclick={closeModals}>Annuler</Button>
          <Button variant="primary" type="submit" disabled={isSubmitting || !selectedPersonId}>
            <span class="flex items-center gap-1.5">
              <LogIn size={15} />
              {isSubmitting ? 'Pointage...' : 'Confirmer'}
            </span>
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Checkout Modal ─────────────────────────────────────────────────────── -->

{#if checkoutChildId}
  {@const child = data.attendances.find(a => a.childId === checkoutChildId)}
  {@const personOptions = getPersonOptions(checkoutChildId)}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Pointer le départ"
  >
    <button
      type="button"
      class="absolute inset-0 bg-nuit/25 backdrop-blur-sm"
      onclick={closeModals}
      aria-label="Fermer"
    ></button>

    <div class="modal-glass relative w-full max-w-md p-6 animate-modal-enter">
      <h2 class="text-lg font-display font-bold text-warm-900 mb-1">
        Pointer le départ
      </h2>
      <p class="text-sm text-warm-600 mb-5">
        Est-ce bien <strong>{child?.childFirstName}</strong> qui nous quitte ?
      </p>

      <form method="POST" action="?/checkout" use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => { isSubmitting = false; update(); };
      }}>
        <input type="hidden" name="childId" value={checkoutChildId} />
        <input type="hidden" name="personType" value={selectedPersonType} />
        <input type="hidden" name="personId" value={selectedPersonId} />

        <Select
          label="Qui récupère ?"
          name="personSelect"
          required
          options={personOptions.map(o => ({ value: o.value, label: o.label }))}
          value={selectedPersonId}
          onchange={(e) => handlePersonSelect((e.target as HTMLSelectElement).value)}
          class="mb-4"
        />

        <div class="mb-5">
          <label for="checkout-time" class="block text-sm font-semibold text-warm-700 mb-1.5">
            Heure (optionnel)
          </label>
          <input
            id="checkout-time"
            type="time"
            name="time"
            bind:value={timeOverride}
            class="schedule-time-input w-full"
          />
          <p class="text-xs text-warm-400 mt-1">Laisser vide pour l'heure actuelle</p>
        </div>

        <div class="flex gap-3 justify-end">
          <Button variant="ghost" onclick={closeModals}>Annuler</Button>
          <Button variant="primary" type="submit" disabled={isSubmitting || !selectedPersonId}>
            <span class="flex items-center gap-1.5">
              <LogOut size={15} />
              {isSubmitting ? 'Pointage...' : 'Confirmer le départ'}
            </span>
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Absent Modal ───────────────────────────────────────────────────────── -->

{#if absentChildId}
  {@const child = data.attendances.find(a => a.childId === absentChildId)}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Marquer absent"
  >
    <button
      type="button"
      class="absolute inset-0 bg-nuit/25 backdrop-blur-sm"
      onclick={closeModals}
      aria-label="Fermer"
    ></button>

    <div class="modal-glass relative w-full max-w-md p-6 animate-modal-enter">
      <h2 class="text-lg font-display font-bold text-warm-900 mb-1">
        Marquer absent
      </h2>
      <p class="text-sm text-warm-600 mb-5">
        {child?.childFirstName} {child?.childLastName}
      </p>

      <form method="POST" action="?/absent" use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => { isSubmitting = false; update(); };
      }}>
        <input type="hidden" name="childId" value={absentChildId} />

        <fieldset class="mb-4">
          <legend class="block text-sm font-semibold text-warm-700 mb-2">Type d'absence</legend>
          <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer rounded-xl px-3 py-2 transition-colors
              {absentStatus === 'absent_planned' ? 'glass-2' : 'hover:bg-warm-100/30'}">
              <input type="radio" name="status" value="absent_planned"
                bind:group={absentStatus}
                class="accent-soleil-500" />
              <span class="text-sm text-warm-700">Prévu</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer rounded-xl px-3 py-2 transition-colors
              {absentStatus === 'absent_unplanned' ? 'glass-2' : 'hover:bg-warm-100/30'}">
              <input type="radio" name="status" value="absent_unplanned"
                bind:group={absentStatus}
                class="accent-argile-500" />
              <span class="text-sm text-warm-700">Imprévu</span>
            </label>
          </div>
        </fieldset>

        <div class="mb-5">
          <label for="absent-notes" class="block text-sm font-semibold text-warm-700 mb-1.5">
            Notes (optionnel)
          </label>
          <textarea
            id="absent-notes"
            name="notes"
            bind:value={absentNotes}
            rows="2"
            class="textarea-soie w-full"
            placeholder="Raison de l'absence..."
          ></textarea>
        </div>

        <div class="flex gap-3 justify-end">
          <Button variant="ghost" onclick={closeModals}>Annuler</Button>
          <Button variant="danger" type="submit" disabled={isSubmitting}>
            <span class="flex items-center gap-1.5">
              <Ban size={15} />
              {isSubmitting ? 'Enregistrement...' : 'Confirmer'}
            </span>
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Edit Modal ─────────────────────────────────────────────────────────── -->

{#if editChildId}
  {@const child = data.attendances.find(a => a.childId === editChildId)}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Modifier le pointage"
  >
    <button
      type="button"
      class="absolute inset-0 bg-nuit/25 backdrop-blur-sm"
      onclick={closeModals}
      aria-label="Fermer"
    ></button>

    <div class="modal-glass relative w-full max-w-md p-6 animate-modal-enter">
      <h2 class="text-lg font-display font-bold text-warm-900 mb-1">
        Modifier le pointage
      </h2>
      <p class="text-sm text-warm-600 mb-5">
        {child?.childFirstName} {child?.childLastName}
      </p>

      <form method="POST" action="?/edit" use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => { isSubmitting = false; update(); };
      }}>
        <input type="hidden" name="attendanceId" value={child?.id ?? ''} />

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="edit-arrival" class="block text-sm font-semibold text-warm-700 mb-1.5">
              Arrivée
            </label>
            <input
              id="edit-arrival"
              type="time"
              name="arrivalTime"
              bind:value={editArrivalTime}
              class="schedule-time-input w-full"
            />
          </div>
          <div>
            <label for="edit-departure" class="block text-sm font-semibold text-warm-700 mb-1.5">
              Départ
            </label>
            <input
              id="edit-departure"
              type="time"
              name="departureTime"
              bind:value={editDepartureTime}
              class="schedule-time-input w-full"
            />
          </div>
        </div>

        <div class="mb-5">
          <label for="edit-notes" class="block text-sm font-semibold text-warm-700 mb-1.5">
            Notes
          </label>
          <textarea
            id="edit-notes"
            name="notes"
            bind:value={editNotes}
            rows="2"
            class="textarea-soie w-full"
          ></textarea>
        </div>

        <div class="flex gap-3 justify-end">
          <Button variant="ghost" onclick={closeModals}>Annuler</Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            <span class="flex items-center gap-1.5">
              <Pencil size={15} />
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </span>
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-glass {
    background: rgba(255, 248, 240, 0.88);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.35);
    border-radius: 1.75rem;
    box-shadow:
      0 20px 60px rgba(194, 101, 58, 0.12),
      0 4px 16px rgba(194, 101, 58, 0.06);
  }

  .animate-modal-enter {
    animation: modalEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes modalEnter {
    from {
      opacity: 0;
      transform: scale(0.92) translateY(12px);
    }
    60% {
      transform: scale(1.02) translateY(0);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .schedule-time-input {
    display: block;
    width: 100%;
    border-radius: 0.75rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    color: var(--color-warm-900);
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .schedule-time-input:focus {
    border-color: rgba(232, 145, 58, 0.5);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.12);
  }

  .textarea-soie {
    display: block;
    width: 100%;
    border-radius: 0.75rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    color: var(--color-warm-900);
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    outline: none;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .textarea-soie:focus {
    border-color: rgba(232, 145, 58, 0.5);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.12);
  }
</style>
