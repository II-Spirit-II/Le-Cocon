<script lang="ts">
  import { enhance, applyAction } from '$app/forms';
  import { onMount } from 'svelte';
  import { Eye, EyeOff, ArrowRight, Mail, Lock } from 'lucide-svelte';
  import type { PageData, ActionData } from './$types';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  let isLoading = $state(false);
  let email = $derived(form?.email ?? '');
  let password = $state('');
  let showPassword = $state(false);
  let ready = $state(false);
  let hasError = $state(false);

  // Trigger error shake then reset
  $effect(() => {
    if (form?.error) {
      hasError = true;
      const t = setTimeout(() => { hasError = false; }, 600);
      return () => clearTimeout(t);
    }
  });

  onMount(() => {
    setTimeout(() => { ready = true; }, 50);
  });
</script>

<svelte:head>
  <title>Connexion — Le Cocon</title>
</svelte:head>

<div class="login-page">
  <!-- Orbs -->
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>
  <div class="orb orb-4" aria-hidden="true"></div>

  <!-- Content -->
  <div class="login-content" class:is-ready={ready}>

    <!-- Back link -->
    <a href="/" class="back-link login-stagger">
      <span class="back-arrow">&larr;</span>
      Accueil
    </a>

    <!-- Brand -->
    <div class="brand login-stagger">
      <span class="font-display text-xl font-bold text-gradient">Le Cocon</span>
    </div>

    <!-- Headline -->
    <h1 class="headline font-display login-stagger">
      Bon retour parmi nous
    </h1>
    <p class="subline login-stagger">
      Votre espace vous attend
    </p>

    <!-- Verified callout -->
    {#if data.verified}
      <div class="callout-verified login-stagger">
        <span class="callout-dot"></span>
        Email verifie avec succes — connectez-vous maintenant
      </div>
    {/if}

    <!-- Error -->
    {#if form?.error}
      <div class="error-banner" class:shake={hasError}>
        <span class="error-text">{form.error}</span>
        {#if form?.unverified}
          <a href="/verify-email?email={encodeURIComponent(form.email ?? '')}" class="error-link">
            Verifier mon email
          </a>
        {/if}
      </div>
    {/if}

    <!-- Form -->
    <form
      method="POST"
      use:enhance={() => {
        isLoading = true;
        return async ({ result }) => {
          if (result.type === 'redirect') {
            window.location.href = result.location;
            return;
          }
          await applyAction(result);
          isLoading = false;
        };
      }}
      class="login-form login-stagger"
    >
      <input type="hidden" name="redirectUrl" value={data.redirectUrl} />

      <!-- Email field -->
      <div class="field-group">
        <div class="field-icon">
          <Mail class="w-4 h-4" />
        </div>
        <input
          type="email"
          name="email"
          id="login-email"
          bind:value={email}
          placeholder=" "
          required
          disabled={isLoading}
          autocomplete="email"
          class="login-input"
          class:has-error={form?.error && !form?.unverified}
        />
        <label for="login-email" class="floating-label">Email</label>
      </div>

      <!-- Password field -->
      <div class="field-group">
        <div class="field-icon">
          <Lock class="w-4 h-4" />
        </div>
        <input
          type={showPassword ? 'text' : 'password'}
          name="password"
          id="login-password"
          bind:value={password}
          placeholder=" "
          required
          disabled={isLoading}
          autocomplete="current-password"
          class="login-input"
          class:has-error={form?.error && !form?.unverified}
        />
        <label for="login-password" class="floating-label">Mot de passe</label>
        <button
          type="button"
          class="toggle-pw"
          onclick={() => showPassword = !showPassword}
          tabindex={-1}
          aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {#if showPassword}
            <EyeOff class="w-4 h-4" />
          {:else}
            <Eye class="w-4 h-4" />
          {/if}
        </button>
      </div>

      <!-- Submit -->
      <button
        type="submit"
        disabled={isLoading}
        class="submit-btn"
      >
        {#if isLoading}
          <span class="submit-shimmer"></span>
          <span class="submit-text">Connexion...</span>
        {:else}
          <span class="submit-text">Se connecter</span>
          <ArrowRight class="w-4 h-4" />
        {/if}
      </button>
    </form>

    <!-- Footer links -->
    <div class="login-footer login-stagger">
      <p class="footer-text">
        Pas encore de compte ?
        <a href="/onboarding" class="footer-link">Creer un compte</a>
      </p>
    </div>
  </div>
</div>

<style>
  /* ════════════════════════════════════════
     PAGE LAYOUT
     ════════════════════════════════════════ */

  .login-page {
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
    top: 15%; left: 15%;
    animation-delay: -4s;
    animation-duration: 25s;
  }

  /* ════════════════════════════════════════
     CONTENT CONTAINER
     ════════════════════════════════════════ */

  .login-content {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 26rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Staggered entrance */
  .login-stagger {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .login-content.is-ready .login-stagger:nth-child(1) { opacity: 1; transform: none; transition-delay: 0.05s; }
  .login-content.is-ready .login-stagger:nth-child(2) { opacity: 1; transform: none; transition-delay: 0.1s; }
  .login-content.is-ready .login-stagger:nth-child(3) { opacity: 1; transform: none; transition-delay: 0.2s; }
  .login-content.is-ready .login-stagger:nth-child(4) { opacity: 1; transform: none; transition-delay: 0.3s; }
  .login-content.is-ready .login-stagger:nth-child(5) { opacity: 1; transform: none; transition-delay: 0.35s; }
  .login-content.is-ready .login-stagger:nth-child(6) { opacity: 1; transform: none; transition-delay: 0.4s; }
  .login-content.is-ready .login-stagger:nth-child(7) { opacity: 1; transform: none; transition-delay: 0.45s; }
  .login-content.is-ready .login-stagger:nth-child(8) { opacity: 1; transform: none; transition-delay: 0.5s; }
  .login-content.is-ready .login-stagger:nth-child(9) { opacity: 1; transform: none; transition-delay: 0.55s; }

  /* ════════════════════════════════════════
     BACK LINK
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
  .back-link:hover .back-arrow {
    transform: translateX(-3px);
  }

  /* ════════════════════════════════════════
     BRAND & HEADLINE
     ════════════════════════════════════════ */

  .brand { margin-bottom: 1.75rem; }

  .headline {
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--color-nuit);
    text-align: center;
    line-height: 1.25;
    margin-bottom: 0.5rem;
    letter-spacing: -0.01em;
  }
  @media (min-width: 640px) {
    .headline { font-size: 2.25rem; }
  }

  .subline {
    font-size: 1rem;
    color: var(--color-warm-500);
    text-align: center;
    margin-bottom: 2rem;
  }

  /* ════════════════════════════════════════
     CALLOUTS & ERRORS
     ════════════════════════════════════════ */

  .callout-verified {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.875rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-mousse-600);
    background: rgba(95, 160, 91, 0.08);
    border: 1px solid rgba(95, 160, 91, 0.15);
    margin-bottom: 1.25rem;
  }
  .callout-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--color-mousse-500);
    flex-shrink: 0;
  }

  .error-banner {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.875rem;
    font-size: 0.8rem;
    background: rgba(194, 99, 90, 0.08);
    border: 1px solid rgba(194, 99, 90, 0.18);
    margin-bottom: 1.25rem;
    transition: transform 0.1s;
  }
  .error-text { color: var(--color-argile-500); }
  .error-link {
    display: inline-block;
    margin-top: 0.35rem;
    font-weight: 600;
    color: var(--color-miel-600);
    transition: color 0.2s;
  }
  .error-link:hover { color: var(--color-miel-700); }

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
     FORM
     ════════════════════════════════════════ */

  .login-form {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.75rem;
    border-radius: 1.5rem;
    background: rgba(255, 248, 240, 0.65);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 8px 32px rgba(194, 101, 58, 0.08);
  }

  /* ════════════════════════════════════════
     FIELD GROUP — floating label
     ════════════════════════════════════════ */

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

  .login-input {
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
  .login-input::placeholder { color: transparent; }

  .login-input:focus {
    border-color: rgba(232, 145, 58, 0.55);
    box-shadow: 0 0 0 3px rgba(232, 145, 58, 0.1), 0 0 24px rgba(232, 145, 58, 0.06);
    background: rgba(255, 248, 238, 0.65);
  }
  .field-group:focus-within .field-icon {
    color: var(--color-miel-500);
  }

  .login-input.has-error {
    border-color: rgba(194, 99, 90, 0.5);
  }
  .login-input.has-error:focus {
    border-color: var(--color-argile-500);
    box-shadow: 0 0 0 3px rgba(194, 99, 90, 0.12);
  }

  .login-input:disabled {
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

  .login-input:focus ~ .floating-label,
  .login-input:not(:placeholder-shown) ~ .floating-label {
    transform: translateY(-155%);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-miel-600);
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
    margin-top: 0.35rem;
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
     FOOTER
     ════════════════════════════════════════ */

  .login-footer {
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
    .login-stagger {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .error-banner.shake { animation: none !important; }
    .submit-shimmer { animation: none !important; }
  }
</style>
