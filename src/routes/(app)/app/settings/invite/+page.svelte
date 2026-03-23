<script lang="ts">
  import type { ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { PageHeader, Card, Button, Input } from '$lib/ui';

  interface Props {
    form: ActionData;
  }

  let { form }: Props = $props();

  let code = $state('');
  let isSubmitting = $state(false);

  // Sync code when form action returns with errors
  $effect(() => {
    if (form?.code) code = form.code;
  });

  function formatCode(value: string): string {
    // Garder seulement les caracteres alphanumeriques et mettre en majuscules
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  }
</script>

<PageHeader
  title="Code d'invitation"
  description="Associez-vous a un enfant avec le code fourni par l'assistante maternelle"
/>

<div class="max-w-md">
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
      class="space-y-6"
    >
      <div>
        <label for="code" class="block text-sm font-medium text-warm-800 mb-2">
          Code d'invitation
        </label>
        <input
          type="text"
          id="code"
          name="code"
          value={code}
          oninput={(e) => code = formatCode((e.target as HTMLInputElement).value)}
          placeholder="ABCD1234"
          maxlength="8"
          class="w-full px-4 py-3 text-2xl font-mono text-center tracking-widest border-2 border-warm-300 rounded-xl focus-visible:border-miel-500 focus-visible:ring-1 focus-visible:ring-miel-500 transition-colors"
          disabled={isSubmitting}
          autocomplete="off"
          autocapitalize="characters"
        />
        <p class="mt-2 text-sm text-warm-600">
          Entrez le code à 8 caractères fourni par l'assistante maternelle
        </p>
      </div>

      {#if form?.error}
        <div class="p-3 bg-argile-400/10 border border-argile-400/20 rounded-xl text-argile-500 text-sm">
          {form.error}
        </div>
      {/if}

      <Button
        type="submit"
        variant="primary"
        class="w-full"
        disabled={isSubmitting || code.length < 8}
      >
        {isSubmitting ? 'Verification...' : 'Utiliser ce code'}
      </Button>
    </form>

    <div class="mt-6 pt-6 border-t border-warm-200">
      <h4 class="font-medium text-warm-900 mb-2">Comment obtenir un code ?</h4>
      <p class="text-sm text-warm-700">
        Demandez à votre assistante maternelle de générer un code d'invitation
        pour votre enfant depuis l'application. Le code est valable 7 jours.
      </p>
    </div>
  </Card>
</div>
