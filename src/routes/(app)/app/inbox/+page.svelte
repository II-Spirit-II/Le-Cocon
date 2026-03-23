<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { PageHeader, Card, Button, Avatar, Select, Textarea, Badge, Callout } from '$lib/ui';
  import type { ParentNoteKind, ParentNote, Child } from '$lib/types';
  import { FileText, Baby, Inbox, Calendar, Clock, Stethoscope, Backpack, MessageCircle } from 'lucide-svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const isAsmmat = $derived(data.role === 'assistante');

  let selectedChildFilter = $state('all');
  let showOnlyOpen = $state(true);
  let respondingToNote = $state<string | null>(null);
  let responseText = $state('');
  let isSubmitting = $state(false);
  let newNoteIndicator = $state(false);

  // TODO: realtime subscription (Phase 5)

  // Hide indicator after a few seconds
  $effect(() => {
    if (newNoteIndicator) {
      const timer = setTimeout(() => {
        newNoteIndicator = false;
      }, 5000);
      return () => clearTimeout(timer);
    }
  });

  const kindLabels: Record<ParentNoteKind, { label: string; Icon: typeof Calendar; color: string }> = {
    absence: { label: 'Absence', Icon: Calendar, color: 'bg-sienne-400/15 text-sienne-600' },
    retard: { label: 'Retard', Icon: Clock, color: 'bg-soleil-400/15 text-soleil-700' },
    sante: { label: 'Santé', Icon: Stethoscope, color: 'bg-argile-400/15 text-argile-500' },
    logistique: { label: 'Logistique', Icon: Backpack, color: 'bg-bleu-400/15 text-bleu-500' },
    autre: { label: 'Autre', Icon: MessageCircle, color: 'bg-warm-100 text-warm-800' }
  };

  // Reset response form on success
  $effect(() => {
    if (form?.responded) {
      respondingToNote = null;
      responseText = '';
    }
  });

  const childOptions = $derived([
    { value: 'all', label: 'Tous les enfants' },
    ...data.children.map((c: Child) => ({ value: c.id, label: c.firstName }))
  ]);

  const filteredNotes = $derived(() => {
    let notes = data.notes;

    if (selectedChildFilter !== 'all') {
      notes = notes.filter((n: ParentNote) => n.childId === selectedChildFilter);
    }

    if (showOnlyOpen) {
      notes = notes.filter((n: ParentNote) => !n.assistantAcknowledgedAt);
    }

    return notes;
  });

  const unacknowledgedCount = $derived(
    data.notes.filter((n: ParentNote) => !n.assistantAcknowledgedAt).length
  );

  function getChildForNote(childId: string) {
    return data.children.find((c: Child) => c.id === childId);
  }

  function formatNoteDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "A l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;

    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  }

  function formatPeriod(startDate: string | null, endDate: string | null): string | null {
    if (!startDate) return null;

    const start = new Date(startDate);
    const startStr = start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    if (!endDate) return startStr;

    const end = new Date(endDate);
    const endStr = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    return `${startStr} - ${endStr}`;
  }

  function startResponding(noteId: string) {
    respondingToNote = noteId;
    responseText = '';
  }

  function cancelResponding() {
    respondingToNote = null;
    responseText = '';
  }
</script>

<PageHeader
  title="Boîte de réception"
  description="Notes des parents"
>
  {#snippet actions()}
    {#if unacknowledgedCount > 0}
      <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-miel-100 text-miel-700">
        {unacknowledgedCount} non traitée{unacknowledgedCount > 1 ? 's' : ''}
      </span>
    {/if}
  {/snippet}
</PageHeader>

<!-- Redirect parent to notes -->
{#if !isAsmmat}
  <Card padding="lg">
    <div class="text-center py-12">
      <div class="flex justify-center mb-4">
        <FileText size={64} class="text-warm-500" />
      </div>
      <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
        Cette page est réservée aux assistantes maternelles
      </h3>
      <p class="text-warm-700 mb-6 max-w-md mx-auto">
        En tant que parent, vous pouvez envoyer et consulter vos notes depuis votre espace.
      </p>
      <Button variant="primary" href="/app/notes">
        Voir mes notes
      </Button>
    </div>
  </Card>
{:else}

<!-- Empty state when no children -->
{#if data.children.length === 0}
  <Card padding="lg">
    <div class="text-center py-12">
      <div class="flex justify-center mb-4">
        <Baby size={64} class="text-warm-500" />
      </div>
      <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
        Aucun enfant enregistré
      </h3>
      <p class="text-warm-700 mb-6 max-w-md mx-auto">
        Ajoutez des enfants pour recevoir les notes des parents.
      </p>
      <Button variant="primary" href="/app/children/add">
        Ajouter un enfant
      </Button>
    </div>
  </Card>
{:else}
  {#if unacknowledgedCount > 0 && !showOnlyOpen}
    <Callout variant="cocon" class="mb-6">
      {#snippet children()}
        <div class="flex items-center gap-2">
          <Inbox size={18} />
          Vous avez <strong>{unacknowledgedCount}</strong> note{unacknowledgedCount > 1 ? 's' : ''} à traiter.
        </div>
      {/snippet}
      {#snippet actions()}
        <Button variant="ghost" size="sm" onclick={() => showOnlyOpen = true}>
          Voir les notes à traiter
        </Button>
      {/snippet}
    </Callout>
  {/if}

  <!-- Filters -->
  <div class="mb-6 flex flex-wrap items-center gap-4">
    <Select
      bind:value={selectedChildFilter}
      options={childOptions}
      class="max-w-xs"
    />
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        bind:checked={showOnlyOpen}
        class="w-4 h-4 text-miel-600 border-warm-300 rounded focus-visible:ring-miel-500"
      />
      <span class="text-sm text-warm-800">Uniquement non traitées</span>
    </label>
  </div>

  {#if form?.error}
    <div class="mb-4 p-3 bg-argile-400/10 border border-argile-400/20 rounded-lg text-argile-500 text-sm">
      {form.error}
    </div>
  {/if}

  {#if filteredNotes().length === 0}
    <!-- Empty state -->
    <Card padding="lg">
      <div class="text-center py-12">
        <div class="flex justify-center mb-4">
          <Inbox size={64} class="text-warm-500" />
        </div>
        <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
          {showOnlyOpen ? 'Aucune note à traiter' : 'Aucune note reçue'}
        </h3>
        <p class="text-warm-700 max-w-md mx-auto">
          {#if showOnlyOpen}
            Toutes les notes ont été traitées. Bravo !
          {:else}
            Les notes des parents apparaîtront ici lorsqu'ils en enverront.
          {/if}
        </p>
        {#if showOnlyOpen && data.notes.length > 0}
          <Button variant="ghost" class="mt-4" onclick={() => showOnlyOpen = false}>
            Voir toutes les notes
          </Button>
        {/if}
      </div>
    </Card>
  {:else}
    <!-- Notes list avec animation -->
    <div class="space-y-4 animate-stagger">
      {#each filteredNotes() as note (note.id)}
        {@const child = getChildForNote(note.childId)}
        {@const kindInfo = kindLabels[note.kind as ParentNoteKind]}
        {@const KindIcon = kindInfo.Icon}
        {@const period = formatPeriod(note.startDate, note.endDate)}
        {@const isOpen = !note.assistantAcknowledgedAt}
        <Card padding="md" class={isOpen ? 'border-l-4 border-l-miel-500' : ''}>
          <div class="flex gap-4">
            <!-- Avatar enfant -->
            <Avatar name={child?.firstName ?? 'Enfant'} size="md" />

            <div class="flex-1 min-w-0">
              <!-- Header -->
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <span class="font-medium text-warm-900">
                  {child?.firstName ?? 'Enfant'}
                </span>
                <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${kindInfo.color}`}>
                  <KindIcon size={12} />
                  {kindInfo.label}
                </span>
                {#if isOpen}
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-miel-100 text-miel-700">
                    Nouveau
                  </span>
                {:else}
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-mousse-400/15 text-mousse-500">
                    Traité
                  </span>
                {/if}
                <span class="text-sm text-warm-600 ml-auto">
                  {formatNoteDate(note.createdAt)}
                </span>
              </div>

              {#if period}
                <div class="mb-2 text-sm text-warm-700">
                  <span class="font-medium">Période :</span> {period}
                </div>
              {/if}

              <p class="text-warm-800 whitespace-pre-wrap break-words">
                {note.content}
              </p>

              {#if note.assistantResponse}
                <div class="mt-3 p-3 bg-miel-50 rounded-lg border border-miel-100">
                  <p class="text-xs font-medium text-miel-700 mb-1">
                    Votre réponse :
                  </p>
                  <p class="text-sm text-warm-800">
                    {note.assistantResponse}
                  </p>
                </div>
              {/if}

              <!-- Actions -->
              {#if isOpen}
                <div class="mt-4 pt-3 border-t border-warm-100">
                  {#if respondingToNote === note.id}
                    <!-- Response form -->
                    <form
                      method="POST"
                      action="?/respond"
                      use:enhance={() => {
                        isSubmitting = true;
                        return async ({ update }) => {
                          isSubmitting = false;
                          update();
                        };
                      }}
                      class="space-y-3"
                    >
                      <input type="hidden" name="noteId" value={note.id} />
                      <Textarea
                        name="response"
                        bind:value={responseText}
                        placeholder="Votre réponse (optionnelle, max 500 car.)..."
                        rows={2}
                        maxlength={500}
                        disabled={isSubmitting}
                      />
                      <div class="flex gap-2">
                        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting || !responseText.trim()}>
                          {isSubmitting ? 'Envoi...' : 'Envoyer la réponse'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onclick={cancelResponding} disabled={isSubmitting}>
                          Annuler
                        </Button>
                      </div>
                    </form>
                  {:else}
                    <!-- Action buttons -->
                    <div class="flex flex-wrap gap-2">
                      <form
                        method="POST"
                        action="?/acknowledge"
                        use:enhance={() => {
                          isSubmitting = true;
                          return async ({ update }) => {
                            isSubmitting = false;
                            update();
                          };
                        }}
                      >
                        <input type="hidden" name="noteId" value={note.id} />
                        <Button type="submit" variant="secondary" size="sm" disabled={isSubmitting}>
                          Pris en compte
                        </Button>
                      </form>
                      <Button variant="primary" size="sm" onclick={() => startResponding(note.id)}>
                        Répondre
                      </Button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </Card>
      {/each}
    </div>
  {/if}
{/if}
{/if}

<!-- New note indicator toast -->
{#if newNoteIndicator}
  <div class="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
    <div class="flex items-center gap-2 bg-miel-500 text-white px-4 py-2 rounded-full shadow-lg">
      <Inbox size={18} />
      <span class="text-sm font-medium">Nouvelle note reçue !</span>
    </div>
  </div>
{/if}
