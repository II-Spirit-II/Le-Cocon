<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { fly } from 'svelte/transition';
  import { Card, Button, Avatar, Textarea, Input } from '$lib/ui';
  import { DURATION } from '$lib/ui/motion';
  import type { ParentNoteKind } from '$lib/types';
  import {
    FileText, ChevronLeft, Check, Calendar, Clock,
    Stethoscope, Backpack, MessageCircle
  } from 'lucide-svelte';

  interface Props { data: PageData; form: ActionData; }
  let { data, form }: Props = $props();

  // ── Step management ────────────────────────────────────────────────
  let step = $state(1);
  let direction = $state<'forward' | 'backward'>('forward');

  const getDuration = () => {
    if (!browser) return 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return DURATION.page;
  };

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

  // ── Step 1: Child selection ────────────────────────────────────────
  let selectedChildId = $state('');
  let selectedChildName = $state('');

  function selectChild(id: string, name: string) {
    selectedChildId = id;
    selectedChildName = name;
    direction = 'forward';
    step = 2;
  }

  // ── Step 2: Kind selection ─────────────────────────────────────────
  const kinds: { value: ParentNoteKind; label: string; desc: string; Icon: typeof Calendar; color: string; iconBg: string }[] = [
    { value: 'absence', label: 'Absence', desc: 'Prevenir d\'une absence', Icon: Calendar, color: 'text-bleu-500', iconBg: 'bg-bleu-400/12' },
    { value: 'retard', label: 'Retard', desc: 'Signaler un retard', Icon: Clock, color: 'text-sienne-600', iconBg: 'bg-sienne-400/12' },
    { value: 'sante', label: 'Sante', desc: 'Information medicale', Icon: Stethoscope, color: 'text-argile-500', iconBg: 'bg-argile-400/10' },
    { value: 'logistique', label: 'Logistique', desc: 'Couches, vetements, repas...', Icon: Backpack, color: 'text-mousse-500', iconBg: 'bg-mousse-400/12' },
    { value: 'autre', label: 'Autre', desc: 'Message libre', Icon: MessageCircle, color: 'text-warm-600', iconBg: 'bg-warm-100' },
  ];

  let selectedKind = $state<ParentNoteKind>('autre');

  function selectKind(kind: ParentNoteKind) {
    selectedKind = kind;
    direction = 'forward';
    step = 3;
  }

  // ── Step 3: Content ────────────────────────────────────────────────
  let content = $state('');
  let startDate = $state('');
  let endDate = $state('');
  let isSubmitting = $state(false);

  const contentValid = $derived(content.trim().length > 0);
  const charCount = $derived(content.length);
  const showDates = $derived(selectedKind === 'absence' || selectedKind === 'retard');
  const selectedKindLabel = $derived(kinds.find(k => k.value === selectedKind)?.label ?? '');

  function goBack() {
    direction = 'backward';
    step--;
  }

  // Re-measure when dates toggle
  $effect(() => {
    showDates;
    if (browser) requestAnimationFrame(measureStep);
  });
</script>

<div class="min-h-[calc(100dvh-4rem)] flex items-center justify-center p-4 sm:p-8">
  <div class="w-full max-w-md">

    <!-- Progress -->
    <div class="flex items-center justify-center gap-2 mb-6">
      {#each [1, 2, 3] as s}
        <div class="step-dot {step >= s ? 'step-dot-active' : 'step-dot-inactive'}">
          {s}
        </div>
        {#if s < 3}
          <div class="w-8 h-1 rounded-full transition-colors duration-300 {step > s ? 'bg-miel-500' : 'bg-warm-200/60'}"></div>
        {/if}
      {/each}
    </div>

    <Card padding="lg">
      <form
        method="POST"
        use:enhance={() => {
          isSubmitting = true;
          return async ({ update }) => {
            isSubmitting = false;
            update();
          };
        }}
      >
        <input type="hidden" name="childId" value={selectedChildId} />
        <input type="hidden" name="kind" value={selectedKind} />
        {#if startDate}
          <input type="hidden" name="startDate" value={startDate} />
        {/if}
        {#if endDate}
          <input type="hidden" name="endDate" value={endDate} />
        {/if}

        <div
          class="relative overflow-hidden transition-[height] duration-500"
          style="height: {containerHeight ? containerHeight + 'px' : 'auto'}; --ease-silk: cubic-bezier(0.22, 1, 0.36, 1);"
          style:transition-timing-function="var(--ease-silk)"
        >

          <!-- ═══ STEP 1 — Child ═══ -->
          {#if step === 1}
            <div
              bind:this={stepEls[1]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'backward' ? -20 : 0, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: -20, duration: getDuration(), opacity: 0 }}
            >
              <div class="flex justify-center mb-5">
                <div class="note-icon">
                  <FileText size={28} class="text-miel-500" />
                </div>
              </div>

              <h1 class="text-xl font-display font-bold text-warm-900 text-center mb-1">
                Nouvelle note
              </h1>
              <p class="text-sm text-warm-600 text-center mb-6">
                Pour quel enfant souhaitez-vous ecrire ?
              </p>

              {#if data.children.length === 0}
                <div class="text-center py-4">
                  <p class="text-sm text-warm-500 mb-4">Aucun enfant associe</p>
                  <Button variant="primary" href="/app/settings/invite">Utiliser un code d'invitation</Button>
                </div>
              {:else}
                <div class="space-y-2">
                  {#each data.children as child, i}
                    <button
                      type="button"
                      onclick={() => selectChild(child.id, child.firstName)}
                      class="child-card"
                      style="--delay: {i * 50}ms"
                    >
                      <Avatar name="{child.firstName} {child.lastName}" size="md" src={child.avatarUrl} />
                      <div class="flex-1 min-w-0 text-left">
                        <p class="text-sm font-semibold text-warm-900">{child.firstName}</p>
                        <p class="text-xs text-warm-500">{child.lastName}</p>
                      </div>
                      <div class="child-card-arrow">
                        <ChevronLeft size={14} class="rotate-180" />
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}

              <div class="mt-6 text-center">
                <a href="/app/notes" class="text-xs text-warm-500 hover:text-warm-700 transition-colors">
                  Annuler
                </a>
              </div>
            </div>

          <!-- ═══ STEP 2 — Kind ═══ -->
          {:else if step === 2}
            <div
              bind:this={stepEls[2]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'forward' ? 20 : -20, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: direction === 'forward' ? -20 : 20, duration: getDuration(), opacity: 0 }}
            >
              <div class="mb-4 flex items-center justify-between">
                <button type="button" onclick={goBack} class="back-btn">
                  <ChevronLeft size={14} /> Retour
                </button>
                <span class="text-xs font-medium text-miel-600 bg-miel-100 px-2.5 py-1 rounded-full">
                  {selectedChildName}
                </span>
              </div>

              <h2 class="text-lg font-display font-bold text-warm-900 text-center mb-1">
                Quel type de note ?
              </h2>
              <p class="text-sm text-warm-500 text-center mb-5">
                Choisissez la categorie
              </p>

              <div class="space-y-2">
                {#each kinds as kind, i}
                  {@const KindIcon = kind.Icon}
                  <button
                    type="button"
                    onclick={() => selectKind(kind.value)}
                    class="kind-card"
                    style="--delay: {i * 40}ms"
                  >
                    <div class="kind-card-icon {kind.iconBg}">
                      <KindIcon size={18} class={kind.color} />
                    </div>
                    <div class="flex-1 min-w-0 text-left">
                      <p class="text-sm font-semibold text-warm-900">{kind.label}</p>
                      <p class="text-[11px] text-warm-500">{kind.desc}</p>
                    </div>
                    <div class="child-card-arrow">
                      <ChevronLeft size={14} class="rotate-180" />
                    </div>
                  </button>
                {/each}
              </div>
            </div>

          <!-- ═══ STEP 3 — Content ═══ -->
          {:else if step === 3}
            <div
              bind:this={stepEls[3]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'forward' ? 20 : -20, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: direction === 'forward' ? -20 : 20, duration: getDuration(), opacity: 0 }}
            >
              <div class="mb-4 flex items-center justify-between">
                <button type="button" onclick={goBack} class="back-btn">
                  <ChevronLeft size={14} /> Retour
                </button>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-medium text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full">
                    {selectedKindLabel}
                  </span>
                  <span class="text-xs font-medium text-miel-600 bg-miel-100 px-2.5 py-1 rounded-full">
                    {selectedChildName}
                  </span>
                </div>
              </div>

              <h2 class="text-lg font-display font-bold text-warm-900 text-center mb-1">
                Votre message
              </h2>
              <p class="text-sm text-warm-500 text-center mb-5">
                Decrivez l'information a transmettre
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
                <div>
                  <Textarea
                    name="content"
                    placeholder={selectedKind === 'absence'
                      ? 'Ex : Emma sera absente pour vacances familiales'
                      : selectedKind === 'retard'
                      ? 'Ex : Arrivee prevue vers 10h, rendez-vous medical'
                      : selectedKind === 'sante'
                      ? 'Ex : Rhume leger, administrer le Doliprane si fievre'
                      : selectedKind === 'logistique'
                      ? 'Ex : Penser a remettre le doudou bleu dans le sac'
                      : 'Votre message pour l\'assistante...'}
                    rows={4}
                    required
                    disabled={isSubmitting}
                    maxlength={800}
                    bind:value={content}
                  />
                  <div class="flex justify-end mt-1">
                    <span class="text-[10px] {charCount > 700 ? 'text-argile-500' : 'text-warm-400'}">{charCount}/800</span>
                  </div>
                </div>

                <!-- Period (for absence/retard) -->
                {#if showDates}
                  <div class="dates-section">
                    <p class="text-xs font-semibold text-warm-700 mb-2">
                      {selectedKind === 'absence' ? 'Periode d\'absence' : 'Date du retard'}
                    </p>
                    <div class="grid grid-cols-2 gap-3">
                      <Input
                        type="date"
                        label="Du"
                        bind:value={startDate}
                        disabled={isSubmitting}
                      />
                      <Input
                        type="date"
                        label="Au"
                        bind:value={endDate}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                {/if}
              </div>

              <div class="flex gap-3 mt-8">
                <button
                  type="submit"
                  disabled={isSubmitting || !contentValid}
                  class="submit-btn {contentValid && !isSubmitting ? 'submit-btn-active' : 'submit-btn-disabled'}"
                >
                  {#if isSubmitting}
                    Envoi...
                  {:else}
                    <Check size={15} class="inline -mt-px mr-1" />
                    Envoyer la note
                  {/if}
                </button>
              </div>

              <div class="mt-4 text-center">
                <a href="/app/notes" class="text-xs text-warm-500 hover:text-warm-700 transition-colors">
                  Annuler
                </a>
              </div>
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
    width: 2rem; height: 2rem; border-radius: 9999px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8125rem; font-weight: 600;
    transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .step-dot-active {
    background: var(--color-miel-500); color: white;
    box-shadow: 0 4px 12px rgba(232, 145, 58, 0.25);
  }
  .step-dot-inactive {
    background: rgba(184, 158, 134, 0.15); color: var(--color-warm-500);
    box-shadow: inset 0 0 0 2px rgba(184, 158, 134, 0.3);
  }

  /* ── Note icon ── */
  .note-icon {
    width: 4.5rem; height: 4.5rem; border-radius: 1.5rem;
    display: flex; align-items: center; justify-content: center;
    background: rgba(232, 145, 58, 0.08);
    border: 2px solid rgba(232, 145, 58, 0.2);
    box-shadow: 0 8px 24px rgba(232, 145, 58, 0.1);
    animation: icon-breathe 3s ease-in-out infinite;
  }
  @keyframes icon-breathe {
    0%, 100% { box-shadow: 0 8px 24px rgba(232, 145, 58, 0.1); }
    50% { box-shadow: 0 8px 32px rgba(232, 145, 58, 0.18); }
  }

  /* ── Child cards ── */
  .child-card {
    display: flex; align-items: center; gap: 0.75rem;
    width: 100%; padding: 0.875rem 1rem; border-radius: 1rem;
    background: rgba(255, 248, 238, 0.45);
    border: 1.5px solid rgba(255, 240, 220, 0.4);
    cursor: pointer; outline: none;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: card-appear 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }
  .child-card:hover {
    background: rgba(255, 248, 238, 0.7);
    border-color: rgba(232, 145, 58, 0.25);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.1);
  }
  .child-card:active { transform: translateY(0) scale(0.98); }
  .child-card:focus-visible { box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3); }

  .child-card-arrow {
    width: 1.75rem; height: 1.75rem; border-radius: 0.5rem;
    display: flex; align-items: center; justify-content: center;
    background: rgba(232, 145, 58, 0.08); color: var(--color-miel-500);
    flex-shrink: 0; transition: all 0.2s ease;
  }
  .child-card:hover .child-card-arrow,
  .kind-card:hover .child-card-arrow {
    background: rgba(232, 145, 58, 0.15); color: var(--color-miel-700);
    transform: translateX(2px);
  }

  @keyframes card-appear {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Kind cards ── */
  .kind-card {
    display: flex; align-items: center; gap: 0.75rem;
    width: 100%; padding: 0.75rem 1rem; border-radius: 1rem;
    background: rgba(255, 248, 238, 0.45);
    border: 1.5px solid rgba(255, 240, 220, 0.4);
    cursor: pointer; outline: none;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    animation: card-appear 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }
  .kind-card:hover {
    background: rgba(255, 248, 238, 0.7);
    border-color: rgba(232, 145, 58, 0.25);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.1);
  }
  .kind-card:active { transform: translateY(0) scale(0.98); }
  .kind-card:focus-visible { box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3); }

  .kind-card-icon {
    width: 2.5rem; height: 2.5rem; border-radius: 0.75rem;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }
  .kind-card:hover .kind-card-icon {
    transform: scale(1.08);
  }

  /* ── Back button ── */
  .back-btn {
    font-size: 0.8125rem; color: var(--color-warm-500);
    display: flex; align-items: center; gap: 0.25rem;
    transition: color 0.15s ease; cursor: pointer;
    background: none; border: none;
  }
  .back-btn:hover { color: var(--color-warm-700); }

  /* ── Dates section ── */
  .dates-section {
    padding: 0.875rem;
    background: rgba(255, 248, 238, 0.45);
    border: 1px solid rgba(255, 240, 220, 0.4);
    border-radius: 1rem;
  }

  /* ── Submit button ── */
  .submit-btn {
    flex: 1; padding: 0.75rem 1.5rem; border-radius: 1rem;
    font-size: 0.875rem; font-weight: 700;
    border: none; cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); outline: none;
  }
  .submit-btn:focus-visible { box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3); }
  .submit-btn-active {
    background: var(--color-miel-500); color: white;
    box-shadow: 0 4px 16px rgba(232, 145, 58, 0.25);
  }
  .submit-btn-active:hover {
    background: var(--color-miel-600); transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.3);
  }
  .submit-btn-active:active { transform: translateY(0) scale(0.98); }
  .submit-btn-disabled {
    background: rgba(184, 158, 134, 0.15); color: var(--color-warm-400);
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .child-card, .kind-card { animation: none !important; }
    .step-dot, .submit-btn, .child-card, .kind-card, .kind-card-icon { transition: none !important; }
    .note-icon { animation: none !important; }
  }
</style>
