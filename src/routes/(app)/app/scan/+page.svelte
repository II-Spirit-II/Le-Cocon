<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { FadeIn, Card, Button, Avatar } from '$lib/ui';
  import {
    ArrowLeft, Camera, CameraOff, Check, LogIn, LogOut,
    AlertTriangle, RotateCcw, UserCheck
  } from 'lucide-svelte';

  type ScanPhase = 'scanning' | 'result' | 'confirming' | 'success' | 'error';

  let phase = $state<ScanPhase>('scanning');
  let errorMsg = $state('');

  // Scanner
  let videoEl = $state<HTMLVideoElement | null>(null);
  let scanner: { start: () => Promise<void>; pause: (hard: boolean) => void; destroy: () => void } | null = null;
  let cameraReady = $state(false);
  let cameraError = $state('');

  // Scan result
  let parentName = $state('');
  let parentId = $state('');
  let children = $state<Array<{
    id: string;
    firstName: string;
    lastName: string;
    avatarPath: string | null;
    status: 'expected' | 'present' | 'departed' | 'absent';
    arrivalTime: string | null;
  }>>([]);
  let selectedChildIds = $state<Set<string>>(new Set());
  let isSubmitting = $state(false);

  // Determine scan mode from children statuses
  const hasExpected = $derived(children.some(c => c.status === 'expected'));
  const hasPresent = $derived(children.some(c => c.status === 'present'));
  const scanMode = $derived<'checkin' | 'checkout' | 'mixed'>(
    hasExpected && !hasPresent ? 'checkin'
    : hasPresent && !hasExpected ? 'checkout'
    : 'mixed'
  );

  // Auto-select actionable children
  function autoSelectChildren() {
    const ids = new Set<string>();
    for (const child of children) {
      if (scanMode === 'checkin' && child.status === 'expected') ids.add(child.id);
      else if (scanMode === 'checkout' && child.status === 'present') ids.add(child.id);
      else if (scanMode === 'mixed' && (child.status === 'expected' || child.status === 'present')) ids.add(child.id);
    }
    selectedChildIds = ids;
  }

  function toggleChild(id: string) {
    const next = new Set(selectedChildIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedChildIds = next;
  }

  async function initScanner() {
    if (!browser || !videoEl) return;

    // Check if getUserMedia is available (requires HTTPS on iOS)
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraError = window.isSecureContext
        ? 'Votre navigateur ne supporte pas l\'accès caméra.'
        : 'L\'accès caméra nécessite une connexion HTTPS.';
      return;
    }

    try {
      const QrScanner = (await import('qr-scanner')).default;

      // Check camera availability before creating scanner
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        cameraError = 'Aucune caméra détectée sur cet appareil.';
        return;
      }

      scanner = new QrScanner(
        videoEl,
        (result: { data: string }) => handleScan(result.data),
        {
          preferredCamera: 'environment',
          highlightScanRegion: false,
          highlightCodeOutline: false,
          maxScansPerSecond: 3,
          calculateScanRegion: (video: HTMLVideoElement) => {
            // Scan the central 60% of the video for better performance
            const size = Math.min(video.videoWidth, video.videoHeight) * 0.6;
            const x = (video.videoWidth - size) / 2;
            const y = (video.videoHeight - size) / 2;
            return { x, y, width: size, height: size };
          },
        }
      );
      await scanner.start();
      cameraReady = true;
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : '';

      if (name === 'NotAllowedError' || msg.includes('Permission')) {
        cameraError = 'Accès caméra refusé. Autorisez l\'accès dans les réglages de votre navigateur.';
      } else if (name === 'NotFoundError') {
        cameraError = 'Aucune caméra trouvée.';
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        cameraError = 'La caméra est utilisée par une autre application.';
      } else if (name === 'OverconstrainedError') {
        cameraError = 'Impossible d\'accéder à la caméra arrière. Réessayez.';
      } else {
        cameraError = `Impossible d'accéder à la caméra (${name || msg || 'erreur inconnue'}).`;
      }
    }
  }

  async function handleScan(data: string) {
    if (phase !== 'scanning') return;
    phase = 'result'; // prevent double-scan

    // Vibration feedback
    if (browser && navigator.vibrate) navigator.vibrate(200);

    // Pause scanner
    scanner?.pause(true);

    try {
      const res = await fetch('/api/qr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data }),
      });

      const result = await res.json();

      if (!res.ok) {
        errorMsg = result.error || 'Erreur de vérification';
        phase = 'error';
        return;
      }

      parentName = result.parentName;
      parentId = result.parentId;
      children = result.children;
      autoSelectChildren();
      phase = 'result';
    } catch {
      errorMsg = 'Erreur de connexion au serveur';
      phase = 'error';
    }
  }

  async function confirmAction(action: 'checkin' | 'checkout') {
    if (selectedChildIds.size === 0) return;
    isSubmitting = true;
    phase = 'confirming';

    try {
      const res = await fetch('/api/qr/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          parentId,
          childIds: [...selectedChildIds],
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        errorMsg = result.error || 'Erreur lors du pointage';
        phase = 'error';
        return;
      }

      phase = 'success';
      // Return to scanner after 2.5s
      setTimeout(() => resetScanner(), 2500);
    } catch {
      errorMsg = 'Erreur de connexion';
      phase = 'error';
    } finally {
      isSubmitting = false;
    }
  }

  function resetScanner() {
    phase = 'scanning';
    errorMsg = '';
    parentName = '';
    parentId = '';
    children = [];
    selectedChildIds = new Set();
    scanner?.start();
  }

  function formatTime(iso: string | null): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  }

  onMount(() => {
    // Small delay to ensure video element is rendered
    setTimeout(() => initScanner(), 100);
  });

  onDestroy(() => {
    scanner?.destroy();
  });
</script>

<svelte:head>
  <title>Scanner QR — Le Cocon</title>
</svelte:head>

<div class="min-h-[calc(100dvh-2.75rem-4.5rem)] flex flex-col lg:min-h-[calc(100dvh-2rem)]">

  <!-- Header -->
  <div class="px-4 pt-4 pb-2">
    <a
      href="/app/attendance"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-warm-600 hover:text-miel-600 transition-colors"
    >
      <ArrowLeft size={16} />
      Présences
    </a>
  </div>

  <!-- Scanner phase -->
  {#if phase === 'scanning'}
    <div class="flex-1 flex flex-col items-center px-4">
      <FadeIn>
        <div class="text-center mb-4">
          <h1 class="text-xl font-display font-bold text-warm-900">Scanner un QR Code</h1>
          <p class="text-sm text-warm-500 mt-1">Visez le QR code du parent</p>
        </div>
      </FadeIn>

      <div class="relative w-full max-w-md mx-auto aspect-square rounded-3xl overflow-hidden scanner-frame">
        <!-- Video feed -->
        <!-- autoplay + playsinline required for iOS camera -->
        <video
          bind:this={videoEl}
          class="w-full h-full object-cover"
          autoplay
          playsinline
          muted
        ></video>

        <!-- Scan overlay -->
        {#if cameraReady}
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="scan-target w-52 h-52 rounded-2xl"></div>
          </div>
          <div class="absolute bottom-4 left-0 right-0 text-center">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-nuit/50 text-white backdrop-blur-sm">
              <Camera size={12} />
              Caméra active
            </span>
          </div>
        {/if}

        <!-- Camera error -->
        {#if cameraError}
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-warm-100/90 p-6 text-center">
            <CameraOff size={40} class="text-warm-400 mb-3" />
            <p class="text-sm text-warm-700 font-medium">{cameraError}</p>
            <Button size="sm" variant="secondary" class="mt-4" onclick={() => { cameraError = ''; initScanner(); }}>
              Réessayer
            </Button>
          </div>
        {/if}
      </div>
    </div>

  <!-- Result phase -->
  {:else if phase === 'result'}
    <div class="flex-1 px-4 py-4">
      <FadeIn>
        <Card padding="md" class="max-w-sm mx-auto">
          <!-- Parent identified -->
          <div class="flex items-center gap-3 mb-4 pb-3 border-b border-warm-200/40">
            <div class="w-10 h-10 rounded-xl bg-mousse-400/15 flex items-center justify-center">
              <Check size={20} class="text-mousse-500" />
            </div>
            <div>
              <p class="text-xs font-medium text-mousse-500 uppercase tracking-wider">QR vérifié</p>
              <p class="font-display font-bold text-warm-900">{parentName}</p>
            </div>
          </div>

          <!-- Mode label -->
          <h2 class="text-sm font-semibold text-warm-700 mb-3">
            {#if scanMode === 'checkin'}
              Qui arrive aujourd'hui ?
            {:else if scanMode === 'checkout'}
              Qui nous quitte ?
            {:else}
              Sélectionnez les enfants
            {/if}
          </h2>

          <!-- Children list -->
          <div class="space-y-2 mb-5">
            {#each children as child}
              {@const isSelected = selectedChildIds.has(child.id)}
              {@const isActionable = (scanMode === 'checkin' && child.status === 'expected')
                || (scanMode === 'checkout' && child.status === 'present')
                || (scanMode === 'mixed' && (child.status === 'expected' || child.status === 'present'))}
              <button
                type="button"
                disabled={!isActionable}
                onclick={() => toggleChild(child.id)}
                class="w-full flex items-center gap-3 p-3 rounded-2xl transition-all outline-none
                  focus-visible:ring-2 focus-visible:ring-miel-400/40
                  {isSelected ? 'glass-2 ring-1 ring-mousse-400/30' : 'hover:bg-warm-100/30'}
                  {!isActionable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
              >
                <!-- Checkbox -->
                <div class="w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors
                  {isSelected ? 'bg-mousse-400 text-white' : 'border-2 border-warm-300'}">
                  {#if isSelected}
                    <Check size={13} strokeWidth={3} />
                  {/if}
                </div>

                <Avatar name="{child.firstName} {child.lastName}" size="sm" kind="child" />

                <div class="flex-1 min-w-0 text-left">
                  <p class="text-sm font-semibold text-warm-900 truncate">
                    {child.firstName} {child.lastName}
                  </p>
                  {#if child.status === 'present' && child.arrivalTime}
                    <p class="text-xs text-mousse-500">Arrivé à {formatTime(child.arrivalTime)}</p>
                  {:else if child.status === 'departed'}
                    <p class="text-xs text-bleu-500">Déjà parti</p>
                  {:else if child.status === 'absent'}
                    <p class="text-xs text-argile-500">Absent</p>
                  {/if}
                </div>
              </button>
            {/each}
          </div>

          <!-- Action buttons -->
          <div class="flex gap-3">
            <Button variant="ghost" onclick={resetScanner} class="flex-1">
              <span class="flex items-center gap-1.5 justify-center"><RotateCcw size={14} /> Rescanner</span>
            </Button>
            {#if scanMode === 'checkin' || scanMode === 'mixed'}
              <Button variant="primary" disabled={selectedChildIds.size === 0 || isSubmitting}
                onclick={() => confirmAction('checkin')} class="flex-1">
                <span class="flex items-center gap-1.5 justify-center">
                  <LogIn size={15} /> Arrivée
                </span>
              </Button>
            {/if}
            {#if scanMode === 'checkout' || scanMode === 'mixed'}
              <Button variant="secondary" disabled={selectedChildIds.size === 0 || isSubmitting}
                onclick={() => confirmAction('checkout')} class="flex-1">
                <span class="flex items-center gap-1.5 justify-center">
                  <LogOut size={15} /> Départ
                </span>
              </Button>
            {/if}
          </div>
        </Card>
      </FadeIn>
    </div>

  <!-- Confirming phase -->
  {:else if phase === 'confirming'}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="w-12 h-12 border-3 border-miel-300 border-t-miel-600 rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-warm-600 font-medium">Pointage en cours...</p>
      </div>
    </div>

  <!-- Success phase -->
  {:else if phase === 'success'}
    <div class="flex-1 flex items-center justify-center px-4">
      <FadeIn>
        <div class="text-center">
          <div class="w-20 h-20 rounded-full bg-mousse-400/15 flex items-center justify-center mx-auto mb-4 success-pulse">
            <Check size={40} class="text-mousse-500" />
          </div>
          <h2 class="text-xl font-display font-bold text-warm-900 mb-1">Pointage confirmé</h2>
          <p class="text-sm text-warm-500">Retour au scanner...</p>
        </div>
      </FadeIn>
    </div>

  <!-- Error phase -->
  {:else if phase === 'error'}
    <div class="flex-1 flex items-center justify-center px-4">
      <FadeIn>
        <Card padding="md" class="max-w-sm mx-auto text-center">
          <div class="w-14 h-14 rounded-full bg-argile-400/15 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} class="text-argile-500" />
          </div>
          <h2 class="text-lg font-display font-bold text-warm-900 mb-2">Erreur</h2>
          <p class="text-sm text-warm-600 mb-5">{errorMsg}</p>
          <Button variant="primary" onclick={resetScanner}>
            <span class="flex items-center gap-1.5"><RotateCcw size={15} /> Rescanner</span>
          </Button>
        </Card>
      </FadeIn>
    </div>
  {/if}
</div>

<style>
  .scanner-frame {
    background: var(--color-warm-100);
    border: 2px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(194, 101, 58, 0.1);
  }

  .scan-target {
    border: 2.5px solid rgba(232, 145, 58, 0.6);
    box-shadow:
      0 0 0 4000px rgba(26, 22, 18, 0.3),
      inset 0 0 20px rgba(232, 145, 58, 0.1);
    animation: scanPulse 2s ease-in-out infinite;
  }

  @keyframes scanPulse {
    0%, 100% { border-color: rgba(232, 145, 58, 0.6); }
    50% { border-color: rgba(232, 145, 58, 0.9); }
  }

  .success-pulse {
    animation: successPulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes successPulse {
    0% { transform: scale(0.5); opacity: 0; }
    60% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }
</style>
