<script lang="ts">
  import { page } from '$app/stores';
  import { fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import { agentPanelOpen } from '$lib/stores/agent.svelte';
  import {
    Home, BookOpen, Newspaper, Settings, BarChart3, Inbox, MessageSquare
  } from 'lucide-svelte';

  interface Props {
    role: 'assistante' | 'parent';
    badges?: Record<string, number>;
  }

  let { role, badges = {} }: Props = $props();

  const items = $derived.by(() => {
    if (role === 'parent') {
      return [
        { href: '/app/children',  label: 'Carnet',      Icon: BookOpen  },
        { href: '/app/feed',      label: 'News',       Icon: Newspaper },
        { href: '/app/overview',  label: 'Accueil',     Icon: Home      },
        { href: '/app/notes',     label: 'Notes',       Icon: MessageSquare },
        { href: '/app/settings',  label: 'Paramètres',  Icon: Settings  },
      ];
    }
    return [
      { href: '/app/children',  label: 'Carnet',      Icon: BookOpen  },
      { href: '/app/feed',      label: 'News',       Icon: Newspaper },
      { href: '/app/overview',  label: 'Accueil',     Icon: Home      },
      { href: '/app/inbox',     label: 'Messages',    Icon: Inbox     },
      { href: '/app/settings',  label: 'Paramètres',  Icon: Settings  },
    ];
  });

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/app/overview') return path === '/app/overview';
    if (href === '/app/children') return path.startsWith('/app/children');
    return path.startsWith(href);
  }
</script>

{#if !$agentPanelOpen}
<nav
  class="btm-nav"
  aria-label="Navigation principale"
  transition:fly={{ y: 80, duration: 300, easing: cubicInOut }}
>
  {#each items as item (item.href)}
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
    background: rgba(255, 248, 240, 0.65);
    backdrop-filter: blur(28px) saturate(160%);
    -webkit-backdrop-filter: blur(28px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 8px 32px rgba(194, 101, 58, 0.08),
      0 2px 8px rgba(194, 101, 58, 0.04);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  /* Hide on desktop — tablet and up */
  @media (min-width: 1024px) {
    .btm-nav {
      display: none;
    }
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

  @media (prefers-reduced-motion: reduce) {
    .btm-nav-icon {
      transition: none;
    }
  }
</style>
