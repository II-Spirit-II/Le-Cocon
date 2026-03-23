<script lang="ts">
  import { Sparkles } from 'lucide-svelte';
  import { agentPanelOpen } from '$lib/stores/agent.svelte';
</script>

<button
  type="button"
  onclick={() => $agentPanelOpen = !$agentPanelOpen}
  class="fixed bottom-20 lg:bottom-6 right-6 z-40 flex items-center gap-2.5 pl-3.5 pr-4 py-3 rounded-full
         text-white text-sm font-semibold select-none cursor-pointer
         hover:scale-105 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-soie focus-visible:ring-miel-400
         transition-transform duration-200"
  style="background: linear-gradient(135deg, #E8913A, #C2653A);
         box-shadow: 0 4px 24px rgba(232,145,58,0.4), 0 1px 3px rgba(0,0,0,0.1);"
  aria-label="Ouvrir l'assistant IA"
>
  <Sparkles size={18} />
  <span class="hidden sm:inline">Assistant IA</span>

  {#if !$agentPanelOpen}
    <span
      class="absolute inset-0 rounded-full pointer-events-none agent-pulse-ring"
      aria-hidden="true"
    ></span>
  {/if}
</button>

<style>
  @keyframes agent-pulse {
    0%   { transform: scale(1);   opacity: 0.55; }
    70%  { transform: scale(1.35); opacity: 0;   }
    100% { transform: scale(1.35); opacity: 0;   }
  }

  .agent-pulse-ring {
    border: 2px solid rgba(232, 145, 58, 0.5);
    animation: agent-pulse 2.4s ease-out infinite;
  }
</style>
