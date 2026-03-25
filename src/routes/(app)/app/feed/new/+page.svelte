<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { browser } from '$app/environment';
  import { enhance } from '$app/forms';
  import { fly } from 'svelte/transition';
  import { Card, Button, Avatar, Textarea } from '$lib/ui';
  import { DURATION } from '$lib/ui/motion';
  import { Newspaper, Camera, ChevronLeft, Check } from 'lucide-svelte';

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

  // Dynamic height
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

  function goBack() {
    direction = 'backward';
    step = 1;
  }

  // ── Step 2: News content ───────────────────────────────────────────
  let content = $state('');
  let emoji = $state('');
  let isSubmitting = $state(false);
  let attachmentPreview = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  const emojis = ['😊', '😴', '🍝', '🎨', '🛝', '📖', '🎵', '🧩', '🥣', '💪'];

  const contentValid = $derived(content.trim().length > 0);
  const charCount = $derived(content.length);

  function handleAttachmentSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { attachmentPreview = e.target?.result as string; };
      reader.readAsDataURL(file);
    }
    if (browser) requestAnimationFrame(measureStep);
  }

  function removeAttachment() {
    attachmentPreview = null;
    if (fileInput) fileInput.value = '';
    if (browser) requestAnimationFrame(measureStep);
  }
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
        enctype="multipart/form-data"
        use:enhance={() => {
          isSubmitting = true;
          return async ({ update }) => {
            isSubmitting = false;
            update();
          };
        }}
      >
        <!-- Hidden fields -->
        <input type="hidden" name="childId" value={selectedChildId} />
        <input type="hidden" name="emoji" value={emoji} />

        <div
          class="relative overflow-hidden transition-[height] duration-500"
          style="height: {containerHeight ? containerHeight + 'px' : 'auto'}; --ease-silk: cubic-bezier(0.22, 1, 0.36, 1);"
          style:transition-timing-function="var(--ease-silk)"
        >

          <!-- ═══ STEP 1 — Child selection ═══ -->
          {#if step === 1}
            <div
              bind:this={stepEls[1]}
              class="absolute inset-x-0 top-0 flex flex-col"
              in:fly={{ x: direction === 'backward' ? -20 : 0, duration: getDuration(), opacity: 0 }}
              out:fly={{ x: -20, duration: getDuration(), opacity: 0 }}
            >
              <div class="flex justify-center mb-5">
                <div class="news-icon-preview">
                  <Newspaper size={28} class="text-miel-500" />
                </div>
              </div>

              <h1 class="text-xl font-display font-bold text-warm-900 text-center mb-1">
                Nouvelle news
              </h1>
              <p class="text-sm text-warm-600 text-center mb-6">
                Pour quel enfant souhaitez-vous publier ?
              </p>

              {#if data.children.length === 0}
                <div class="text-center py-4">
                  <p class="text-sm text-warm-500 mb-4">Aucun enfant enregistre</p>
                  <Button variant="primary" href="/app/children/add">Ajouter un enfant</Button>
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
                <a href="/app/feed" class="text-xs text-warm-500 hover:text-warm-700 transition-colors">
                  Annuler
                </a>
              </div>
            </div>

          <!-- ═══ STEP 2 — News content ═══ -->
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
                <Newspaper size={18} class="text-miel-500" />
                <h1 class="text-xl font-display font-bold text-warm-900">
                  News pour {selectedChildName}
                </h1>
              </div>
              <p class="text-sm text-warm-600 text-center mb-6">
                Que souhaitez-vous partager ?
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
                    placeholder="Ex : Superbe sortie au parc ce matin !"
                    rows={3}
                    required
                    disabled={isSubmitting}
                    maxlength={500}
                    bind:value={content}
                  />
                  <div class="flex justify-end mt-1">
                    <span class="text-[10px] {charCount > 450 ? 'text-argile-500' : 'text-warm-400'}">{charCount}/500</span>
                  </div>
                </div>

                <!-- Emoji picker -->
                <div>
                  <p class="text-xs font-semibold text-warm-700 mb-2">Emoji (optionnel)</p>
                  <div class="flex flex-wrap gap-1.5">
                    {#each emojis as e, i}
                      <button
                        type="button"
                        onclick={() => emoji = emoji === e ? '' : e}
                        disabled={isSubmitting}
                        class="emoji-btn {emoji === e ? 'emoji-btn-active' : 'emoji-btn-inactive'}"
                        style="--delay: {i * 25}ms"
                      >
                        {e}
                      </button>
                    {/each}
                  </div>
                </div>

                <!-- Photo attachment -->
                <div>
                  <p class="text-xs font-semibold text-warm-700 mb-2">Photo (optionnel)</p>
                  <input
                    type="file"
                    name="attachment"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    bind:this={fileInput}
                    onchange={handleAttachmentSelect}
                    class="hidden"
                  />

                  {#if attachmentPreview}
                    <div class="relative inline-block attachment-appear">
                      <img
                        src={attachmentPreview}
                        alt="Apercu"
                        class="max-w-full max-h-36 rounded-xl object-cover border border-warm-200/50"
                      />
                      <button
                        type="button"
                        onclick={removeAttachment}
                        class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-argile-400 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-argile-500 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  {:else}
                    <button
                      type="button"
                      onclick={() => fileInput?.click()}
                      disabled={isSubmitting}
                      class="photo-btn"
                    >
                      <Camera size={16} />
                      <span>Ajouter une photo</span>
                    </button>
                  {/if}
                </div>
              </div>

              <div class="flex gap-3 mt-8">
                <button
                  type="submit"
                  disabled={isSubmitting || !contentValid}
                  class="publish-btn {contentValid && !isSubmitting ? 'publish-btn-active' : 'publish-btn-disabled'}"
                >
                  {#if isSubmitting}
                    Publication...
                  {:else}
                    <Check size={15} class="inline -mt-px mr-1" />
                    Publier la news
                  {/if}
                </button>
              </div>

              <div class="mt-4 text-center">
                <a href="/app/feed" class="text-xs text-warm-500 hover:text-warm-700 transition-colors">
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

  /* ── News icon preview ── */
  .news-icon-preview {
    width: 4.5rem;
    height: 4.5rem;
    border-radius: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(232, 145, 58, 0.08);
    border: 2px solid rgba(232, 145, 58, 0.2);
    box-shadow: 0 8px 24px rgba(232, 145, 58, 0.1);
    animation: icon-breathe 3s ease-in-out infinite;
  }
  @keyframes icon-breathe {
    0%, 100% { box-shadow: 0 8px 24px rgba(232, 145, 58, 0.1); }
    50% { box-shadow: 0 8px 32px rgba(232, 145, 58, 0.18); }
  }

  /* ── Child selection cards ── */
  .child-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1rem;
    border-radius: 1rem;
    background: rgba(255, 248, 238, 0.45);
    border: 1.5px solid rgba(255, 240, 220, 0.4);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    outline: none;
    animation: card-appear 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }
  .child-card:hover {
    background: rgba(255, 248, 238, 0.7);
    border-color: rgba(232, 145, 58, 0.25);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.1);
  }
  .child-card:active {
    transform: translateY(0) scale(0.98);
  }
  .child-card:focus-visible {
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3);
  }
  @keyframes card-appear {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .child-card-arrow {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(232, 145, 58, 0.08);
    color: var(--color-miel-500);
    flex-shrink: 0;
    transition: all 0.2s ease;
  }
  .child-card:hover .child-card-arrow {
    background: rgba(232, 145, 58, 0.15);
    color: var(--color-miel-700);
    transform: translateX(2px);
  }

  /* ── Emoji buttons ── */
  .emoji-btn {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 0.75rem;
    font-size: 1.125rem;
    border: 1.5px solid transparent;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    outline: none;
    animation: pill-pop 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }
  .emoji-btn:focus-visible {
    box-shadow: 0 0 0 2px rgba(232, 145, 58, 0.4);
  }
  .emoji-btn-active {
    background: var(--color-miel-100);
    border-color: var(--color-miel-500);
    box-shadow: 0 3px 10px rgba(232, 145, 58, 0.15);
    transform: scale(1.1);
  }
  .emoji-btn-inactive {
    background: rgba(255, 255, 255, 0.35);
    border-color: rgba(184, 158, 134, 0.15);
  }
  .emoji-btn-inactive:hover {
    background: rgba(255, 248, 240, 0.7);
    transform: scale(1.08);
  }
  @keyframes pill-pop {
    from { opacity: 0; transform: scale(0.8); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* ── Photo button ── */
  .photo-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 0.75rem;
    border: 2px dashed rgba(184, 158, 134, 0.3);
    color: var(--color-warm-600);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    background: transparent;
    outline: none;
  }
  .photo-btn:hover {
    border-color: rgba(232, 145, 58, 0.35);
    color: var(--color-miel-600);
    background: rgba(232, 145, 58, 0.04);
  }
  .photo-btn:focus-visible {
    box-shadow: 0 0 0 2px rgba(232, 145, 58, 0.3);
  }

  /* Attachment preview appear */
  .attachment-appear {
    animation: card-appear 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── Publish button ── */
  .publish-btn {
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
  .publish-btn:focus-visible {
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3);
  }
  .publish-btn-active {
    background: var(--color-miel-500);
    color: white;
    box-shadow: 0 4px 16px rgba(232, 145, 58, 0.25);
  }
  .publish-btn-active:hover {
    background: var(--color-miel-600);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.3);
  }
  .publish-btn-active:active {
    transform: translateY(0) scale(0.98);
  }
  .publish-btn-disabled {
    background: rgba(184, 158, 134, 0.15);
    color: var(--color-warm-400);
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .child-card, .emoji-btn, .attachment-appear { animation: none !important; }
    .step-dot, .publish-btn, .child-card, .emoji-btn, .news-icon-preview { transition: none !important; }
    .news-icon-preview { animation: none !important; }
  }
</style>
