<script lang="ts">
  import { browser } from '$app/environment';
  import { enhance, applyAction } from '$app/forms';
  import { fly, scale } from 'svelte/transition';
  import { Button, Input, Card } from '$lib/ui';
  import { DURATION } from '$lib/ui/motion';
  import { getAdultAvatarUrl } from '$lib/utils/avatar';
  import type { UserRole } from '$lib/types';
  import { Users, GraduationCap, RefreshCw } from 'lucide-svelte';
  import type { ActionData } from './$types';

  interface Props {
    form: ActionData;
  }

  let { form }: Props = $props();

  let step = $state(1);
  let selectedRole = $state<UserRole | null>(null);
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let passwordConfirm = $state('');
  let isLoading = $state(false);
  let avatarSeed = $state(0);
  let isSpinning = $state(false);

  // Dynamic height — measure active step content
  let stepEls: Record<number, HTMLDivElement | undefined> = $state({});
  let containerHeight = $state(0);

  function measureStep() {
    const el = stepEls[step];
    if (el) containerHeight = el.scrollHeight;
  }

  $effect(() => {
    // Re-measure whenever step changes
    step;
    // Wait a tick for transitions to start and DOM to update
    if (browser) requestAnimationFrame(measureStep);
  });

  // Transition direction tracking
  let direction = $state<'forward' | 'backward'>('forward');

  const getDuration = () => {
    if (!browser) return 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return DURATION.page;
  };

  function selectRole(role: UserRole) {
    direction = 'forward';
    selectedRole = role;
    step = 2;
  }

  const passwordsMatch = $derived(password === passwordConfirm && password.length >= 8);

  function goToAvatar() {
    if (!name.trim() || !email.trim() || !passwordsMatch) return;
    direction = 'forward';
    step = 3;
  }

  function goBack() {
    direction = 'backward';
    if (step === 3) step = 2;
    else step = 1;
  }

  function refreshAvatar() {
    avatarSeed++;
    isSpinning = true;
    setTimeout(() => { isSpinning = false; }, 500);
  }

  const avatarUrl = $derived(getAdultAvatarUrl(name.trim() + (avatarSeed > 0 ? ` ${avatarSeed}` : '')));

  $effect(() => {
    if (form?.email) email = form.email as string;
    if (form?.name) name = form.name as string;
  });
</script>

<div class="min-h-screen bg-aube flex items-center justify-center p-4 relative overflow-hidden">
  <!-- Decorative orbs -->
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>

  <div class="w-full max-w-lg relative z-10">
    <!-- Logo -->
    <div class="text-center mb-8">
      <a href="/" class="inline-flex items-center gap-2">
        <img src="/favicon.png" alt="Le Cocon" class="w-10 h-10" />
        <span class="font-display font-bold text-2xl text-warm-900">Le Cocon</span>
      </a>
    </div>

    <!-- Progress -->
    <div class="flex items-center justify-center gap-2 mb-8">
        {#each [1, 2, 3] as s}
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors duration-200
            {step >= s ? 'bg-miel-500 text-white' : 'bg-warm-200/60 text-warm-600 ring-2 ring-warm-300'}">
            {s}
          </div>
          {#if s < 3}
            <div class="w-8 h-1 rounded transition-colors duration-300 {step > s ? 'bg-miel-500' : 'bg-warm-200'}"></div>
          {/if}
        {/each}
      </div>

    <Card padding="lg">
      <div
        class="relative overflow-hidden transition-[height] duration-500 min-h-[480px]"
        style="height: {containerHeight ? containerHeight + 'px' : 'auto'}; --ease-silk: cubic-bezier(0.22, 1, 0.36, 1);"
        style:transition-timing-function="var(--ease-silk)"
      >
        {#if step === 1}
          <div
            bind:this={stepEls[1]}
            class="absolute inset-x-0 top-0 flex flex-col px-1"
            in:fly={{ x: direction === 'backward' ? -20 : 0, duration: getDuration(), opacity: 0 }}
            out:fly={{ x: -20, duration: getDuration(), opacity: 0 }}
          >
            <h1 class="text-2xl font-display font-bold text-warm-900 text-center mb-2">
              Bienvenue sur Le Cocon
            </h1>
            <p class="text-warm-600 text-center mb-8">
              Quel est votre rôle ?
            </p>

            <div class="grid gap-4 flex-1">
              <button
                type="button"
                onclick={() => selectRole('parent')}
                class="p-6 rounded-3xl glass-2 hover:shadow-[0_8px_24px_rgba(194,101,58,0.12)] hover:bg-[rgba(255,248,238,0.6)] active:scale-[0.98] transition-[box-shadow,background-color,transform] duration-300 ease-out text-left group h-fit"
              >
                <div class="flex items-start gap-4">
                  <div class="text-miel-500 shrink-0 transition-transform duration-300 ease-out group-hover:scale-110"><Users size={32} /></div>
                  <div>
                    <h3 class="font-display font-bold text-lg text-warm-900 group-hover:text-miel-600 transition-colors duration-300">
                      Je suis parent
                    </h3>
                    <p class="text-warm-600 mt-1">
                      Suivez le quotidien de votre enfant chez son assistante maternelle
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onclick={() => selectRole('assistante')}
                class="p-6 rounded-3xl glass-2 hover:shadow-[0_8px_24px_rgba(194,101,58,0.12)] hover:bg-[rgba(255,248,238,0.6)] active:scale-[0.98] transition-[box-shadow,background-color,transform] duration-300 ease-out text-left group h-fit"
              >
                <div class="flex items-start gap-4">
                  <div class="text-miel-500 shrink-0 transition-transform duration-300 ease-out group-hover:scale-110"><GraduationCap size={32} /></div>
                  <div>
                    <h3 class="font-display font-bold text-lg text-warm-900 group-hover:text-miel-600 transition-colors duration-300">
                      Je suis assistante maternelle
                    </h3>
                    <p class="text-warm-600 mt-1">
                      Partagez le quotidien des enfants avec leurs parents
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

        {:else if step === 2}
          <div
            bind:this={stepEls[2]}
            class="absolute inset-x-0 top-0 flex flex-col px-1"
            in:fly={{ x: direction === 'forward' ? 20 : -20, duration: getDuration(), opacity: 0 }}
            out:fly={{ x: direction === 'forward' ? -20 : 20, duration: getDuration(), opacity: 0 }}
          >
            <div class="flex items-center justify-between mb-4">
              <button
                type="button"
                onclick={goBack}
                class="text-sm text-warm-500 hover:text-warm-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                ← Retour
              </button>
              <span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-miel-100 text-miel-700 font-medium">
                {#if selectedRole === 'parent'}
                  <Users size={12} /> Parent
                {:else}
                  <GraduationCap size={12} /> Assistante
                {/if}
              </span>
            </div>

            <h1 class="text-2xl font-display font-bold text-warm-900 text-center mb-2">
              Vos informations
            </h1>
            <p class="text-warm-600 text-center mb-6">
              {selectedRole === 'parent' ? 'En tant que parent' : 'En tant qu\'assistante maternelle'}
            </p>

            {#if form?.error}
              <div
                class="mb-4 p-3 bg-argile-400/10 border border-argile-400/20 rounded-xl text-argile-500 text-sm"
                in:fly={{ y: -10, duration: 200 }}
              >
                {form.error}
              </div>
            {/if}

            <div class="space-y-4 flex-1">
              <Input
                label="Votre nom"
                name="name"
                placeholder="Marie Dupont"
                bind:value={name}
                required
              />

              <Input
                type="email"
                name="email"
                label="Email"
                placeholder="votre@email.com"
                bind:value={email}
                required
              />

              <Input
                type="password"
                name="password"
                label="Mot de passe"
                placeholder="8 caractères minimum"
                bind:value={password}
                required
              />

              <div>
                <Input
                  type="password"
                  name="passwordConfirm"
                  label="Confirmer le mot de passe"
                  placeholder="••••••••"
                  bind:value={passwordConfirm}
                  required
                />
                {#if passwordConfirm && password !== passwordConfirm}
                  <p class="text-xs text-argile-500 mt-1">Les mots de passe ne correspondent pas.</p>
                {/if}
              </div>

              <div class="pt-2">
                <Button
                  type="button"
                  variant="primary"
                  class="w-full"
                  onclick={goToAvatar}
                  disabled={!name.trim() || !email.trim() || !passwordsMatch}
                >
                  Continuer
                </Button>
              </div>
            </div>
          </div>

        {:else if step === 3}
          <div
            bind:this={stepEls[3]}
            class="absolute inset-x-0 top-0 flex flex-col items-center px-1"
            in:fly={{ x: direction === 'forward' ? 20 : -20, duration: getDuration(), opacity: 0 }}
            out:fly={{ x: 20, duration: getDuration(), opacity: 0 }}
          >
            <div class="flex items-center justify-between mb-4 w-full">
              <button
                type="button"
                onclick={goBack}
                class="text-sm text-warm-500 hover:text-warm-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                ← Retour
              </button>
            </div>

            <h1 class="text-2xl font-display font-bold text-warm-900 text-center mb-2">
              Votre avatar
            </h1>
            <p class="text-warm-600 text-center mb-8">
              Choisissez un avatar qui vous ressemble
            </p>

            <!-- Avatar preview -->
            <div class="relative mb-6">
              <img
                src={avatarUrl}
                alt="Avatar"
                class="w-32 h-32 rounded-full ring-4 ring-miel-200 shadow-lg transition-all duration-300"
              />
            </div>

            <!-- Refresh button -->
            <button
              type="button"
              onclick={refreshAvatar}
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass-2 text-sm font-medium text-warm-700 hover:text-miel-600 transition-colors cursor-pointer mb-8"
            >
              <RefreshCw size={16} class={isSpinning ? 'animate-spin' : ''} />
              Changer d'avatar
            </button>

            <!-- Submit form -->
            <form
              method="POST"
              use:enhance={() => {
                isLoading = true;
                return async ({ result }) => {
                  if (result.type === 'redirect') {
                    window.location.href = result.location;
                    return;
                  } else {
                    await applyAction(result);
                    isLoading = false;
                  }
                };
              }}
              class="w-full"
            >
              <input type="hidden" name="role" value={selectedRole} />
              <input type="hidden" name="name" value={name} />
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="password" value={password} />
              <input type="hidden" name="avatarSeed" value={avatarSeed} />

              <label class="flex items-start gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent"
                  required
                  class="mt-0.5 h-4 w-4 shrink-0 rounded border-warm-300 text-miel-500 accent-miel-500 focus-visible:ring-2 focus-visible:ring-miel-400 focus-visible:ring-offset-1"
                />
                <span class="text-sm text-warm-600 leading-snug">
                  J'accepte les <a href="/legal/cgu" target="_blank" class="text-miel-500 hover:text-miel-600 underline underline-offset-2">conditions d'utilisation</a> et la <a href="/legal/confidentialite" target="_blank" class="text-miel-500 hover:text-miel-600 underline underline-offset-2">politique de confidentialit&#233;</a>
                </span>
              </label>

              <Button type="submit" variant="primary" class="w-full" disabled={isLoading}>
                {isLoading ? 'Création...' : 'Créer mon compte'}
              </Button>
            </form>

            <p class="text-xs text-warm-500 text-center mt-4">
              Vous pourrez changer votre avatar plus tard dans les paramètres.
            </p>
          </div>
        {/if}
      </div>
    </Card>

    <p class="text-center text-sm text-warm-500 mt-6">
      Déjà un compte ?
      <a href="/login" class="text-miel-600 hover:text-miel-700 font-medium">
        Se connecter
      </a>
    </p>
  </div>
</div>

<style>
  .orb {
    position: fixed;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    filter: blur(80px);
    animation: orbFloat 20s ease-in-out infinite;
  }

  .orb-1 {
    width: 400px;
    height: 400px;
    background: rgba(232, 145, 58, 0.07);
    top: -5%;
    right: 10%;
  }

  .orb-2 {
    width: 350px;
    height: 350px;
    background: rgba(194, 101, 58, 0.05);
    bottom: 10%;
    left: 5%;
    animation-delay: -7s;
  }

  .orb-3 {
    width: 250px;
    height: 250px;
    background: rgba(250, 221, 187, 0.1);
    top: 40%;
    right: 30%;
    animation-delay: -14s;
  }

  @media (prefers-reduced-motion: reduce) {
    .orb { animation: none !important; }
  }
</style>
