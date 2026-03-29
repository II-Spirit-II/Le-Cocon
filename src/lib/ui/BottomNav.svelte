<script lang="ts">
  import { page } from '$app/stores';
  import { fly, fade } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { browser } from '$app/environment';
  import { agentPanelOpen } from '$lib/stores/agent.svelte';
  import {
    Home, BookOpen, Newspaper, Settings, BarChart3, Inbox, MessageSquare,
    UserCheck, ScanLine, QrCode, MoreHorizontal, X
  } from 'lucide-svelte';

  interface Props {
    role: 'assistante' | 'parent';
    badges?: Record<string, number>;
  }

  let { role, badges = {} }: Props = $props();
  let moreOpen = $state(false);

  // Close "more" menu on navigation
  $effect(() => {
    $page.url.pathname;
    moreOpen = false;
  });

  // Primary nav items (4 items + center action)
  const primaryItems = $derived.by(() => {
    if (role === 'parent') {
      return [
        { href: '/app/overview',    label: 'Accueil',    Icon: Home       },
        { href: '/app/attendance',  label: 'Présences',  Icon: UserCheck  },
        // center = Mon QR
        { href: '/app/children',    label: 'Carnet',     Icon: BookOpen   },
        // more menu
      ];
    }
    return [
      { href: '/app/overview',    label: 'Accueil',    Icon: Home       },
      { href: '/app/attendance',  label: 'Présences',  Icon: UserCheck  },
      // center = Scanner
      { href: '/app/children',    label: 'Carnet',     Icon: BookOpen   },
      // more menu
    ];
  });

  // Center action item (visually prominent)
  const centerItem = $derived(
    role === 'parent'
      ? { href: '/app/my-qr', label: 'Mon QR', Icon: QrCode }
      : { href: '/app/scan', label: 'Scanner', Icon: ScanLine }
  );

  // Secondary items shown in the "more" popup
  const moreItems = $derived.by(() => {
    if (role === 'parent') {
      return [
        { href: '/app/notes',     label: 'Notes à l\'assmat', Icon: MessageSquare },
        { href: '/app/feed',      label: 'News',              Icon: Newspaper     },
        { href: '/app/settings',  label: 'Paramètres',        Icon: Settings      },
      ];
    }
    return [
      { href: '/app/inbox',     label: 'Messages',    Icon: Inbox      },
      { href: '/app/feed',      label: 'News',        Icon: Newspaper  },
      { href: '/app/stats',     label: 'Statistiques', Icon: BarChart3 },
      { href: '/app/settings',  label: 'Paramètres',  Icon: Settings   },
    ];
  });

  // Check if any "more" page is currently active
  const moreIsActive = $derived(
    moreItems.some(item => isActive(item.href))
  );

  // Total badge count for "more" items
  const moreBadgeCount = $derived(
    moreItems.reduce((sum, item) => sum + (badges[item.href] ?? 0), 0)
  );

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/app/overview') return path === '/app/overview';
    if (href === '/app/children') return path.startsWith('/app/children');
    if (href === '/app/attendance') return path.startsWith('/app/attendance');
    if (href === '/app/scan') return path === '/app/scan';
    if (href === '/app/my-qr') return path === '/app/my-qr';
    return path.startsWith(href);
  }

  function toggleMore() {
    moreOpen = !moreOpen;
  }
</script>

{#if !$agentPanelOpen}

<!-- More menu backdrop + popup -->
{#if moreOpen}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-nuit/15 backdrop-blur-sm"
    onclick={() => { moreOpen = false; }}
    aria-label="Fermer le menu"
    transition:fade={{ duration: 200 }}
  ></button>
  <div
    class="more-sheet"
    transition:fly={{ y: 20, duration: 250, easing: cubicInOut }}
  >
    {#each moreItems as item (item.href)}
      {@const active = isActive(item.href)}
      {@const NavIcon = item.Icon}
      <a
        href={item.href}
        class="more-item"
        class:more-item-active={active}
      >
        <span class="more-icon">
          <NavIcon size={18} strokeWidth={active ? 2.2 : 1.7} />
          {#if badges[item.href]}
            <span class="btm-badge">{badges[item.href] > 9 ? '9+' : badges[item.href]}</span>
          {/if}
        </span>
        <span class="more-label">{item.label}</span>
      </a>
    {/each}
  </div>
{/if}

<!-- Bottom nav bar -->
<nav
  class="btm-nav"
  aria-label="Navigation principale"
  transition:fly={{ y: 80, duration: 300, easing: cubicInOut }}
>
  <!-- Left items (2) -->
  {#each primaryItems.slice(0, 2) as item (item.href)}
    {@const active = isActive(item.href)}
    {@const NavIcon = item.Icon}
    <a
      href={item.href}
      data-sveltekit-preload-data="hover"
      class="btm-nav-item"
      class:btm-nav-active={active}
      aria-current={active ? 'page' : undefined}
    >
      <span class="btm-nav-icon">
        <NavIcon size={20} strokeWidth={active ? 2.2 : 1.8} />
        {#if badges[item.href]}
          <span class="btm-badge">{badges[item.href] > 9 ? '9+' : badges[item.href]}</span>
        {/if}
      </span>
      <span class="btm-nav-label">{item.label}</span>
    </a>
  {/each}

  <!-- Center action (prominent) -->
  {#each [centerItem] as item (item.href)}
    {@const active = isActive(item.href)}
    {@const CenterIcon = item.Icon}
    <a
      href={item.href}
      data-sveltekit-preload-data="hover"
      class="btm-nav-item btm-center"
      class:btm-nav-active={active}
      aria-current={active ? 'page' : undefined}
    >
      <span class="btm-center-icon">
        <CenterIcon size={22} strokeWidth={2} />
      </span>
      <span class="btm-nav-label">{item.label}</span>
    </a>
  {/each}

  <!-- Right items (1) + More -->
  {#each primaryItems.slice(2) as item (item.href)}
    {@const active = isActive(item.href)}
    {@const NavIcon = item.Icon}
    <a
      href={item.href}
      data-sveltekit-preload-data="hover"
      class="btm-nav-item"
      class:btm-nav-active={active}
      aria-current={active ? 'page' : undefined}
    >
      <span class="btm-nav-icon">
        <NavIcon size={20} strokeWidth={active ? 2.2 : 1.8} />
        {#if badges[item.href]}
          <span class="btm-badge">{badges[item.href] > 9 ? '9+' : badges[item.href]}</span>
        {/if}
      </span>
      <span class="btm-nav-label">{item.label}</span>
    </a>
  {/each}

  <!-- More button -->
  <button
    type="button"
    class="btm-nav-item"
    class:btm-nav-active={moreIsActive || moreOpen}
    onclick={toggleMore}
    aria-expanded={moreOpen}
    aria-label="Plus d'options"
  >
    <span class="btm-nav-icon">
      {#if moreOpen}
        <X size={20} strokeWidth={2} />
      {:else}
        <MoreHorizontal size={20} strokeWidth={1.8} />
        {#if moreBadgeCount > 0}
          <span class="btm-badge">{moreBadgeCount > 9 ? '9+' : moreBadgeCount}</span>
        {/if}
      {/if}
    </span>
    <span class="btm-nav-label">Plus</span>
  </button>
</nav>
{/if}

<style>
  .btm-nav {
    position: fixed;
    bottom: 8px;
    left: 8px;
    right: 8px;
    z-index: 50;
    display: flex;
    align-items: stretch;
    justify-content: space-around;
    height: 58px;
    border-radius: 22px;
    background: rgba(255, 248, 240, 0.7);
    backdrop-filter: blur(28px) saturate(160%);
    -webkit-backdrop-filter: blur(28px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 8px 32px rgba(194, 101, 58, 0.08),
      0 2px 8px rgba(194, 101, 58, 0.04);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  @media (min-width: 1024px) {
    .btm-nav { display: none; }
    .more-sheet { display: none; }
  }

  .btm-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex: 1;
    min-width: 0;
    padding: 6px 4px;
    color: var(--color-warm-400);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.2s ease;
    border: none;
    background: none;
    cursor: pointer;
  }

  .btm-nav-active {
    color: var(--color-miel-600);
  }

  .btm-nav-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 28px;
    border-radius: 14px;
    transition: background-color 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .btm-nav-active .btm-nav-icon {
    background: rgba(232, 145, 58, 0.13);
    transform: translateY(-1px);
  }

  /* Center action — visually prominent */
  .btm-center {
    position: relative;
    flex: 1.15;
  }

  .btm-center-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 16px;
    background: var(--color-miel-500);
    color: white;
    box-shadow: 0 4px 16px rgba(232, 145, 58, 0.3);
    transform: translateY(-6px);
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
  }

  .btm-center:active .btm-center-icon {
    transform: translateY(-4px) scale(0.95);
  }

  .btm-nav-active.btm-center .btm-center-icon {
    background: var(--color-miel-600);
    box-shadow: 0 6px 20px rgba(232, 145, 58, 0.4);
  }

  .btm-center .btm-nav-label {
    margin-top: -4px;
  }

  .btm-nav-label {
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .btm-badge {
    position: absolute;
    top: -2px;
    right: 2px;
    min-width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    font-weight: 700;
    line-height: 1;
    border-radius: 9999px;
    background: var(--color-sienne-500);
    color: white;
    padding: 0 3px;
    box-shadow: 0 1px 4px rgba(194, 101, 58, 0.35);
  }

  /* More popup sheet */
  .more-sheet {
    position: fixed;
    bottom: 76px;
    right: 8px;
    z-index: 45;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    min-width: 180px;
    border-radius: 18px;
    background: rgba(255, 248, 240, 0.88);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 12px 40px rgba(194, 101, 58, 0.12),
      0 4px 12px rgba(194, 101, 58, 0.06);
    padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  }

  .more-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 12px;
    color: var(--color-warm-600);
    text-decoration: none;
    transition: background-color 0.15s ease, color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .more-item:active {
    background: rgba(232, 145, 58, 0.08);
  }

  .more-item-active {
    color: var(--color-miel-600);
    background: rgba(232, 145, 58, 0.08);
  }

  .more-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }

  .more-label {
    font-size: 14px;
    font-weight: 500;
  }

  @media (prefers-reduced-motion: reduce) {
    .btm-nav-icon,
    .btm-center-icon {
      transition: none;
    }
  }
</style>
