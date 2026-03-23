<script lang="ts">
  import { enhance, applyAction } from '$app/forms';
  import { Button, Input, Card, FadeIn, Callout } from '$lib/ui';
  import type { PageData, ActionData } from './$types';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  let isLoading = $state(false);
  let email = $derived(form?.email ?? '');
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
        <h1 class="text-2xl font-display font-bold text-warm-900 text-center mb-2">
          Connexion
        </h1>
        <p class="text-warm-600 text-center mb-6">
          Accédez à votre espace personnel
        </p>

        {#if data.verified}
          <div class="mb-4">
            <Callout variant="success">
              Email vérifié avec succès ! Vous pouvez maintenant vous connecter.
            </Callout>
          </div>
        {/if}

        {#if form?.error}
          <div class="mb-4 p-3 bg-argile-400/10 border border-argile-400/20 rounded-xl text-argile-500 text-sm">
            {form.error}
            {#if form?.unverified}
              <a href="/verify-email?email={encodeURIComponent(form.email ?? '')}" class="block mt-1 text-miel-600 hover:text-miel-700 font-medium">
                Vérifier mon email
              </a>
            {/if}
          </div>
        {/if}

        <form
          method="POST"
          use:enhance={() => {
            isLoading = true;
            return async ({ result }) => {
              if (result.type === 'redirect') {
                // Full page reload to cleanly swap (auth) → (app) layout group
                window.location.href = result.location;
                return;
              }
              await applyAction(result);
              isLoading = false;
            };
          }}
          class="space-y-4"
        >
          <input type="hidden" name="redirectUrl" value={data.redirectUrl} />

          <Input
            type="email"
            name="email"
            label="Email"
            placeholder="votre@email.com"
            bind:value={email}
            required
            disabled={isLoading}
          />

          <Input
            type="password"
            name="password"
            label="Mot de passe"
            placeholder="••••••••"
            required
            disabled={isLoading}
          />

          <div class="pt-2">
            <Button type="submit" variant="primary" class="w-full" disabled={isLoading}>
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <p class="text-sm text-warm-600">
            Pas encore de compte ?
            <a href="/onboarding" class="text-miel-600 hover:text-miel-700 font-medium">
              Créer un compte
            </a>
          </p>
        </div>
      </Card>
    </FadeIn>

    <FadeIn delay={160}>
      <p class="text-center text-sm text-warm-500 mt-6">
        <a href="/" class="hover:text-warm-700">← Retour à l'accueil</a>
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
