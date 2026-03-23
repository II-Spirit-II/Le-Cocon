<script lang="ts">
  import { enhance, applyAction } from '$app/forms';
  import { Button, Card, FadeIn, Callout } from '$lib/ui';
  import { Mail, RefreshCw } from 'lucide-svelte';
  import type { PageData, ActionData } from './$types';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  let isLoading = $state(false);
  let isResending = $state(false);
  let digits = $state(['', '', '', '', '', '']);
  let inputs: HTMLInputElement[] = $state([]);
  let cooldown = $state(0);

  // Dev mode code display (from initial send or resend)
  let devCode = $state<string | null>(null);

  // Start cooldown on mount (code was just sent from onboarding)
  $effect(() => {
    startCooldown();
  });

  $effect(() => {
    if (form?.resent) {
      startCooldown();
      if (form.devCode) devCode = form.devCode as string;
    }
  });

  function startCooldown() {
    cooldown = 60;
    const timer = setInterval(() => {
      cooldown--;
      if (cooldown <= 0) clearInterval(timer);
    }, 1000);
  }

  function handleInput(index: number, e: Event) {
    const input = e.target as HTMLInputElement;
    const value = input.value;

    // Handle paste of full code
    if (value.length > 1) {
      const chars = value.replace(/\D/g, '').slice(0, 6).split('');
      digits = chars.concat(Array(6 - chars.length).fill(''));
      const nextIdx = Math.min(chars.length, 5);
      inputs[nextIdx]?.focus();
      return;
    }

    digits[index] = value.replace(/\D/g, '');

    if (digits[index] && index < 5) {
      inputs[index + 1]?.focus();
    }
  }

  function handleKeydown(index: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digits[index - 1] = '';
      inputs[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? '';
    const chars = pasted.split('');
    digits = chars.concat(Array(6 - chars.length).fill(''));
    const nextIdx = Math.min(chars.length, 5);
    inputs[nextIdx]?.focus();
  }

  const codeValue = $derived(digits.join(''));
  const isCodeComplete = $derived(codeValue.length === 6);
</script>

<div class="min-h-screen bg-aube flex items-center justify-center p-4 relative overflow-hidden">
  <!-- Decorative orbs -->
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>

  <div class="w-full max-w-md relative z-10">
    <!-- Logo -->
    <FadeIn delay={0}>
      <div class="text-center mb-8">
        <a href="/" class="inline-flex items-center gap-2">
          <img src="/favicon.png" alt="Le Cocon" class="w-10 h-10" />
          <span class="font-display font-bold text-2xl text-warm-900">Le Cocon</span>
        </a>
      </div>
    </FadeIn>

    <FadeIn delay={80}>
      <Card padding="lg">
        <div class="flex justify-center mb-4 text-miel-500">
          <Mail size={48} />
        </div>

        <h1 class="text-2xl font-display font-bold text-warm-900 text-center mb-2">
          Vérification de votre email
        </h1>
        <p class="text-warm-600 text-center mb-6">
          Un code à 6 chiffres a été envoyé à
          <span class="font-medium text-warm-800">{data.email}</span>
        </p>

        {#if data.devMode && devCode}
          <div class="mb-4">
            <Callout variant="info">
              Mode développement — Code : <span class="font-mono font-bold tracking-wider">{devCode}</span>
            </Callout>
          </div>
        {/if}

        {#if form?.error}
          <div class="mb-4 p-3 bg-argile-400/10 border border-argile-400/20 rounded-xl text-argile-500 text-sm">
            {form.error}
          </div>
        {/if}

        <!-- Code input -->
        <form
          method="POST"
          action="?/verify"
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
        >
          <input type="hidden" name="email" value={data.email} />
          <input type="hidden" name="code" value={codeValue} />

          <div class="flex justify-center gap-3 mb-6" onpaste={handlePaste}>
            {#each digits as digit, i}
              <input
                bind:this={inputs[i]}
                type="text"
                inputmode="numeric"
                maxlength="6"
                value={digit}
                oninput={(e) => handleInput(i, e)}
                onkeydown={(e) => handleKeydown(i, e)}
                disabled={isLoading}
                class="w-12 h-14 text-center text-xl font-mono font-bold rounded-xl border-2 transition-colors duration-200 outline-none
                  {digit ? 'border-miel-400 bg-miel-50/50 text-warm-900' : 'border-warm-300 bg-warm-50/30 text-warm-700'}
                  focus-visible:border-miel-500 focus-visible:ring-2 focus-visible:ring-miel-200
                  disabled:opacity-50"
              />
            {/each}
          </div>

          <Button type="submit" variant="primary" class="w-full" disabled={!isCodeComplete || isLoading}>
            {isLoading ? 'Vérification...' : 'Vérifier'}
          </Button>
        </form>

        <!-- Resend -->
        <div class="mt-6 text-center">
          <p class="text-sm text-warm-500 mb-2">Vous n'avez pas reçu le code ?</p>
          <form
            method="POST"
            action="?/resend"
            use:enhance={() => {
              isResending = true;
              return async ({ result }) => {
                await applyAction(result);
                isResending = false;
              };
            }}
            class="inline"
          >
            <input type="hidden" name="email" value={data.email} />
            <button
              type="submit"
              disabled={cooldown > 0 || isResending}
              class="inline-flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer
                {cooldown > 0 ? 'text-warm-400' : 'text-miel-600 hover:text-miel-700'}"
            >
              <RefreshCw size={14} class={isResending ? 'animate-spin' : ''} />
              {#if cooldown > 0}
                Renvoyer dans {cooldown}s
              {:else}
                Renvoyer le code
              {/if}
            </button>
          </form>
        </div>
      </Card>
    </FadeIn>

    <FadeIn delay={160}>
      <p class="text-center text-sm text-warm-500 mt-6">
        <a href="/login" class="hover:text-warm-700">← Retour à la connexion</a>
      </p>
    </FadeIn>
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
