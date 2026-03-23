<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';
  import { auth } from '$lib/stores/auth';
  import { browser } from '$app/environment';

  interface Props {
    children: Snippet;
    data: LayoutData;
  }

  let { children, data }: Props = $props();

  // Nettoyer les anciennes donnees localStorage du mode demo (migration)
  if (browser) {
    localStorage.removeItem('lecocon_mock_user_role');
    localStorage.removeItem('lecocon_demo_mode');
  }

  // Synchroniser le store auth avec les donnees serveur AVANT le rendu
  // $effect.pre se declenche avant la mise a jour du DOM (contrairement a $effect
  // qui se declenche apres), ce qui evite un flash avec l'ancien role le temps
  // que le store se synchronise avec les nouvelles donnees serveur.
  $effect.pre(() => {
    auth.initFromServer(data.user);
  });
</script>

<svelte:head>
  <title>Le Cocon - Cahier de liaison</title>
  <meta name="description" content="Le Cocon - Votre cahier de liaison moderne entre assistante maternelle et parents" />
</svelte:head>

{@render children()}
