<script lang="ts">
  import type { PageData } from './$types';
  import { PageHeader, Card, Button, Avatar, FadeIn } from '$lib/ui';
  import {
    Baby, Zap, UtensilsCrossed, BookOpen, ChevronRight, UserPlus
  } from 'lucide-svelte';

  interface Props { data: PageData; }
  let { data }: Props = $props();

  const isAsmmat = $derived(data.user?.role === 'assistante');

  function calculateAge(birthDate: string): string {
    const birth = new Date(birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (months < 12) return `${months} mois`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (rem === 0) return `${years} an${years > 1 ? 's' : ''}`;
    return `${years} an${years > 1 ? 's' : ''} et ${rem} mois`;
  }
</script>

<PageHeader
  title="Carnet de suivi"
  description="Sélectionnez un enfant pour voir son suivi"
>
  {#snippet actions()}
    {#if isAsmmat}
      <Button variant="primary" href="/app/children/add">
        <UserPlus size={16} />
        Ajouter un enfant
      </Button>
    {/if}
  {/snippet}
</PageHeader>

<!-- Action bar (assistante only) -->
{#if isAsmmat && data.children.length > 0}
  <FadeIn delay={0}>
    <div class="action-bar glass-1 rounded-3xl p-1.5 mb-6">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        <a href="/app/journal/batch"
          class="action-btn flex flex-col items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl hover:bg-miel-500/10 transition-colors text-center">
          <div class="w-9 h-9 rounded-xl bg-miel-100 flex items-center justify-center">
            <Zap size={17} class="text-miel-600" />
          </div>
          <p class="text-sm font-semibold text-warm-900">Saisie rapide</p>
          <p class="text-[11px] text-warm-500 -mt-1">Tous les enfants</p>
        </a>

        <a href="/app/journal/menu"
          class="action-btn flex flex-col items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl hover:bg-sienne-400/8 transition-colors text-center">
          <div class="w-9 h-9 rounded-xl bg-sienne-100 flex items-center justify-center">
            <UtensilsCrossed size={17} class="text-sienne-600" />
          </div>
          <p class="text-sm font-semibold text-warm-900">Menu du jour</p>
          <p class="text-[11px] text-warm-500 -mt-1">Définir les repas</p>
        </a>

        <a href="/app/journal/new"
          class="action-btn flex flex-col items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl hover:bg-bleu-400/8 transition-colors text-center">
          <div class="w-9 h-9 rounded-xl bg-bleu-100 flex items-center justify-center">
            <BookOpen size={17} class="text-bleu-500" />
          </div>
          <p class="text-sm font-semibold text-warm-900">Carnet individuel</p>
          <p class="text-[11px] text-warm-500 -mt-1">Fiche détaillée</p>
        </a>
      </div>
    </div>
  </FadeIn>
{/if}

<!-- Children grid -->
{#if data.children.length === 0}
  <FadeIn delay={60}>
    <Card padding="lg">
      <div class="text-center py-12">
        <div class="w-16 h-16 rounded-2xl bg-warm-100/60 flex items-center justify-center mx-auto mb-4">
          <Baby size={32} class="text-warm-400" />
        </div>
        {#if isAsmmat}
          <h3 class="text-xl font-display font-bold text-warm-900 mb-2">Aucun enfant pour l'instant</h3>
          <p class="text-warm-600 mb-6 max-w-md mx-auto">
            Commencez par ajouter les enfants dont vous avez la garde.
            Vous pourrez ensuite générer des codes d'invitation pour leurs parents.
          </p>
          <Button variant="primary" href="/app/children/add">Ajouter un enfant</Button>
        {:else}
          <h3 class="text-xl font-display font-bold text-warm-900 mb-2">Aucun enfant associé</h3>
          <p class="text-warm-600 mb-6 max-w-md mx-auto">
            Vous n'avez pas encore d'enfants associés à votre compte.
            Demandez un code d'invitation à votre assistante maternelle.
          </p>
          <Button variant="primary" href="/app/settings/invite">Utiliser un code d'invitation</Button>
        {/if}
      </div>
    </Card>
  </FadeIn>
{:else}
  <div class="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
    {#each data.children as child, i (child.id)}
      <FadeIn delay={60 + i * 30}>
        <a href="/app/children/{child.id}" class="child-card group block">
          <Card padding="none" hover class="h-full">
            <div class="p-4 sm:p-5 flex flex-col items-center text-center">
              <!-- Avatar -->
              <div class="mb-3 relative">
                <Avatar name={child.firstName} size="xl" />
                <div class="absolute inset-0 rounded-2xl ring-2 ring-transparent group-hover:ring-miel-400/30 transition-all duration-300"></div>
              </div>

              <!-- Name -->
              <h3 class="font-display font-bold text-warm-900 text-sm sm:text-base truncate w-full">
                {child.firstName}
              </h3>
              <p class="text-[11px] sm:text-xs text-warm-500 mt-0.5">{child.lastName}</p>

              <!-- Age -->
              <p class="text-[10px] sm:text-[11px] text-warm-400 mt-1.5 font-medium">
                {calculateAge(child.birthDate)}
              </p>

              <!-- Hover arrow -->
              <div class="mt-3 pt-3 border-t border-warm-100/30 w-full flex items-center justify-center gap-1
                text-[11px] font-semibold text-warm-400 group-hover:text-miel-600 transition-colors">
                Voir le profil
                <ChevronRight size={12} class="group-hover:translate-x-0.5 transition-transform duration-200" />
              </div>
            </div>
          </Card>
        </a>
      </FadeIn>
    {/each}
  </div>
{/if}
