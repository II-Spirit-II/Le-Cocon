<script lang="ts">
  import { untrack } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { auth, currentUser } from '$lib/stores/auth';
  import { Card, Button, Input, Badge, Avatar, Callout, FadeIn } from '$lib/ui';
  import {
    User, Camera, Trash2, Moon, Clock, Monitor, Smartphone, Globe,
    LogOut, AlertTriangle, Shield, FileDown, ChevronRight, X, Lock
  } from 'lucide-svelte';
  import type { PageData, ActionData } from './$types';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const isAsmmat = $derived(data.user?.role === 'assistante');

  // Profile state
  let nameInput = $state('');
  const name = $derived(nameInput || data.user?.name || '');

  $effect(() => {
    if (data.user?.name && !nameInput) {
      nameInput = data.user.name;
    }
  });

  let isUploadingAvatar = $state(false);
  let isDeletingAvatar = $state(false);
  let isUpdatingProfile = $state(false);
  let isUpdatingNap = $state(false);

  let napStart = $state(untrack(() => data.defaultNapStart ?? '13:00'));
  let napEnd   = $state(untrack(() => data.defaultNapEnd   ?? '15:00'));
  let avatarPreview = $state<string | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  const currentAvatarUrl = $derived(data.avatarUrl ?? null);

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { avatarPreview = e.target?.result as string; };
      reader.readAsDataURL(file);
    }
  }

  $effect(() => {
    if (form?.success && form?.avatarPath) {
      avatarPreview = null;
      invalidateAll();
    }
  });

  let isRevokingAll = $state(false);
  let showDeleteForm = $state(false);
  let deletePassword = $state('');
  let isDeleting = $state(false);

  function guessDevice(ua: string): 'mobile' | 'desktop' | 'unknown' {
    if (!ua) return 'unknown';
    if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    auth.logout();
    goto('/');
  }
</script>

<!-- Feedback toast -->
{#if form?.success}
  <div class="fixed top-4 right-4 z-50 animate-widget">
    <Callout variant="success">{form.message ?? 'Modifications enregistrées'}</Callout>
  </div>
{/if}
{#if form?.error}
  <div class="fixed top-4 right-4 z-50 animate-widget">
    <Callout variant="warning">{form.error}</Callout>
  </div>
{/if}

<div class="settings-layout">

  <!-- ══════ LEFT: Identity card ══════ -->
  <FadeIn delay={0} class="settings-identity">
    <Card padding="none" class="overflow-hidden">
      <!-- Gradient header band -->
      <div class="h-24 relative overflow-hidden">
        <div class="absolute inset-0 bg-linear-to-br from-miel-400/40 via-sienne-400/20 to-miel-300/30"></div>
        <div class="absolute inset-0" style="background: radial-gradient(circle at 30% 50%, rgba(232,145,58,0.15), transparent 70%);"></div>
      </div>

      <!-- Avatar overlapping the header -->
      <div class="px-6 -mt-12 pb-6">
        <div class="relative group w-fit">
          {#if avatarPreview}
            <img src={avatarPreview} alt="Aperçu" class="w-24 h-24 rounded-2xl object-cover border-4 border-soie shadow-lg" />
          {:else if currentAvatarUrl}
            <img src={currentAvatarUrl} alt={data.user?.name} class="w-24 h-24 rounded-2xl object-cover border-4 border-soie shadow-lg" />
          {:else}
            <div class="border-4 border-soie rounded-2xl shadow-lg">
              <Avatar name={data.user?.name ?? ''} size="2xl" kind="adult" />
            </div>
          {/if}

          <button
            type="button"
            onclick={() => fileInput?.click()}
            class="absolute inset-0 flex items-center justify-center bg-nuit/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera size={20} class="text-soie" />
          </button>
        </div>

        <!-- Hidden file input -->
        <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp,image/gif"
          bind:this={fileInput} onchange={handleFileSelect} class="hidden" form="upload-avatar-form" />

        {#if avatarPreview}
          <form id="upload-avatar-form" method="POST" action="?/uploadAvatar" enctype="multipart/form-data"
            use:enhance={() => { isUploadingAvatar = true; return async ({ update }) => { isUploadingAvatar = false; await update(); }; }}>
            <div class="flex gap-2 mt-3">
              <Button type="submit" variant="primary" size="sm" disabled={isUploadingAvatar}>
                {isUploadingAvatar ? 'Envoi...' : 'Enregistrer'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onclick={() => { avatarPreview = null; if (fileInput) fileInput.value = ''; }}>
                Annuler
              </Button>
            </div>
          </form>
        {:else}
          <div class="flex gap-2 mt-3">
            <button type="button" onclick={() => fileInput?.click()}
              class="text-xs font-semibold text-miel-600 hover:text-miel-700 transition-colors cursor-pointer">
              Changer la photo
            </button>
            {#if data.hasCustomAvatar}
              <form method="POST" action="?/deleteAvatar" class="inline"
                use:enhance={() => { isDeletingAvatar = true; return async ({ update }) => { isDeletingAvatar = false; await update(); }; }}>
                <button type="submit" disabled={isDeletingAvatar}
                  class="text-xs font-semibold text-argile-500 hover:text-argile-400 transition-colors cursor-pointer disabled:opacity-50">
                  {isDeletingAvatar ? 'Suppression...' : 'Supprimer'}
                </button>
              </form>
            {/if}
          </div>
        {/if}

        <!-- Identity info -->
        <div class="mt-4">
          <h2 class="font-display font-bold text-xl text-warm-900">{data.user?.name}</h2>
          <p class="text-sm text-warm-500 mt-0.5">{data.user?.email}</p>
          <Badge class="mt-2" variant={isAsmmat ? 'info' : 'default'}>
            {isAsmmat ? 'Assistante maternelle' : 'Parent'}
          </Badge>
        </div>

        <!-- Quick links -->
        <div class="mt-6 pt-4 border-t border-warm-200/20 space-y-1">
          <a href="/api/data-export" download
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-warm-700 hover:bg-warm-100/40 transition-colors">
            <FileDown size={16} class="text-bleu-400" />
            Exporter mes données
            <ChevronRight size={14} class="text-warm-300 ml-auto" />
          </a>
          <a href="/legal/confidentialite"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-warm-700 hover:bg-warm-100/40 transition-colors">
            <Shield size={16} class="text-mousse-500" />
            Confidentialité
            <ChevronRight size={14} class="text-warm-300 ml-auto" />
          </a>
        </div>
      </div>
    </Card>

    <!-- App version -->
    <p class="text-center text-[11px] text-warm-400 mt-4 font-medium">Le Cocon v0.7.0</p>
  </FadeIn>

  <!-- ══════ RIGHT: Settings sections ══════ -->
  <div class="settings-sections space-y-5">

    <!-- Profile name -->
    <FadeIn delay={60}>
      <Card padding="md">
        <div class="flex items-center gap-2.5 mb-4">
          <div class="w-8 h-8 rounded-xl bg-miel-100 flex items-center justify-center">
            <User size={15} class="text-miel-600" />
          </div>
          <h3 class="font-display font-bold text-base text-warm-900">Mon profil</h3>
        </div>

        <form method="POST" action="?/updateProfile" class="space-y-4"
          use:enhance={() => { isUpdatingProfile = true; return async ({ update }) => { isUpdatingProfile = false; await update(); }; }}>
          <Input label="Nom complet" name="name" bind:value={nameInput} required minlength={2} maxlength={100} />
          <div>
            <p class="text-sm font-semibold text-warm-700 mb-1.5">Email</p>
            <div class="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-2 text-sm text-warm-500">
              <Lock size={13} class="shrink-0" />
              {data.user?.email}
            </div>
            <p class="text-[11px] text-warm-400 mt-1">L'email ne peut pas être modifié</p>
          </div>
          <Button type="submit" variant="primary" disabled={isUpdatingProfile}>
            {isUpdatingProfile ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </form>
      </Card>
    </FadeIn>

    <!-- Nap defaults (assistante only) -->
    {#if isAsmmat}
      <FadeIn delay={120}>
        <Card padding="md">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-xl bg-bleu-100 flex items-center justify-center">
              <Moon size={15} class="text-bleu-500" />
            </div>
            <div>
              <h3 class="font-display font-bold text-base text-warm-900">Sieste par défaut</h3>
              <p class="text-[11px] text-warm-400">Pré-rempli dans la saisie rapide</p>
            </div>
          </div>

          <form method="POST" action="?/updateNapDefaults" class="space-y-4"
            use:enhance={() => { isUpdatingNap = true; return async ({ update }) => { isUpdatingNap = false; await update(); }; }}>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="nap-start" class="block text-sm font-semibold text-warm-700 mb-1.5">Début</label>
                <input id="nap-start" type="time" name="default_nap_start" bind:value={napStart}
                  class="input-soie w-full" />
              </div>
              <div>
                <label for="nap-end" class="block text-sm font-semibold text-warm-700 mb-1.5">Fin</label>
                <input id="nap-end" type="time" name="default_nap_end" bind:value={napEnd}
                  class="input-soie w-full" />
              </div>
            </div>
            <Button type="submit" variant="primary" disabled={isUpdatingNap}>
              {isUpdatingNap ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </form>
        </Card>
      </FadeIn>
    {/if}

    <!-- Active sessions -->
    <FadeIn delay={180}>
      <Card padding="md">
        <div class="flex items-center gap-2.5 mb-4">
          <div class="w-8 h-8 rounded-xl bg-mousse-100 flex items-center justify-center">
            <Monitor size={15} class="text-mousse-600" />
          </div>
          <h3 class="font-display font-bold text-base text-warm-900">Appareils connectés</h3>
          <span class="text-[10px] font-bold text-warm-400 ml-auto glass-2 px-2 py-0.5 rounded-lg">
            {data.activeSessions.length}
          </span>
        </div>

        <div class="space-y-2">
          {#each data.activeSessions as session}
            {@const device = guessDevice(session.userAgent)}
            <div class="flex items-center gap-3 p-3 rounded-xl transition-colors
              {session.isCurrent ? 'glass-2 ring-1 ring-miel-400/20' : 'hover:bg-warm-100/20'}">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                {session.isCurrent ? 'bg-miel-100' : 'bg-warm-100/50'}">
                {#if device === 'mobile'}
                  <Smartphone size={16} class={session.isCurrent ? 'text-miel-600' : 'text-warm-500'} />
                {:else if device === 'desktop'}
                  <Monitor size={16} class={session.isCurrent ? 'text-miel-600' : 'text-warm-500'} />
                {:else}
                  <Globe size={16} class={session.isCurrent ? 'text-miel-600' : 'text-warm-500'} />
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-warm-800">
                  {session.isCurrent ? 'Cet appareil' : device === 'mobile' ? 'Mobile' : device === 'desktop' ? 'Ordinateur' : 'Appareil'}
                </p>
                <p class="text-[11px] text-warm-400">{relativeTime(session.createdAt)}</p>
              </div>
              {#if session.isCurrent}
                <span class="text-[10px] font-bold text-mousse-600 bg-mousse-100 px-2 py-0.5 rounded-lg">Actif</span>
              {/if}
            </div>
          {:else}
            <p class="text-sm text-warm-400 text-center py-3">Aucune session active</p>
          {/each}
        </div>

        {#if data.activeSessions.length > 1}
          <form method="POST" action="?/revokeAllSessions" class="mt-3"
            use:enhance={() => { isRevokingAll = true; return async ({ update }) => { isRevokingAll = false; await update(); }; }}>
            <button type="submit" disabled={isRevokingAll}
              class="w-full text-center text-xs font-semibold text-sienne-600 hover:text-sienne-700 py-2 transition-colors cursor-pointer disabled:opacity-50">
              {isRevokingAll ? 'Déconnexion...' : 'Déconnecter les autres appareils'}
            </button>
          </form>
        {/if}
      </Card>
    </FadeIn>

    <!-- Danger zone -->
    <FadeIn delay={240}>
      <div class="rounded-3xl overflow-hidden" style="background: rgba(194,99,90,0.04); border: 1px solid rgba(194,99,90,0.1);">
        <div class="p-5">
          <div class="flex items-center gap-2.5 mb-4">
            <div class="w-8 h-8 rounded-xl bg-argile-400/10 flex items-center justify-center">
              <AlertTriangle size={15} class="text-argile-500" />
            </div>
            <h3 class="font-display font-bold text-base text-argile-500">Zone sensible</h3>
          </div>

          <!-- Logout -->
          <div class="flex items-center justify-between p-3.5 rounded-xl glass-2 mb-3">
            <div class="flex items-center gap-3">
              <LogOut size={16} class="text-warm-500" />
              <div>
                <p class="text-sm font-semibold text-warm-800">Se déconnecter</p>
                <p class="text-[11px] text-warm-400">Fermer cette session</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onclick={handleLogout}>
              Déconnexion
            </Button>
          </div>

          <!-- Delete account -->
          <div class="p-3.5 rounded-xl glass-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Trash2 size={16} class="text-argile-500" />
                <div>
                  <p class="text-sm font-semibold text-argile-500">Supprimer le compte</p>
                  <p class="text-[11px] text-warm-400">Irréversible, toutes les données seront supprimées</p>
                </div>
              </div>
              {#if !showDeleteForm}
                <Button variant="danger" size="sm" onclick={() => showDeleteForm = true}>
                  Supprimer
                </Button>
              {/if}
            </div>

            {#if showDeleteForm}
              <div class="mt-4 pt-4 border-t border-argile-400/15">
                <form method="POST" action="?/deleteAccount" class="space-y-3"
                  use:enhance={() => { isDeleting = true; return async ({ update, result }) => { isDeleting = false; if (result.type === 'redirect') { auth.logout(); return; } await update(); }; }}>
                  <input type="password" name="password" placeholder="Confirmez votre mot de passe"
                    bind:value={deletePassword} required
                    class="input-soie w-full !border-argile-400/20 focus-visible:!border-argile-400 focus-visible:!ring-argile-400/20" />
                  <div class="flex gap-2">
                    <Button type="submit" variant="danger" disabled={isDeleting || !deletePassword}>
                      {isDeleting ? 'Suppression...' : 'Confirmer la suppression'}
                    </Button>
                    <Button type="button" variant="ghost" onclick={() => { showDeleteForm = false; deletePassword = ''; }}>
                      Annuler
                    </Button>
                  </div>
                </form>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </FadeIn>

  </div>
</div>

<style>
  .settings-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Time inputs matching design system */
  .input-soie {
    display: block;
    border-radius: 0.75rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    color: var(--color-warm-900);
    background: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.25);
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input-soie:focus {
    border-color: rgba(232, 145, 58, 0.5);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.12);
  }

  @media (min-width: 768px) {
    .settings-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      align-items: start;
    }

    .settings-layout :global(.settings-identity) {
      position: sticky;
      top: 2rem;
    }
  }

  @media (min-width: 1024px) {
    .settings-layout {
      grid-template-columns: 320px 1fr;
    }
  }
</style>
