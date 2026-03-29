<script lang="ts">
  import type { PageData } from './$types';
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { FadeIn, Button } from '$lib/ui';
  import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-svelte';

  interface Props { data: PageData; }
  let { data }: Props = $props();

  let svg = $state('');
  let dataUrl = $state('');
  let expiresAt = $state(0);
  let secondsLeft = $state(120);
  let loading = $state(true);
  let errorMsg = $state('');
  let refreshing = $state(false);

  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  async function fetchQr() {
    try {
      refreshing = true;
      errorMsg = '';
      const res = await fetch('/api/qr/generate', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errorMsg = body.error || 'Erreur lors de la génération du QR code';
        return;
      }
      const result = await res.json();
      svg = result.svg ?? '';
      dataUrl = result.dataUrl ?? '';
      expiresAt = result.expiresAt;
      secondsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
    } catch {
      errorMsg = 'Erreur de connexion au serveur';
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  onMount(() => {
    fetchQr();
    countdownInterval = setInterval(() => {
      if (expiresAt <= 0) return;
      secondsLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      // Auto-refresh when expired or about to expire
      if (secondsLeft <= 5 && !refreshing) fetchQr();
    }, 1000);
  });

  onDestroy(() => {
    if (countdownInterval) clearInterval(countdownInterval);
  });

  const progressPercent = $derived(Math.max(0, (secondsLeft / 120) * 100));
  const hasQr = $derived(svg.length > 0 || dataUrl.length > 0);
</script>

<svelte:head>
  <title>Mon QR Code — Le Cocon</title>
</svelte:head>

<div class="qr-page flex flex-col items-center px-4 py-6">

  <!-- Back button -->
  <div class="w-full max-w-sm mb-4">
    <a
      href="/app/attendance"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-warm-600 hover:text-miel-600 transition-colors"
    >
      <ArrowLeft size={16} />
      Retour
    </a>
  </div>

  <FadeIn>
    <div class="w-full max-w-sm flex flex-col items-center">
      <!-- Header -->
      <div class="text-center mb-4">
        <div class="w-12 h-12 rounded-2xl bg-miel-500/15 flex items-center justify-center mx-auto mb-2">
          <ShieldCheck size={24} class="text-miel-600" />
        </div>
        <h1 class="text-lg font-display font-bold text-warm-900">Votre QR Code</h1>
        <p class="text-sm text-warm-500 mt-0.5">Présentez ce code à votre assistante</p>
      </div>

      <!-- QR Card -->
      <div class="qr-card rounded-3xl p-5 w-full mb-4">
        {#if loading}
          <div class="qr-display mx-auto flex items-center justify-center">
            <div class="w-8 h-8 border-3 border-miel-300 border-t-miel-600 rounded-full animate-spin"></div>
          </div>
        {:else if errorMsg}
          <div class="qr-display mx-auto flex flex-col items-center justify-center text-center p-4">
            <p class="text-argile-500 text-sm font-medium mb-3">{errorMsg}</p>
            <Button size="sm" variant="secondary" onclick={fetchQr}>
              <span class="flex items-center gap-1.5"><RefreshCw size={14} /> Réessayer</span>
            </Button>
          </div>
        {:else if hasQr}
          <div class="mx-auto transition-opacity duration-300" class:opacity-40={refreshing}>
            {#if dataUrl}
              <img src={dataUrl} alt="QR Code" class="qr-display mx-auto rounded-xl" />
            {:else if svg}
              <div class="qr-display mx-auto">
                {@html svg}
              </div>
            {/if}
          </div>
        {:else}
          <div class="qr-display mx-auto flex items-center justify-center">
            <p class="text-warm-400 text-sm">QR code indisponible</p>
          </div>
        {/if}
      </div>

      <!-- Timer -->
      {#if !loading && hasQr}
        <div class="text-center mb-4 w-full">
          <div class="h-1.5 rounded-full bg-warm-200/60 overflow-hidden mx-auto max-w-48 mb-1.5">
            <div
              class="h-full rounded-full transition-all duration-1000 ease-linear
                {secondsLeft > 30 ? 'bg-mousse-400' : secondsLeft > 10 ? 'bg-soleil-400' : 'bg-argile-400'}"
              style="width: {progressPercent}%"
            ></div>
          </div>
          <p class="text-xs text-warm-400">
            Renouvellement dans <span class="font-semibold text-warm-600">{secondsLeft}s</span>
          </p>
        </div>
      {/if}

      <!-- User name -->
      <div class="text-center">
        <p class="text-sm font-semibold text-warm-700">{data.userName}</p>
        <p class="text-[11px] text-warm-400 mt-0.5">Code sécurisé, renouvellement automatique</p>
      </div>
    </div>
  </FadeIn>
</div>

<style>
  .qr-page {
    min-height: calc(100dvh - 2.75rem - 4.5rem);
    /* 2.75rem = mobile header h-11 (44px), 4.5rem = bottom nav ~72px */
    justify-content: center;
  }

  .qr-card {
    background: rgba(255, 248, 240, 0.75);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 12px 40px rgba(194, 101, 58, 0.1),
      0 2px 12px rgba(194, 101, 58, 0.04);
  }

  .qr-display {
    width: min(280px, 100%);
    aspect-ratio: 1;
  }

  .qr-display :global(svg) {
    width: 100%;
    height: 100%;
    border-radius: 0.75rem;
  }
</style>
