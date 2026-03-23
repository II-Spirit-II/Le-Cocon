<script lang="ts">
  import { enhance } from '$app/forms';
  import { PageHeader, Card, Button, Section, Callout } from '$lib/ui';
  import type { PageData, ActionData } from './$types';
  import type { Menu } from '$lib/types';
  import { Sunrise, Sun, Apple, Calendar, Info } from 'lucide-svelte';

  interface Props {
    data: PageData;
    form: ActionData;
  }

  let { data, form }: Props = $props();

  const mealTypes = [
    { key: 'petit-dejeuner', label: 'Petit-déjeuner', icon: Sunrise, placeholder: "Ex: Lait chaud, tartines beurrées, jus d'orange" },
    { key: 'dejeuner', label: 'Déjeuner', icon: Sun, placeholder: 'Ex: Poulet rôti, haricots verts, purée de pommes de terre' },
    { key: 'gouter', label: 'Goûter', icon: Apple, placeholder: 'Ex: Compote de pommes, gâteau maison, eau' }
  ];

  function getMenuDescription(mealType: string): string {
    return data.menus.find((m: Menu) => m.mealType === mealType)?.description ?? '';
  }

  let isSaving = $state(false);

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
</script>

<PageHeader
  title="Menu du jour"
  description="Définissez le menu global pour tous les enfants"
>
  {#snippet actions()}
    <Button variant="ghost" href="/app/overview">
      ← Retour
    </Button>
  {/snippet}
</PageHeader>

<div class="max-w-2xl space-y-6">
  {#if form?.success}
    <Callout variant="success">{form.message}</Callout>
  {/if}
  {#if form?.error}
    <Callout variant="warning">{form.error}</Callout>
  {/if}

  <!-- Date du jour -->
  <div class="flex items-center gap-3 px-4 py-3 bg-miel-50 rounded-xl border border-miel-100">
    <Calendar size={24} class="text-miel-600 shrink-0" />
    <div>
      <p class="text-sm text-miel-600 font-medium">Date</p>
      <p class="font-semibold text-miel-900 capitalize">{formatDate(data.today)}</p>
    </div>
  </div>

  <!-- Formulaire menu -->
  <Card padding="md">
    <Section title="Menu du jour">
      <form
        method="POST"
        action="?/saveMenu"
        use:enhance={() => {
          isSaving = true;
          return async ({ update }) => {
            isSaving = false;
            await update();
          };
        }}
        class="space-y-5"
      >
        <input type="hidden" name="date" value={data.today} />

        {#each mealTypes as meal}
          {@const MealIcon = meal.icon}
          <div class="space-y-2">
            <label for="meal-{meal.key}" class="flex items-center gap-2 text-sm font-medium text-warm-800">
              <MealIcon size={18} class="text-warm-600" />
              {meal.label}
              {#if data.menus.find((m: Menu) => m.mealType === meal.key)}
                <span class="text-xs font-normal text-mousse-500 bg-mousse-400/15 px-2 py-0.5 rounded-full">
                  Enregistré
                </span>
              {/if}
            </label>
            <textarea
              id="meal-{meal.key}"
              name={meal.key}
              rows="2"
              placeholder={meal.placeholder}
              value={getMenuDescription(meal.key)}
              class="block w-full rounded-xl border-warm-300 bg-warm-50 px-4 py-3 text-warm-900
                     placeholder:text-warm-500 focus-visible:border-miel-500 focus-visible:ring-miel-500
                     transition-colors resize-none text-sm"
            ></textarea>
          </div>
        {/each}

        <div class="pt-2">
          <Button type="submit" variant="primary" disabled={isSaving} class="w-full sm:w-auto">
            {isSaving ? 'Enregistrement...' : 'Sauvegarder le menu'}
          </Button>
        </div>
      </form>
    </Section>
  </Card>

  <!-- Info card -->
  <Card padding="md">
    <div class="flex gap-3">
      <Info size={24} class="text-warm-700 shrink-0 mt-0.5" />
      <div class="text-sm text-warm-700 space-y-1">
        <p class="font-medium text-warm-800">À savoir</p>
        <p>Le menu du jour est visible par tous les parents dans le carnet de leur enfant.</p>
        <p>Les descriptions du menu seront pré-remplies lors de la <a href="/app/journal/batch" class="text-miel-600 underline">saisie rapide</a>.</p>
      </div>
    </div>
  </Card>
</div>
