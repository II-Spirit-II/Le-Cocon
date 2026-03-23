<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/app/feed');
  });
</script>

<div class="flex items-center justify-center h-64">
  <p class="text-warm-600">Redirection...</p>
</div>
