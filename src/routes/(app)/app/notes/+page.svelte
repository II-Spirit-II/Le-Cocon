<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { fly } from 'svelte/transition';
  import { PageHeader, Card, Button, Avatar, Select, Textarea, Badge, Input, Callout } from '$lib/ui';
  import type { ParentNoteKind, ParentNote, Child } from '$lib/types';
  import { FileText, Baby, Inbox, Calendar, Clock, Stethoscope, Backpack, MessageCircle, MessageSquare } from 'lucide-svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const isAsmmat = $derived(data.role === 'assistante');

  let showNewNoteForm = $state(false);
  let newNoteChildId = $state('');
  let newNoteKind = $state<ParentNoteKind>('autre');
  let selectedChildFilter = $state('all');
  let isSubmitting = $state(false);

  // Animation duration (respects prefers-reduced-motion)
  const getAnimDuration = () => {
    if (!browser) return 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return 250;
  };

  // TODO: realtime subscription (Phase 5)

  // Count unseen responses
  const unseenResponsesCount = $derived(
    data.notes.filter((n: ParentNote) => n.assistantRespondedAt && !n.parentSeenResponseAt).length
  );

  function hasUnseenResponse(note: typeof data.notes[0]): boolean {
    return !!note.assistantRespondedAt && !note.parentSeenResponseAt;
  }

  const kindLabels: Record<ParentNoteKind, { label: string; Icon: typeof Calendar; color: string }> = {
    absence: { label: 'Absence', Icon: Calendar, color: 'bg-bleu-100 text-bleu-700' },
    retard: { label: 'Retard', Icon: Clock, color: 'bg-sienne-100 text-sienne-700' },
    sante: { label: 'Santé', Icon: Stethoscope, color: 'bg-argile-400/15 text-argile-500' },
    logistique: { label: 'Logistique', Icon: Backpack, color: 'bg-bleu-400/15 text-bleu-500' },
    autre: { label: 'Autre', Icon: MessageCircle, color: 'bg-warm-100 text-warm-800' }
  };

  const kindOptions = Object.entries(kindLabels).map(([value, { label }]) => ({
    value,
    label
  }));

  // Reset form on success
  $effect(() => {
    if (form?.success && !form?.deleted) {
      showNewNoteForm = false;
      newNoteChildId = '';
      newNoteKind = 'autre';
    }
  });

  const childOptions = $derived([
    { value: 'all', label: 'Tous les enfants' },
    ...data.children.map((c: Child) => ({ value: c.id, label: c.firstName }))
  ]);

  const childSelectOptions = $derived(
    data.children.map((c: Child) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))
  );

  const filteredNotes = $derived(
    selectedChildFilter === 'all'
      ? data.notes
      : data.notes.filter((n: ParentNote) => n.childId === selectedChildFilter)
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

  function getNoteStatus(note: typeof data.notes[0]): { label: string; color: string } {
    if (note.assistantResponse) {
      return { label: 'Répondu', color: 'bg-mousse-400/15 text-mousse-500' };
    }
    if (note.assistantAcknowledgedAt) {
      return { label: 'Pris en compte', color: 'bg-miel-100 text-miel-700' };
    }
    return { label: 'Envoyé', color: 'bg-warm-100 text-warm-700' };
  }
</script>

<PageHeader
  title="Notes à l'assistante"
  description="Envoyez des informations importantes"
>
  {#snippet actions()}
    {#if !isAsmmat && data.children.length > 0}
      <Button variant="primary" href="/app/notes/new">
        + Envoyer une note
      </Button>
    {/if}
  {/snippet}
</PageHeader>

<!-- Redirect assistante to inbox -->
{#if isAsmmat}
  <Card padding="lg">
    <div class="text-center py-12">
      <div class="flex justify-center mb-4">
        <Inbox size={64} class="text-warm-500" />
      </div>
      <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
        Cette page est réservée aux parents
      </h3>
      <p class="text-warm-700 mb-6 max-w-md mx-auto">
        En tant qu'assistante maternelle, consultez votre boîte de réception pour voir les notes des parents.
      </p>
      <Button variant="primary" href="/app/inbox">
        Voir ma boîte de réception
      </Button>
    </div>
  </Card>
{:else}

<!-- New note form (parent only) -->
{#if showNewNoteForm && !isAsmmat}
  <div in:fly={{ y: -12, duration: getAnimDuration(), opacity: 0 }} out:fly={{ y: -12, duration: getAnimDuration(), opacity: 0 }}>
  <Card padding="md" class="mb-6">
    <h3 class="font-semibold text-warm-900 mb-4">Envoyer une note</h3>

    {#if form?.error}
      <div class="mb-4 p-3 bg-argile-400/10 border border-argile-400/20 rounded-lg text-argile-500 text-sm">
        {form.error}
      </div>
    {/if}

    <form
      method="POST"
      action="?/createNote"
      use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => {
          isSubmitting = false;
          update();
        };
      }}
      class="space-y-4"
    >
      <Select
        name="childId"
        label="Enfant concerné"
        bind:value={newNoteChildId}
        options={childSelectOptions}
        required
        disabled={isSubmitting}
      />

      <Select
        name="kind"
        label="Type de note"
        bind:value={newNoteKind}
        options={kindOptions}
        required
        disabled={isSubmitting}
      />

      <Textarea
        name="content"
        label="Message"
        placeholder="Décrivez l'information à transmettre..."
        rows={4}
        required
        disabled={isSubmitting}
        maxlength={800}
      />

      <!-- Period section -->
      <div class="border-t border-warm-100 pt-4">
        <p class="text-sm font-medium text-warm-800 mb-2">
          Période (optionnel)
        </p>
        <p class="text-xs text-warm-600 mb-3">
          Pour une absence ou des vacances, indiquez une période.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <Input
            type="date"
            name="startDate"
            label="Du"
            disabled={isSubmitting}
          />
          <Input
            type="date"
            name="endDate"
            label="Au"
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div class="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Envoi...' : 'Envoyer'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onclick={() => showNewNoteForm = false}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
      </div>
    </form>
  </Card>
  </div>
{/if}

<!-- Empty state when no children -->
{#if data.children.length === 0}
  <Card padding="lg">
    <div class="text-center py-12">
      <div class="flex justify-center mb-4">
        <Baby size={64} class="text-warm-500" />
      </div>
      <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
        Aucun enfant associé
      </h3>
      <p class="text-warm-700 mb-6 max-w-md mx-auto">
        Demandez un code d'invitation à votre assistante maternelle pour pouvoir envoyer des notes.
      </p>
      <Button variant="primary" href="/app/settings/invite">
        Utiliser un code d'invitation
      </Button>
    </div>
  </Card>
{:else}
  {#if unseenResponsesCount > 0}
    <Callout variant="cocon" class="mb-6">
      {#snippet children()}
        <div class="flex items-center gap-2">
          <MessageSquare size={18} />
          Vous avez <strong>{unseenResponsesCount}</strong> nouvelle{unseenResponsesCount > 1 ? 's' : ''} réponse{unseenResponsesCount > 1 ? 's' : ''} de votre assistante.
        </div>
      {/snippet}
    </Callout>
  {/if}

  <!-- Filters -->
  <div class="mb-6">
    <Select
      bind:value={selectedChildFilter}
      options={childOptions}
      class="max-w-xs"
    />
  </div>

  {#if filteredNotes.length === 0}
    <!-- Empty notes state -->
    <Card padding="lg">
      <div class="text-center py-12">
        <div class="flex justify-center mb-4">
          <FileText size={64} class="text-warm-500" />
        </div>
        <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
          Aucune note envoyée
        </h3>
        <p class="text-warm-700 mb-6 max-w-md mx-auto">
          Envoyez votre première note pour informer l'assistante maternelle d'une absence, d'un retard ou d'une information importante.
        </p>
        <Button variant="primary" href="/app/notes/new">
          Envoyer une note
        </Button>
      </div>
    </Card>
  {:else}
    <!-- Notes list avec animation -->
    <div class="space-y-4 animate-stagger">
      {#each filteredNotes as note (note.id)}
        {@const child = getChildForNote(note.childId)}
        {@const kindInfo = kindLabels[note.kind as ParentNoteKind]}
        {@const KindIcon = kindInfo.Icon}
        {@const status = getNoteStatus(note)}
        {@const period = formatPeriod(note.startDate, note.endDate)}
        {@const isUnseenResponse = hasUnseenResponse(note)}
        <Card padding="md" class={isUnseenResponse ? 'ring-2 ring-miel-300 ring-offset-2' : ''}>
          <div class="flex gap-4">
            <!-- Avatar enfant -->
            <Avatar name={child?.firstName ?? 'Enfant'} size="md" />

            <div class="flex-1 min-w-0">
              <!-- Header: nom enfant + badges + date -->
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <span class="font-medium text-warm-900">
                  {child?.firstName ?? 'Enfant'}
                </span>
                <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${kindInfo.color}`}>
                  <KindIcon size={12} />
                  {kindInfo.label}
                </span>
                <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
                {#if isUnseenResponse}
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-miel-500 text-white animate-pulse">
                    Réponse reçue
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

              <!-- Contenu -->
              <p class="text-warm-800 whitespace-pre-wrap wrap-break-word">
                {note.content}
              </p>

              {#if note.assistantResponse}
                {#if isUnseenResponse}
                  <div class="mt-3 flex items-center gap-3 p-3 bg-bleu-400/8 rounded-xl border border-bleu-400/20">
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold text-warm-800 mb-0.5">Reponse de l'assistante</p>
                      <p class="text-sm text-warm-700">{note.assistantResponse}</p>
                    </div>
                    <form
                      method="POST"
                      action="?/markAsSeen"
                      use:enhance={() => {
                        return async ({ update }) => { update(); };
                      }}
                      class="shrink-0"
                    >
                      <input type="hidden" name="noteId" value={note.id} />
                      <Button type="submit" variant="primary" size="sm">
                        Marquer comme lu
                      </Button>
                    </form>
                  </div>
                {:else}
                  <div class="mt-3 p-3 bg-miel-50 rounded-lg border border-miel-100">
                    <p class="text-xs font-medium text-miel-700 mb-1">Reponse de l'assistante :</p>
                    <p class="text-sm text-warm-800">{note.assistantResponse}</p>
                  </div>
                {/if}
              {/if}

              <!-- Delete button (only if not acknowledged) -->
              {#if !note.assistantAcknowledgedAt}
                <div class="mt-3 pt-3 border-t border-warm-100">
                  <form
                    method="POST"
                    action="?/deleteNote"
                    use:enhance={() => {
                      return async ({ update }) => {
                        update();
                      };
                    }}
                  >
                    <input type="hidden" name="noteId" value={note.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Supprimer
                    </Button>
                  </form>
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
