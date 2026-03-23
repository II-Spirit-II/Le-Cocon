<script lang="ts">
  import type { ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { PageHeader, Card, Button, Input } from '$lib/ui';
  import { Lightbulb } from 'lucide-svelte';

  interface Props {
    form: ActionData;
  }

  let { form }: Props = $props();

  let firstName = $state('');
  let lastName = $state('');
  let birthDate = $state('');
  let isSubmitting = $state(false);

  // Sync form values when form action returns with errors
  $effect(() => {
    if (form?.firstName) firstName = form.firstName;
    if (form?.lastName) lastName = form.lastName;
    if (form?.birthDate) birthDate = form.birthDate;
  });

  // Date maximale = aujourd'hui
  const now = new Date();
  const maxDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
</script>

<PageHeader
  title="Ajouter un enfant"
  description="Enregistrez un nouvel enfant dans votre garde"
/>

<div class="max-w-lg">
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
      {#if form?.error}
        <div class="p-3 bg-argile-400/10 border border-argile-400/20 rounded-lg text-argile-500 text-sm">
          {form.error}
        </div>
      {/if}

      <Input
        label="Prénom"
        name="firstName"
        placeholder="Emma"
        bind:value={firstName}
        required
        disabled={isSubmitting}
      />

      <Input
        label="Nom de famille"
        name="lastName"
        placeholder="Dupont"
        bind:value={lastName}
        required
        disabled={isSubmitting}
      />

      <Input
        type="date"
        label="Date de naissance"
        name="birthDate"
        bind:value={birthDate}
        max={maxDate}
        required
        disabled={isSubmitting}
      />

      <div class="flex gap-3 pt-4">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Création...' : 'Ajouter l\'enfant'}
        </Button>
        <Button href="/app/children" variant="ghost">
          Annuler
        </Button>
      </div>
    </form>
  </Card>

  <Card padding="md" class="mt-4">
    <div class="flex items-start gap-3">
      <span class="text-warm-700 mt-0.5 shrink-0"><Lightbulb size={20} /></span>
      <div>
        <h4 class="font-medium text-warm-900 mb-1">Invitation des parents</h4>
        <p class="text-sm text-warm-700">
          Après avoir ajouté l'enfant, vous pourrez générer un code d'invitation
          pour permettre aux parents de se connecter à leur profil.
        </p>
      </div>
    </div>
  </Card>
</div>
