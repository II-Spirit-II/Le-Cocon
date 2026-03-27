<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { enhance, applyAction } from '$app/forms';
  import { getAdultAvatarUrl } from '$lib/utils/avatar';
  import type { UserRole } from '$lib/types';
  import {
    Users, GraduationCap, RefreshCw, ArrowRight, ArrowLeft,
    Eye, EyeOff, User, Mail, Lock, Check, Sparkles
  } from 'lucide-svelte';
  import type { ActionData } from './$types';

  interface Props {
    form: ActionData;
  }

  let { form }: Props = $props();

  // ── Step & role state ──
  let step = $state(1);
  let selectedRole = $state<UserRole | null>(null);

  // ── Form fields ──
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let passwordConfirm = $state('');
  let showPassword = $state(false);
  let showConfirm = $state(false);
  let isLoading = $state(false);
  let avatarSeed = $state(0);
  let isSpinning = $state(false);
  let hasError = $state(false);

  // ── Blur-based validation ──
  let touched = $state<Record<string, boolean>>({});

  function markTouched(field: string) {
    touched = { ...touched, [field]: true };
  }

  let nameValid = $derived(name.trim().length >= 2);
  let emailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  let passwordValid = $derived(password.length >= 8);
  let passwordsMatch = $derived(password === passwordConfirm && passwordValid);
  let step2Valid = $derived(nameValid && emailValid && passwordsMatch);

  // ── FLIP height animation (same pattern as overview tabs) ──
  let contentEl: HTMLDivElement | undefined = $state();
  let step1El: HTMLDivElement | undefined = $state();
  let step2El: HTMLDivElement | undefined = $state();
  let step3El: HTMLDivElement | undefined = $state();

  function getStepEl(s: number) {
    if (s === 1) return step1El;
    if (s === 2) return step2El;
    return step3El;
  }

  // Set initial height + observe active step resizes
  $effect(() => {
    if (!browser || !contentEl) return;
    const activeEl = getStepEl(step);
    if (!activeEl) return;

    contentEl.style.height = `${activeEl.offsetHeight}px`;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newH = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
        if (contentEl && Math.abs(newH - contentEl.offsetHeight) > 1) {
          contentEl.style.height = `${newH}px`;
        }
      }
    });
    ro.observe(activeEl);
    return () => ro.disconnect();
  });

  function switchStep(to: number) {
    if (to === step || !contentEl) return;
    const fromH = contentEl.offsetHeight;
    const targetEl = getStepEl(to);
    if (!targetEl) return;
    const toH = targetEl.offsetHeight;

    // Lock current height
    contentEl.style.height = `${fromH}px`;
    contentEl.offsetHeight; // force reflow

    // Switch step
    step = to;

    // Animate to target height
    requestAnimationFrame(() => {
      if (contentEl) contentEl.style.height = `${toH}px`;
    });
  }

  function selectRole(role: UserRole) {
    selectedRole = role;
    switchStep(2);
  }

  function goToAvatar() {
    if (!step2Valid) return;
    switchStep(3);
  }

  function goBack() {
    if (step === 3) switchStep(2);
    else { switchStep(1); selectedRole = null; }
  }

  function refreshAvatar() {
    avatarSeed++;
    isSpinning = true;
    setTimeout(() => { isSpinning = false; }, 500);
  }

  const avatarUrl = $derived(getAdultAvatarUrl(name.trim() + (avatarSeed > 0 ? ` ${avatarSeed}` : '')));

  // ── Page entrance ──
  let ready = $state(false);
  onMount(() => { setTimeout(() => { ready = true; }, 50); });

  // Error shake
  $effect(() => {
    if (form?.error) {
      hasError = true;
      const t = setTimeout(() => { hasError = false; }, 600);
      return () => clearTimeout(t);
    }
  });

  $effect(() => {
    if (form?.email) email = form.email as string;
    if (form?.name) name = form.name as string;
  });
</script>

<svelte:head>
  <title>Inscription — Le Cocon</title>
</svelte:head>

<div class="onboarding-page">
  <!-- Orbs -->
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>
  <div class="orb orb-4" aria-hidden="true"></div>

  <div class="onboarding-content" class:is-ready={ready}>
    <!-- Back link -->
    <a href="/" class="back-link onb-stagger">
      <span class="back-arrow">&larr;</span>
      Accueil
    </a>

    <!-- Brand -->
    <div class="brand onb-stagger">
      <span class="font-display text-xl font-bold text-gradient">Le Cocon</span>
    </div>

    <!-- Progress indicator -->
    <div class="progress-dots onb-stagger">
      {#each [1, 2, 3] as s}
        <div class="progress-dot" class:active={step >= s} class:current={step === s}></div>
        {#if s < 3}
          <div class="progress-line" class:active={step > s}></div>
        {/if}
      {/each}
    </div>

    <!-- Steps container -->
    <div class="steps-container glass-1 rounded-3xl onb-stagger" bind:this={contentEl}>
      <!-- ═══ STEP 1 — Role selection ═══ -->
      <div
        bind:this={step1El}
        class="step-tab {step === 1 ? 'step-tab-active' : 'step-tab-hidden'}"
      >
        <div class="step-header inner-stagger" class:inner-visible={ready}>
          <h1 class="step-title font-display">Vous etes ici chez vous</h1>
          <p class="step-sub">Quel est votre role ?</p>
        </div>

        <div class="role-grid inner-stagger" class:inner-visible={ready} style="transition-delay: 0.45s">
            <!-- Parent card -->
            <button
              type="button"
              class="role-card"
              class:selected={selectedRole === 'parent'}
              onclick={() => selectRole('parent')}
            >
              <div class="role-icon">
                <Users class="w-7 h-7" />
              </div>
              <h3 class="role-title font-display">Je suis parent</h3>
              <p class="role-desc">
                Suivez le quotidien de votre enfant chez son assistante maternelle
              </p>
              <div class="role-check">
                <Check class="w-3.5 h-3.5" />
              </div>
            </button>

            <!-- Assistante card -->
            <button
              type="button"
              class="role-card"
              class:selected={selectedRole === 'assistante'}
              onclick={() => selectRole('assistante')}
            >
              <div class="role-icon">
                <GraduationCap class="w-7 h-7" />
              </div>
              <h3 class="role-title font-display">Je suis assistante maternelle</h3>
              <p class="role-desc">
                Partagez le quotidien des enfants avec leurs parents
              </p>
              <div class="role-check">
                <Check class="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
      </div>

      <!-- ═══ STEP 2 — Informations ═══ -->
      <div
        bind:this={step2El}
        class="step-tab {step === 2 ? 'step-tab-active' : 'step-tab-hidden'}"
      >
          <div class="step-top-bar">
            <button type="button" class="step-back" onclick={goBack}>
              <ArrowLeft class="w-3.5 h-3.5" />
              Retour
            </button>
            <span class="role-badge">
              {#if selectedRole === 'parent'}
                <Users class="w-3 h-3" /> Parent
              {:else}
                <GraduationCap class="w-3 h-3" /> Assistante
              {/if}
            </span>
          </div>

          <div class="step-header">
            <h1 class="step-title font-display">Faisons connaissance</h1>
            <p class="step-sub">Encore quelques informations</p>
          </div>

          <!-- Error banner -->
          {#if form?.error}
            <div class="error-banner" class:shake={hasError}>
              {form.error}
            </div>
          {/if}

          <div class="fields-stack">
            <!-- Name -->
            <div class="field-group">
              <div class="field-icon">
                <User class="w-4 h-4" />
              </div>
              <input
                type="text"
                name="name"
                id="onb-name"
                bind:value={name}
                placeholder=" "
                required
                autocomplete="name"
                class="onb-input"
                class:valid={touched['name'] && nameValid}
                class:invalid={touched['name'] && !nameValid && name.length > 0}
                onblur={() => markTouched('name')}
              />
              <label for="onb-name" class="floating-label">Votre nom</label>
              {#if touched['name'] && nameValid}
                <div class="field-check"><Check class="w-3.5 h-3.5" /></div>
              {/if}
            </div>
            {#if touched['name'] && !nameValid && name.length > 0}
              <p class="field-error">Le nom doit contenir au moins 2 caracteres</p>
            {/if}

            <!-- Email -->
            <div class="field-group">
              <div class="field-icon">
                <Mail class="w-4 h-4" />
              </div>
              <input
                type="email"
                name="email"
                id="onb-email"
                bind:value={email}
                placeholder=" "
                required
                autocomplete="email"
                class="onb-input"
                class:valid={touched['email'] && emailValid}
                class:invalid={touched['email'] && !emailValid && email.length > 0}
                onblur={() => markTouched('email')}
              />
              <label for="onb-email" class="floating-label">Email</label>
              {#if touched['email'] && emailValid}
                <div class="field-check"><Check class="w-3.5 h-3.5" /></div>
              {/if}
            </div>
            {#if touched['email'] && !emailValid && email.length > 0}
              <p class="field-error">Adresse email invalide</p>
            {/if}

            <!-- Password -->
            <div class="field-group">
              <div class="field-icon">
                <Lock class="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                id="onb-password"
                bind:value={password}
                placeholder=" "
                required
                autocomplete="new-password"
                class="onb-input"
                class:valid={touched['password'] && passwordValid}
                class:invalid={touched['password'] && !passwordValid && password.length > 0}
                onblur={() => markTouched('password')}
              />
              <label for="onb-password" class="floating-label">Mot de passe</label>
              <button
                type="button"
                class="toggle-pw"
                onclick={() => showPassword = !showPassword}
                tabindex={-1}
                aria-label={showPassword ? 'Masquer' : 'Afficher'}
              >
                {#if showPassword}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
            {#if touched['password'] && !passwordValid && password.length > 0}
              <p class="field-error">8 caracteres minimum</p>
            {/if}

            <!-- Confirm password -->
            <div class="field-group">
              <div class="field-icon">
                <Lock class="w-4 h-4" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'}
                name="passwordConfirm"
                id="onb-confirm"
                bind:value={passwordConfirm}
                placeholder=" "
                required
                autocomplete="new-password"
                class="onb-input"
                class:valid={touched['confirm'] && passwordsMatch}
                class:invalid={touched['confirm'] && !passwordsMatch && passwordConfirm.length > 0}
                onblur={() => markTouched('confirm')}
              />
              <label for="onb-confirm" class="floating-label">Confirmer le mot de passe</label>
              <button
                type="button"
                class="toggle-pw"
                onclick={() => showConfirm = !showConfirm}
                tabindex={-1}
                aria-label={showConfirm ? 'Masquer' : 'Afficher'}
              >
                {#if showConfirm}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            </div>
            {#if touched['confirm'] && !passwordsMatch && passwordConfirm.length > 0}
              <p class="field-error">Les mots de passe ne correspondent pas</p>
            {/if}

            <!-- Continue -->
            <button
              type="button"
              class="submit-btn"
              onclick={goToAvatar}
              disabled={!step2Valid}
            >
              <span class="submit-text">Continuer</span>
              <ArrowRight class="w-4 h-4" />
            </button>
          </div>
      </div>

      <!-- ═══ STEP 3 — Avatar & Consent ═══ -->
      <div
        bind:this={step3El}
        class="step-tab step-center {step === 3 ? 'step-tab-active' : 'step-tab-hidden'}"
      >
          <div class="step-top-bar">
            <button type="button" class="step-back" onclick={goBack}>
              <ArrowLeft class="w-3.5 h-3.5" />
              Retour
            </button>
          </div>

          <div class="step-header">
            <h1 class="step-title font-display">Presque la</h1>
            <p class="step-sub">Choisissez un avatar qui vous ressemble</p>
          </div>

          <!-- Avatar -->
          <div class="avatar-zone">
            <div class="avatar-ring">
              <img
                src={avatarUrl}
                alt="Avatar"
                class="avatar-img"
              />
            </div>
            <button
              type="button"
              class="refresh-btn"
              onclick={refreshAvatar}
            >
              <RefreshCw class="w-4 h-4" style={isSpinning ? 'animation: spin 0.5s ease-in-out' : ''} />
              Changer d'avatar
            </button>
          </div>

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
            class="avatar-form"
          >
            <input type="hidden" name="role" value={selectedRole} />
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="password" value={password} />
            <input type="hidden" name="avatarSeed" value={avatarSeed} />

            <!-- Consent -->
            <label class="consent-row">
              <input
                type="checkbox"
                name="consent"
                required
                class="consent-check"
              />
              <span class="consent-text">
                J'accepte les <a href="/legal/cgu" target="_blank" class="consent-link">conditions d'utilisation</a> et la <a href="/legal/confidentialite" target="_blank" class="consent-link">politique de confidentialite</a>
              </span>
            </label>

            {#if form?.error}
              <div class="error-banner" class:shake={hasError}>
                {form.error}
              </div>
            {/if}

            <button
              type="submit"
              class="submit-btn"
              disabled={isLoading}
            >
              {#if isLoading}
                <span class="submit-shimmer"></span>
                <span class="submit-text">Creation...</span>
              {:else}
                <Sparkles class="w-4 h-4" />
                <span class="submit-text">Creer mon compte</span>
              {/if}
            </button>
          </form>

          <p class="avatar-hint">
            Vous pourrez changer votre avatar plus tard dans les parametres.
          </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="onb-footer onb-stagger">
      <p class="footer-text">
        Deja un compte ?
        <a href="/login" class="footer-link">Se connecter</a>
      </p>
    </div>
  </div>
</div>

<style>
  /* ════════════════════════════════════════
     PAGE
     ════════════════════════════════════════ */

  .onboarding-page {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse 90% 70% at 30% 20%, rgba(232, 145, 58, 0.1), transparent 60%),
      radial-gradient(ellipse 70% 50% at 75% 70%, rgba(194, 101, 58, 0.07), transparent 55%),
      radial-gradient(ellipse 50% 40% at 50% 50%, rgba(250, 221, 187, 0.12), transparent 50%),
      linear-gradient(170deg, #FFF8F0 0%, #F5E6D3 35%, #FADCC5 65%, #F0C8A8 100%);
  }

  /* ════════════════════════════════════════
     ORBS
     ════════════════════════════════════════ */

  .orb {
    position: fixed;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    filter: blur(80px);
    will-change: transform;
    animation: orbFloat 20s ease-in-out infinite;
  }
  .orb-1 {
    width: 450px; height: 450px;
    background: rgba(232, 145, 58, 0.1);
    top: -8%; right: -5%;
  }
  .orb-2 {
    width: 380px; height: 380px;
    background: rgba(194, 101, 58, 0.07);
    bottom: 5%; left: -8%;
    animation-delay: -7s;
  }
  .orb-3 {
    width: 300px; height: 300px;
    background: rgba(250, 221, 187, 0.15);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    animation-delay: -12s;
  }
  .orb-4 {
    width: 200px; height: 200px;
    background: rgba(232, 145, 58, 0.06);
    bottom: 20%; right: 15%;
    animation-delay: -4s;
    animation-duration: 25s;
  }

  /* ════════════════════════════════════════
     CONTENT
     ════════════════════════════════════════ */

  .onboarding-content {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 28rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Page entrance stagger — visibility hides backdrop-filter unlike opacity alone */
  .onb-stagger {
    opacity: 0;
    visibility: hidden;
    transform: translateY(16px);
    transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
                visibility 0s linear 0.6s,
                transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .onboarding-content.is-ready .onb-stagger:nth-child(1) { opacity: 1; visibility: visible; transform: none; transition-delay: 0.05s; transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.05s, visibility 0s linear 0.05s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.05s; }
  .onboarding-content.is-ready .onb-stagger:nth-child(2) { opacity: 1; visibility: visible; transform: none; transition-delay: 0.12s; transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.12s, visibility 0s linear 0.12s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.12s; }
  .onboarding-content.is-ready .onb-stagger:nth-child(3) { opacity: 1; visibility: visible; transform: none; transition-delay: 0.2s; transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s, visibility 0s linear 0.2s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s; }
  .onboarding-content.is-ready .onb-stagger:nth-child(4) { opacity: 1; visibility: visible; transform: none; transition-delay: 0.3s; transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s, visibility 0s linear 0.3s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.3s; }
  .onboarding-content.is-ready .onb-stagger:nth-child(5) { opacity: 1; visibility: visible; transform: none; transition-delay: 0.4s; transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.4s, visibility 0s linear 0.4s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.4s; }

  /* Inner step content entrance on first load */
  .inner-stagger {
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
    transition-delay: 0.35s;
  }
  .inner-stagger.inner-visible {
    opacity: 1;
    transform: none;
  }

  /* ════════════════════════════════════════
     BACK LINK & BRAND
     ════════════════════════════════════════ */

  .back-link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-warm-500);
    margin-bottom: 2rem;
    transition: color 0.2s;
  }
  .back-link:hover { color: var(--color-sienne-500); }
  .back-arrow {
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    display: inline-block;
  }
  .back-link:hover .back-arrow { transform: translateX(-3px); }

  .brand { margin-bottom: 1.5rem; }

  /* ════════════════════════════════════════
     PROGRESS DOTS
     ════════════════════════════════════════ */

  .progress-dots {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 1.75rem;
  }
  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-warm-300);
    transition: background 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.4s;
  }
  .progress-dot.active {
    background: var(--color-miel-500);
  }
  .progress-dot.current {
    transform: scale(1.3);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.15);
  }
  .progress-line {
    width: 2rem;
    height: 2px;
    border-radius: 1px;
    background: var(--color-warm-300);
    transition: background 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .progress-line.active {
    background: var(--color-miel-500);
  }

  /* ════════════════════════════════════════
     STEPS CONTAINER
     ════════════════════════════════════════ */

  .steps-container {
    width: 100%;
    position: relative;
    overflow: hidden;
    transition: height 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .step-tab {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .step-tab-active {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    z-index: 1;
    visibility: visible;
  }
  .step-tab-hidden {
    opacity: 0;
    transform: translateY(6px);
    pointer-events: none;
    z-index: 0;
    visibility: hidden;
  }
  .step-center { align-items: center; }

  /* ════════════════════════════════════════
     STEP HEADER
     ════════════════════════════════════════ */

  .step-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-bottom: 1rem;
  }
  .step-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--color-warm-500);
    transition: color 0.2s;
  }
  .step-back:hover { color: var(--color-sienne-500); }

  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 2rem;
    background: rgba(232, 145, 58, 0.08);
    color: var(--color-miel-700);
  }

  .step-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }
  .step-title {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--color-nuit);
    line-height: 1.25;
    margin-bottom: 0.4rem;
  }
  .step-sub {
    font-size: 0.9rem;
    color: var(--color-warm-500);
  }

  /* ════════════════════════════════════════
     ROLE CARDS
     ════════════════════════════════════════ */

  .role-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    flex: 1;
  }
  @media (min-width: 480px) {
    .role-grid { grid-template-columns: 1fr 1fr; }
  }

  .role-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 1.5rem 1rem;
    border-radius: 1.25rem;
    background: rgba(255, 248, 238, 0.45);
    border: 1.5px solid rgba(255, 240, 220, 0.4);
    transition: border-color 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                background 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .role-card:hover {
    border-color: rgba(232, 145, 58, 0.35);
    background: rgba(255, 248, 238, 0.65);
    box-shadow: 0 8px 28px rgba(194, 101, 58, 0.1);
    transform: translateY(-2px);
  }
  .role-card:active {
    transform: scale(0.98);
  }
  .role-card.selected {
    border-color: var(--color-miel-500);
    background: rgba(232, 145, 58, 0.06);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.12), 0 8px 28px rgba(194, 101, 58, 0.1);
  }

  .role-icon {
    width: 3rem;
    height: 3rem;
    border-radius: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(232, 145, 58, 0.08);
    color: var(--color-miel-500);
    margin-bottom: 0.75rem;
    transition: background 0.3s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .role-card:hover .role-icon {
    background: rgba(232, 145, 58, 0.12);
    transform: scale(1.08);
  }
  .role-card.selected .role-icon {
    background: rgba(232, 145, 58, 0.15);
  }

  .role-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-nuit);
    margin-bottom: 0.35rem;
    transition: color 0.2s;
  }
  .role-card:hover .role-title { color: var(--color-miel-700); }

  .role-desc {
    font-size: 0.78rem;
    color: var(--color-warm-500);
    line-height: 1.45;
  }

  .role-check {
    position: absolute;
    top: 0.65rem;
    right: 0.65rem;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-mousse-500);
    color: #FFF8F0;
    opacity: 0;
    transform: scale(0.5);
    transition: opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .role-card.selected .role-check {
    opacity: 1;
    transform: scale(1);
  }

  /* ════════════════════════════════════════
     FORM FIELDS — floating labels
     ════════════════════════════════════════ */

  .fields-stack {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .field-group {
    position: relative;
  }

  .field-icon {
    position: absolute;
    left: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-warm-400);
    pointer-events: none;
    z-index: 1;
    transition: color 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .field-group:focus-within .field-icon {
    color: var(--color-miel-500);
  }

  .onb-input {
    display: block;
    width: 100%;
    padding: 0.875rem 2.75rem 0.625rem 2.75rem;
    font-size: 0.9rem;
    color: var(--color-nuit);
    background: rgba(255, 248, 238, 0.45);
    border: 1.5px solid rgba(255, 240, 220, 0.4);
    border-radius: 0.875rem;
    outline: none;
    transition: border-color 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                box-shadow 0.35s cubic-bezier(0.22, 1, 0.36, 1),
                background 0.3s;
  }
  .onb-input::placeholder { color: transparent; }

  .onb-input:focus {
    border-color: rgba(232, 145, 58, 0.55);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.1), 0 0 24px rgba(232, 145, 58, 0.06);
    background: rgba(255, 248, 238, 0.65);
  }

  .onb-input.valid {
    border-color: rgba(95, 160, 91, 0.45);
  }
  .onb-input.valid:focus {
    border-color: rgba(95, 160, 91, 0.6);
    box-shadow: 0 0 0 3px rgba(95, 160, 91, 0.1);
  }
  .onb-input.invalid {
    border-color: rgba(194, 99, 90, 0.45);
  }
  .onb-input.invalid:focus {
    border-color: var(--color-argile-500);
    box-shadow: 0 0 0 3px rgba(194, 99, 90, 0.1);
  }

  .onb-input:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  /* Floating label */
  .floating-label {
    position: absolute;
    left: 2.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.85rem;
    color: var(--color-warm-500);
    pointer-events: none;
    transform-origin: left center;
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                font-size 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                color 0.3s;
  }
  .onb-input:focus ~ .floating-label,
  .onb-input:not(:placeholder-shown) ~ .floating-label {
    transform: translateY(-155%);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-miel-600);
  }

  .field-check {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-mousse-500);
    animation: checkPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes checkPop {
    from { transform: translateY(-50%) scale(0); }
    to { transform: translateY(-50%) scale(1); }
  }

  .field-error {
    font-size: 0.72rem;
    color: var(--color-argile-500);
    margin-top: 0.25rem;
    margin-left: 0.25rem;
    animation: shakeError 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }

  /* Toggle password */
  .toggle-pw {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-warm-400);
    padding: 0.35rem;
    border-radius: 0.5rem;
    transition: color 0.2s, background 0.2s;
  }
  .toggle-pw:hover {
    color: var(--color-warm-600);
    background: rgba(232, 145, 58, 0.06);
  }

  /* ════════════════════════════════════════
     AVATAR ZONE
     ════════════════════════════════════════ */

  .avatar-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .avatar-ring {
    width: 7.5rem;
    height: 7.5rem;
    border-radius: 50%;
    padding: 4px;
    background: linear-gradient(135deg, var(--color-miel-400), var(--color-sienne-400));
    margin-bottom: 1rem;
    box-shadow: 0 8px 32px rgba(232, 145, 58, 0.15);
  }
  .avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    border-radius: 0.75rem;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--color-warm-600);
    background: rgba(255, 248, 238, 0.45);
    border: 1px solid rgba(255, 240, 220, 0.35);
    transition: color 0.2s, background 0.2s, border-color 0.2s;
  }
  .refresh-btn:hover {
    color: var(--color-miel-600);
    background: rgba(255, 248, 238, 0.65);
    border-color: rgba(232, 145, 58, 0.2);
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .avatar-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ════════════════════════════════════════
     CONSENT
     ════════════════════════════════════════ */

  .consent-row {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    cursor: pointer;
  }
  .consent-check {
    margin-top: 0.15rem;
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    flex-shrink: 0;
    accent-color: var(--color-miel-500);
  }
  .consent-check:focus-visible {
    outline: 2px solid var(--color-miel-400);
    outline-offset: 2px;
  }
  .consent-text {
    font-size: 0.78rem;
    color: var(--color-warm-600);
    line-height: 1.5;
  }
  .consent-link {
    color: var(--color-miel-500);
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;
  }
  .consent-link:hover { color: var(--color-miel-600); }

  .avatar-hint {
    font-size: 0.72rem;
    color: var(--color-warm-400);
    text-align: center;
    margin-top: 1rem;
  }

  /* ════════════════════════════════════════
     SUBMIT BUTTON
     ════════════════════════════════════════ */

  .submit-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.8rem 1.5rem;
    margin-top: 0.25rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: #FFF8F0;
    background: var(--color-miel-500);
    border-radius: 0.875rem;
    overflow: hidden;
    outline: none;
    box-shadow: 0 4px 16px rgba(232, 145, 58, 0.3);
    transition: background 0.2s,
                box-shadow 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .submit-btn:hover:not(:disabled) {
    background: var(--color-miel-600);
    box-shadow: 0 6px 24px rgba(232, 145, 58, 0.4);
  }
  .submit-btn:active:not(:disabled) {
    transform: scale(0.97);
  }
  .submit-btn:focus-visible {
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.3), 0 4px 16px rgba(232, 145, 58, 0.3);
  }
  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .submit-text { position: relative; z-index: 1; }

  .submit-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg,
      transparent 25%,
      rgba(255, 248, 240, 0.2) 50%,
      transparent 75%
    );
    background-size: 200% 100%;
    animation: shimmerBtn 1.5s ease-in-out infinite;
  }
  @keyframes shimmerBtn {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* ════════════════════════════════════════
     ERROR
     ════════════════════════════════════════ */

  .error-banner {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.875rem;
    font-size: 0.8rem;
    color: var(--color-argile-500);
    background: rgba(194, 99, 90, 0.08);
    border: 1px solid rgba(194, 99, 90, 0.18);
    margin-bottom: 0.75rem;
  }
  .error-banner.shake {
    animation: shakeError 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
  @keyframes shakeError {
    10%, 90% { transform: translateX(-1.5px); }
    20%, 80% { transform: translateX(2.5px); }
    30%, 50%, 70% { transform: translateX(-3px); }
    40%, 60% { transform: translateX(3px); }
  }

  /* ════════════════════════════════════════
     FOOTER
     ════════════════════════════════════════ */

  .onb-footer {
    width: 100%;
    text-align: center;
    margin-top: 1.75rem;
  }
  .footer-text {
    font-size: 0.8rem;
    color: var(--color-warm-500);
  }
  .footer-link {
    font-weight: 600;
    color: var(--color-sienne-500);
    transition: color 0.2s;
  }
  .footer-link:hover { color: var(--color-sienne-600); }

  /* ════════════════════════════════════════
     REDUCED MOTION
     ════════════════════════════════════════ */

  @media (prefers-reduced-motion: reduce) {
    .orb { animation: none !important; }
    .onb-stagger,
    .inner-stagger {
      opacity: 1 !important;
      visibility: visible !important;
      transform: none !important;
      transition: none !important;
    }
    .steps-container { transition: none !important; }
    .step-tab { transition: none !important; }
    .error-banner.shake,
    .field-error { animation: none !important; }
    .submit-shimmer { animation: none !important; }
    .progress-dot,
    .progress-line,
    .role-card,
    .role-icon,
    .role-check,
    .field-check { transition: none !important; }
  }
</style>
