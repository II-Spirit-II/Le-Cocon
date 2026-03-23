<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { fly } from 'svelte/transition';
  import { PageHeader, Card, Button, Avatar, Select, Textarea, ConfirmDialog } from '$lib/ui';
  import type { News, Child } from '$lib/types';
  import { Newspaper, Camera, Sparkles } from 'lucide-svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const isAsmmat = $derived(data.role === 'assistante');

  let showNewNewsForm = $state(false);
  let newNewsChildId = $state('');
  let newNewsEmoji = $state('');
  let selectedChildFilter = $state('all');
  let isSubmitting = $state(false);
  let newNewsIndicator = $state(false);
  let attachmentPreview = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  // Edit state
  let editingNewsId = $state<string | null>(null);
  let editingContent = $state('');
  let editingEmoji = $state('');
  let editingRemoveAttachment = $state(false);

  // Delete confirmation state
  let deleteConfirmOpen = $state(false);
  let newsToDelete = $state<(News & { attachmentUrl?: string | null }) | null>(null);
  let isDeleting = $state(false);

  const emojis = ['😊', '😴', '🍝', '🎨', '🛝', '📖', '🎵', '🧩', '🥣', '💪'];

  // Animation duration (respects prefers-reduced-motion)
  const getAnimDuration = () => {
    if (!browser) return 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return 250;
  };

  // TODO: realtime subscription (Phase 5)

  // Reset form on success
  $effect(() => {
    if (form?.success) {
      showNewNewsForm = false;
      newNewsChildId = '';
      newNewsEmoji = '';
      attachmentPreview = null;
      // Reset edit state after successful update
      editingNewsId = null;
      editingContent = '';
      editingEmoji = '';
      editingRemoveAttachment = false;
    }
  });

  // Start editing a news
  function startEditing(news: News & { attachmentUrl?: string | null }) {
    editingNewsId = news.id;
    editingContent = news.content;
    editingEmoji = news.emoji ?? '';
    editingRemoveAttachment = false;
  }

  // Cancel editing
  function cancelEditing() {
    editingNewsId = null;
    editingContent = '';
    editingEmoji = '';
    editingRemoveAttachment = false;
  }

  // Open delete confirmation
  function openDeleteConfirm(news: News & { attachmentUrl?: string | null }) {
    newsToDelete = news;
    deleteConfirmOpen = true;
  }

  // Close delete confirmation
  function closeDeleteConfirm() {
    deleteConfirmOpen = false;
    newsToDelete = null;
  }

  // TODO: realtime subscription (Phase 5)

  $effect(() => {
    if (newNewsIndicator) {
      const timer = setTimeout(() => {
        newNewsIndicator = false;
      }, 5000);
      return () => clearTimeout(timer);
    }
  });

  const childOptions = $derived([
    { value: 'all', label: 'Tous les enfants' },
    ...data.children.map((c: Child) => ({ value: c.id, label: c.firstName }))
  ]);

  const filteredNews = $derived(
    selectedChildFilter === 'all'
      ? data.news
      : data.news.filter((n: { childId: string }) => n.childId === selectedChildFilter)
  );

  function getChildForNews(childId: string) {
    return data.children.find((c: Child) => c.id === childId);
  }

  function formatNewsDate(dateString: string): string {
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

  function handleAttachmentSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        attachmentPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  function removeAttachment() {
    attachmentPreview = null;
    if (fileInput) fileInput.value = '';
  }

  function openFilePicker() {
    fileInput?.click();
  }
</script>

<PageHeader
  title="News"
  description="Suivez le quotidien des enfants"
>
  {#snippet actions()}
    {#if isAsmmat && data.children.length > 0}
      <Button variant="primary" onclick={() => showNewNewsForm = true}>
        + Nouvelle news
      </Button>
    {/if}
  {/snippet}
</PageHeader>

<!-- New news form (assistante only) -->
{#if showNewNewsForm && isAsmmat}
  <div in:fly={{ y: -12, duration: getAnimDuration(), opacity: 0 }} out:fly={{ y: -12, duration: getAnimDuration(), opacity: 0 }}>
  <Card padding="md" class="mb-6">
    <h3 class="font-semibold text-warm-900 mb-4">Publier une news</h3>

    {#if form?.error}
      <div class="mb-4 p-3 bg-argile-400/10 border border-argile-400/20 rounded-lg text-argile-500 text-sm">
        {form.error}
      </div>
    {/if}

    <form
      method="POST"
      action="?/createNews"
      enctype="multipart/form-data"
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
        bind:value={newNewsChildId}
        options={data.children.map((c: Child) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
        required
        disabled={isSubmitting}
      />

      <Textarea
        name="content"
        label="Message"
        placeholder="Que se passe-t-il ?"
        rows={3}
        required
        disabled={isSubmitting}
        maxlength={500}
      />

      <input type="hidden" name="emoji" value={newNewsEmoji} />

      <div>
        <p class="block text-sm font-medium text-warm-800 mb-2">Emoji (optionnel)</p>
        <div class="flex flex-wrap gap-2" role="group" aria-label="Sélection d'emoji">
          {#each emojis as emoji}
            <button
              type="button"
              onclick={() => newNewsEmoji = newNewsEmoji === emoji ? '' : emoji}
              disabled={isSubmitting}
              class="w-10 h-10 rounded-lg text-xl transition-colors
                {newNewsEmoji === emoji
                  ? 'bg-miel-100 ring-2 ring-miel-500'
                  : 'bg-warm-100 hover:bg-warm-200'}
                {isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}"
            >
              {emoji}
            </button>
          {/each}
        </div>
      </div>

      <!-- Attachment upload -->
      <div>
        <p class="block text-sm font-medium text-warm-800 mb-2">Photo (optionnel)</p>
        <input
          type="file"
          name="attachment"
          accept="image/jpeg,image/png,image/webp,image/gif"
          bind:this={fileInput}
          onchange={handleAttachmentSelect}
          class="hidden"
        />

        {#if attachmentPreview}
          <div class="relative inline-block">
            <img
              src={attachmentPreview}
              alt="Preview"
              class="max-w-xs max-h-48 rounded-lg object-cover border border-warm-200"
            />
            <button
              type="button"
              onclick={removeAttachment}
              class="absolute -top-2 -right-2 w-6 h-6 bg-argile-400 text-white rounded-full flex items-center justify-center text-sm hover:bg-argile-500 transition-colors"
            >
              ✕
            </button>
          </div>
        {:else}
          <button
            type="button"
            onclick={openFilePicker}
            disabled={isSubmitting}
            class="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-warm-300 text-warm-700 hover:border-miel-400 hover:text-miel-600 transition-colors
              {isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}"
          >
            <Camera size={18} />
            <span class="text-sm">Ajouter une photo</span>
          </button>
        {/if}
      </div>

      <div class="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Publication...' : 'Publier'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onclick={() => { showNewNewsForm = false; attachmentPreview = null; }}
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
        <Newspaper size={64} class="text-warm-500" />
      </div>
      {#if isAsmmat}
        <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
          Commencez par ajouter des enfants
        </h3>
        <p class="text-warm-700 mb-6 max-w-md mx-auto">
          Pour publier des news, vous devez d'abord ajouter les enfants dont vous avez la garde.
        </p>
        <Button variant="primary" href="/app/children/add">
          Ajouter un enfant
        </Button>
      {:else}
        <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
          Aucun enfant associé
        </h3>
        <p class="text-warm-700 mb-6 max-w-md mx-auto">
          Demandez un code d'invitation à votre assistante maternelle pour voir les news de vos enfants.
        </p>
        <Button variant="primary" href="/app/settings/invite">
          Utiliser un code d'invitation
        </Button>
      {/if}
    </div>
  </Card>
{:else}
  <!-- Filters -->
  <div class="mb-6">
    <Select
      bind:value={selectedChildFilter}
      options={childOptions}
      class="max-w-xs"
    />
  </div>

  {#if filteredNews.length === 0}
    <!-- Empty news state -->
    <Card padding="lg">
      <div class="text-center py-12">
        <div class="flex justify-center mb-4">
          <Newspaper size={64} class="text-warm-500" />
        </div>
        <h3 class="text-xl font-display font-bold text-warm-900 mb-2">
          Aucune news pour le moment
        </h3>
        <p class="text-warm-700 mb-6 max-w-md mx-auto">
          {#if isAsmmat}
            Publiez votre première news pour partager le quotidien des enfants avec leurs parents.
          {:else}
            Les news apparaîtront ici dès que votre assistante maternelle en publiera.
          {/if}
        </p>
        {#if isAsmmat}
          <Button variant="primary" onclick={() => showNewNewsForm = true}>
            Publier une news
          </Button>
        {/if}
      </div>
    </Card>
  {:else}
    <!-- News feed avec animation -->
    <div class="space-y-4 animate-stagger">
      {#each filteredNews as news (news.id)}
        {@const child = getChildForNews(news.childId)}
        {@const isEditing = editingNewsId === news.id}
        <Card padding="md">
          {#if isEditing}
            <!-- Edit mode -->
            <form
              method="POST"
              action="?/updateNews"
              use:enhance={() => {
                isSubmitting = true;
                return async ({ update }) => {
                  isSubmitting = false;
                  update();
                };
              }}
              class="space-y-4"
            >
              <input type="hidden" name="newsId" value={news.id} />
              <input type="hidden" name="emoji" value={editingEmoji} />
              <input type="hidden" name="removeAttachment" value={editingRemoveAttachment} />

              <Textarea
                name="content"
                bind:value={editingContent}
                rows={3}
                required
                disabled={isSubmitting}
                maxlength={500}
              />

              <!-- Emoji picker -->
              <div>
                <p class="block text-sm font-medium text-warm-800 mb-2">Emoji</p>
                <div class="flex flex-wrap gap-2">
                  {#each emojis as emoji}
                    <button
                      type="button"
                      onclick={() => editingEmoji = editingEmoji === emoji ? '' : emoji}
                      disabled={isSubmitting}
                      class="w-8 h-8 rounded-lg text-lg transition-colors
                        {editingEmoji === emoji
                          ? 'bg-miel-100 ring-2 ring-miel-500'
                          : 'bg-warm-100 hover:bg-warm-200'}
                        {isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}"
                    >
                      {emoji}
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Attachment management -->
              {#if news.attachmentUrl && !editingRemoveAttachment}
                <div class="flex items-center gap-3">
                  <img src={news.attachmentUrl} alt="" loading="lazy" decoding="async" class="w-16 h-16 object-cover rounded-lg" />
                  <button
                    type="button"
                    onclick={() => editingRemoveAttachment = true}
                    class="text-sm text-argile-500 hover:text-argile-500"
                  >
                    Retirer l'image
                  </button>
                </div>
              {/if}
              {#if editingRemoveAttachment && news.attachmentUrl}
                <p class="text-sm text-warm-600 italic">L'image sera supprimée lors de la sauvegarde.</p>
              {/if}

              <div class="flex gap-2">
                <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onclick={cancelEditing} disabled={isSubmitting}>
                  Annuler
                </Button>
              </div>
            </form>
          {:else}
            <!-- View mode -->
            <div class="flex gap-4">
              <!-- Avatar enfant -->
              <Avatar name={child?.firstName ?? 'Enfant'} size="md" />

              <div class="flex-1 min-w-0">
                <!-- Header: nom enfant + date + actions -->
                <div class="flex items-start justify-between gap-2 mb-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-warm-900">
                      {child?.firstName ?? 'Enfant'}
                    </span>
                    <span class="text-warm-600">·</span>
                    <span class="text-sm text-warm-600">
                      {formatNewsDate(news.createdAt)}
                    </span>
                  </div>

                  <!-- Actions menu (assistante only) -->
                  {#if isAsmmat}
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        onclick={() => startEditing(news)}
                        class="p-1.5 rounded-lg text-warm-600 hover:text-warm-700 hover:bg-warm-100 transition-colors"
                        title="Modifier"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onclick={() => openDeleteConfirm(news)}
                        class="p-1.5 rounded-lg text-warm-600 hover:text-argile-500 hover:bg-argile-400/10 transition-colors"
                        title="Supprimer"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  {/if}
                </div>

                <!-- Contenu -->
                <p class="text-warm-800 whitespace-pre-wrap break-words">
                  {#if news.emoji}
                    <span class="text-xl mr-2">{news.emoji}</span>
                  {/if}
                  {news.content}
                </p>

                <!-- Attachment image -->
                {#if news.attachmentUrl}
                  {@const attachmentUrl = news.attachmentUrl}
                  <div class="mt-3">
                    <button
                      type="button"
                      onclick={() => window.open(attachmentUrl, '_blank')}
                      class="block rounded-lg overflow-hidden hover:opacity-90 transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-miel-500 focus-visible:ring-offset-2 focus-visible:ring-offset-soie"
                      aria-label="Ouvrir la photo en plein écran"
                    >
                      <img
                        src={attachmentUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        class="max-w-full max-h-96 object-cover"
                      />
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </Card>
      {/each}
    </div>
  {/if}
{/if}

<!-- New news indicator toast (parents only, assistante sees her own posts) -->
{#if newNewsIndicator && !isAsmmat}
  <div class="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
    <div class="flex items-center gap-2 bg-miel-500 text-white px-4 py-2 rounded-full shadow-lg">
      <Sparkles size={18} />
      <span class="text-sm font-medium">Nouvelle news !</span>
    </div>
  </div>
{/if}


<!-- Delete confirmation dialog -->
<ConfirmDialog
  open={deleteConfirmOpen}
  title="Supprimer cette news ?"
  description="Cette action est définitive. La news et son image associée seront supprimées."
  confirmLabel="Supprimer"
  cancelLabel="Annuler"
  variant="danger"
  loading={isDeleting}
  oncancel={closeDeleteConfirm}
  onconfirm={() => {
    if (newsToDelete) {
      isDeleting = true;
      const form = document.getElementById('delete-news-form') as HTMLFormElement;
      const input = form.querySelector('input[name="newsId"]') as HTMLInputElement;
      input.value = newsToDelete.id;
      form.requestSubmit();
    }
  }}
/>

<!-- Hidden delete form -->
<form
  id="delete-news-form"
  method="POST"
  action="?/deleteNews"
  class="hidden"
  use:enhance={() => {
    return async ({ update }) => {
      isDeleting = false;
      closeDeleteConfirm();
      update();
    };
  }}
>
  <input type="hidden" name="newsId" value="" />
</form>
