<script lang="ts">
  import { page } from '$app/stores';
  import { Home, Search, ShieldX, AlertTriangle } from 'lucide-svelte';

  let status = $derived($page.status);
  let message = $derived($page.error?.message);

  let title = $derived(
    status === 404
      ? 'Page introuvable'
      : status === 403
        ? 'Accès non autorisé'
        : status === 500
          ? 'Erreur inattendue'
          : 'Une erreur est survenue'
  );
</script>

<div class="bg-aube min-h-dvh flex items-center justify-center px-4 py-12">
  <div
    class="w-full max-w-md rounded-3xl p-10 text-center"
    style="
      background: rgba(255, 248, 240, 0.65);
      backdrop-filter: blur(20px) saturate(150%);
      -webkit-backdrop-filter: blur(20px) saturate(150%);
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px rgba(194, 101, 58, 0.08);
    "
  >
    <div class="flex justify-center mb-6">
      <img src="/favicon.png" alt="Le Cocon" class="w-10 h-10" />
    </div>

    <div class="flex justify-center mb-4 text-warm-400">
      {#if status === 404}
        <Search size={48} strokeWidth={1.5} />
      {:else if status === 403}
        <ShieldX size={48} strokeWidth={1.5} />
      {:else}
        <AlertTriangle size={48} strokeWidth={1.5} />
      {/if}
    </div>

    <h1 class="font-display text-7xl font-bold text-miel-500 mb-2">
      {status}
    </h1>

    <p class="text-xl font-medium text-warm-700 mb-2">
      {title}
    </p>

    {#if message}
      <p class="text-sm text-warm-500 mb-8">
        {message}
      </p>
    {:else}
      <div class="mb-8"></div>
    {/if}

    <a
      href="/"
      class="inline-flex items-center gap-2 px-6 py-3 bg-miel-500 text-white rounded-xl font-medium hover:bg-miel-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-miel-300"
    >
      <Home size={18} />
      Retour à l'accueil
    </a>
  </div>
</div>
