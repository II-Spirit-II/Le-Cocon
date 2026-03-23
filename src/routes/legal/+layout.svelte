<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="min-h-screen bg-aube">
  <!-- Header -->
  <header class="glass-1 border-b border-white/15 py-4 px-4">
    <div class="max-w-3xl mx-auto flex items-center justify-between">
      <a href="/" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <img src="/favicon.png" alt="Le Cocon" class="w-8 h-8" />
        <span class="font-display font-bold text-xl text-warm-900">Le Cocon</span>
      </a>
      <a href="/" class="text-sm text-miel-600 hover:text-miel-700 transition-colors">
        Retour à l'accueil
      </a>
    </div>
  </header>

  <!-- Content -->
  <main class="py-12 px-4">
    <div class="max-w-3xl mx-auto glass-1 rounded-3xl p-8">
      {@render children()}
    </div>
  </main>

  <!-- Footer -->
  <footer class="py-8 px-4 text-center text-sm text-warm-500">
    <p>© 2025 Le Cocon. Tous droits réservés.</p>
  </footer>
</div>
