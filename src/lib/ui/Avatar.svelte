<script lang="ts">
  interface Props {
    src?: string;
    alt?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    /** 'child' for adventurer-neutral, 'adult' for notionists-neutral */
    kind?: 'child' | 'adult';
    class?: string;
  }

  let {
    src,
    alt = '',
    name = '',
    size = 'md',
    kind = 'child',
    class: className = ''
  }: Props = $props();

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
    '2xl': 'w-24 h-24 text-2xl'
  };

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  const bgColors = [
    'bg-miel-200 text-miel-700',
    'bg-bleu-400/20 text-bleu-500',
    'bg-mousse-400/20 text-mousse-500',
    'bg-sienne-200 text-sienne-700',
    'bg-argile-400/20 text-argile-500'
  ];

  function getColorFromName(name: string): string {
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % bgColors.length;
    return bgColors[index];
  }

  import { getChildAvatarUrl, getAdultAvatarUrl } from '$lib/utils/avatar';

  let imgError = $state(false);
  const dicebearUrl = $derived(name
    ? (kind === 'adult' ? getAdultAvatarUrl(name) : getChildAvatarUrl(name))
    : '');
</script>

{#if src}
  <img
    {src}
    alt={alt || name}
    class="rounded-full object-cover ring-2 ring-white/40 {sizeClasses[size]} {className}"
  />
{:else if name && !imgError}
  <img
    src={dicebearUrl}
    alt={name}
    class="rounded-full object-cover ring-2 ring-white/40 {sizeClasses[size]} {className}"
    loading="lazy"
    decoding="async"
    onerror={() => imgError = true}
  />
{:else}
  <div
    class="rounded-full flex items-center justify-center font-semibold ring-2 ring-white/40 {sizeClasses[size]} {getColorFromName(name)} {className}"
  >
    {getInitials(name)}
  </div>
{/if}
