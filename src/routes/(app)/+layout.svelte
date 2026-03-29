<script lang="ts">
  import type { Snippet, SvelteComponent } from 'svelte';
  import type { LayoutData } from './$types';
  import { page } from '$app/stores';
  import { goto, onNavigate } from '$app/navigation';
  import { browser } from '$app/environment';
  import { auth } from '$lib/stores/auth';
  import { Avatar, AgentButton, BottomNav } from '$lib/ui';
  import { agentPanelOpen } from '$lib/stores/agent.svelte';
  import {
    Newspaper,
    BookOpen,
    Inbox,
    BarChart3,
    Settings,
    MessageSquare,
    LogOut,
    Home,
    ChevronsLeft,
    UserCheck,
    QrCode,
    ScanLine
  } from 'lucide-svelte';

  // View Transitions API — GPU-accelerated page transitions
  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  interface Props {
    children: Snippet;
    data: LayoutData;
  }

  let { children, data }: Props = $props();

  // Preload AgentPanel on idle so first open is instant
  let AgentPanel: typeof import('$lib/ui/AgentPanel.svelte').default | null = $state(null);
  function loadAgentPanel() {
    if (AgentPanel) return;
    import('$lib/ui/AgentPanel.svelte').then(m => { AgentPanel = m.default; });
  }
  if (browser) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => loadAgentPanel());
    } else {
      setTimeout(() => loadAgentPanel(), 1500);
    }
  }

  let sidebarCollapsed = $state(false);
  $effect(() => {
    if (browser) {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved !== null) sidebarCollapsed = saved === 'true';
    }
  });
  function toggleCollapsed() {
    sidebarCollapsed = !sidebarCollapsed;
    if (browser) localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }

  const unacknowledgedCount = $derived(data.badges?.unacknowledgedNotesCount ?? 0);
  const unseenResponsesCount = $derived(data.badges?.unseenResponsesCount ?? 0);
  const avatarUrl = $derived(data.avatarUrl ?? null);

  interface NavItem {
    href: string;
    label: string;
    Icon: typeof SvelteComponent<any>;
    badge?: number;
  }

  const navItems = $derived(() => {
    const items: NavItem[] = [
      { href: '/app/overview', label: 'Vue d\'ensemble', Icon: Home     },
      { href: '/app/children', label: 'Carnet de suivi', Icon: BookOpen },
      { href: '/app/attendance', label: 'Présences', Icon: UserCheck },
      { href: '/app/feed',     label: 'News',           Icon: Newspaper },
    ];

    if (data.user?.role === 'assistante') {
      items.push({ href: '/app/scan', label: 'Scanner QR', Icon: ScanLine });
      items.push({
        href: '/app/inbox',
        label: 'Boîte de réception',
        Icon: Inbox,
        badge: unacknowledgedCount > 0 ? unacknowledgedCount : undefined
      });
      items.push({ href: '/app/stats', label: 'Statistiques', Icon: BarChart3 });
    } else if (data.user?.role === 'parent') {
      items.push({ href: '/app/my-qr', label: 'Mon QR', Icon: QrCode });
      items.push({
        href: '/app/notes',
        label: "Notes à l'assmat",
        Icon: MessageSquare,
        badge: unseenResponsesCount > 0 ? unseenResponsesCount : undefined
      });
    }

    items.push(
      { href: '/app/settings', label: 'Paramètres', Icon: Settings }
    );

    return items;
  });

  const iconColors: Record<string, string> = {
    '/app/overview':  'text-miel-500',
    '/app/children':  'text-bleu-400',
    '/app/attendance': 'text-mousse-400',
    '/app/scan':      'text-miel-500',
    '/app/my-qr':     'text-miel-500',
    '/app/feed':      'text-sienne-500',
    '/app/inbox':     'text-sable-400',
    '/app/stats':     'text-mousse-400',
    '/app/notes':     'text-soleil-400',
    '/app/settings':  'text-warm-500'
  };

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === '/app/overview') return path === '/app/overview';
    if (href === '/app/children') return path.startsWith('/app/children');
    return path.startsWith(href);
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    auth.logout();
    goto('/');
  }
</script>

<div class="min-h-screen bg-aube overflow-x-hidden relative">

  <!-- Decorative orbs -->
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>

  <!-- Mobile header -->
  <header class="lg:hidden fixed top-0 left-0 right-0 z-50 h-11 mobile-header">
    <div class="flex items-center justify-center h-full px-4 gap-1.5">
      <img src="/favicon.png" alt="Le Cocon" class="w-5 h-5" />
      <span class="font-display font-bold text-sm text-warm-900">Le Cocon</span>
    </div>
  </header>

  <!-- Sidebar (desktop only) -->
  <aside
    class="sidebar-glass fixed top-2 left-2 bottom-2 z-50 flex-col overflow-hidden transition-[width] duration-300 hidden lg:flex
      {sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64'}
      w-64"
  >
    <!-- Logo + collapse toggle -->
    <button
      type="button"
      onclick={toggleCollapsed}
      class="hidden lg:flex items-center border-b border-white/15 shrink-0 sidebar-logo-btn h-14 pl-[18px] pr-4 gap-2.5 relative"
      title={sidebarCollapsed ? 'Déplier la navigation' : 'Replier la navigation'}
      aria-label={sidebarCollapsed ? 'Déplier' : 'Replier'}
    >
      <img src="/favicon.png" alt="Le Cocon" class="w-7 h-7 shrink-0" />
      <!-- Collapsed: small expand chevron right after logo -->
      <span class="sidebar-collapse-icon shrink-0 absolute left-[48px] transition-opacity duration-300
        {sidebarCollapsed ? 'opacity-100' : 'opacity-0'}">
        <ChevronsLeft size={13} class="rotate-180" />
      </span>
      <!-- Expanded: text + collapse chevron at end -->
      <span class="font-display font-bold text-lg text-warm-900 flex-1 truncate text-left whitespace-nowrap transition-opacity duration-300
        {sidebarCollapsed ? 'opacity-0' : 'opacity-100'}">Le Cocon</span>
      <span class="sidebar-collapse-icon shrink-0 transition-opacity duration-300
        {sidebarCollapsed ? 'opacity-0' : 'opacity-100'}">
        <ChevronsLeft size={16} />
      </span>
    </button>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 px-2">
      {#each navItems() as item}
        {@const active = isActive(item.href)}
        {@const NavIcon = item.Icon}

        <a
          href={item.href}
          data-sveltekit-preload-data="hover"
          class="group relative flex items-center gap-3 h-10 rounded-xl pl-[14px] pr-4 nav-link outline-none focus-visible:ring-2 focus-visible:ring-miel-400/50
            {active
              ? (sidebarCollapsed ? 'nav-item-active-compact' : 'nav-item-active') + ' text-miel-700'
              : 'text-warm-700 hover:bg-warm-100/25 hover:text-warm-900'}"
        >
          <NavIcon
            size={20}
            class="shrink-0 {active ? 'text-miel-600' : (iconColors[item.href] ?? 'text-warm-500')}"
          />
          <span class="flex-1 min-w-0 truncate text-sm whitespace-nowrap transition-opacity duration-300
            {sidebarCollapsed ? 'opacity-0' : 'opacity-100'}">
            {item.label}
          </span>
          {#if item.badge}
            <!-- Collapsed: dot on icon corner -->
            <span class="nav-badge-compact transition-opacity duration-300
              {sidebarCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
            <!-- Expanded: pill aligned with label -->
            <span class="nav-badge-expanded transition-opacity duration-300
              {sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}">
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          {/if}
          <!-- Tooltip (collapsed hover) -->
          <span class="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50
            px-2.5 py-1.5 rounded-lg bg-warm-900 text-white text-xs font-medium whitespace-nowrap shadow-lg
            opacity-0 transition-opacity duration-150
            {sidebarCollapsed ? 'group-hover:opacity-100' : ''}">
            {item.label}
            {#if item.badge}
              <span class="ml-1 px-1 py-0.5 rounded bg-miel-500 text-white text-[9px]">{item.badge}</span>
            {/if}
          </span>
        </a>

      {/each}
    </nav>

    <!-- Footer: user (crossfade via absolute layers) -->
    <div class="border-t border-white/15 shrink-0 p-2 relative h-[76px]">
      <!-- Expanded layout -->
      <div class="absolute inset-2 flex items-center gap-3 p-2.5 rounded-xl transition-opacity duration-300
        {sidebarCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 glass-2'}">
        <a href="/app/settings" class="shrink-0">
          <Avatar src={avatarUrl ?? undefined} name={data.user?.name ?? ''} size="sm" kind="adult" />
        </a>
        <div class="flex-1 min-w-0">
          <a href="/app/settings" class="text-sm font-semibold text-warm-900 truncate block hover:text-miel-600 transition-colors">{data.user?.name}</a>
          <p class="text-xs text-warm-500 truncate">
            {data.user?.role === 'assistante' ? 'Assistante maternelle' : 'Parent'}
          </p>
        </div>
        <button
          type="button"
          onclick={handleLogout}
          class="p-1.5 text-warm-400 hover:text-argile-500 transition-colors shrink-0 rounded-lg hover:bg-argile-400/10 outline-none cursor-pointer"
          title="Déconnexion"
        >
          <LogOut size={16} />
        </button>
      </div>
      <!-- Collapsed layout -->
      <div class="absolute inset-2 flex flex-col items-center justify-center gap-2 transition-opacity duration-300
        {sidebarCollapsed ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'}">
        <div class="group relative">
          <a href="/app/settings" class="rounded-xl overflow-hidden outline-none cursor-pointer block">
            <Avatar src={avatarUrl ?? undefined} name={data.user?.name ?? ''} size="sm" kind="adult" />
          </a>
          <span class="pointer-events-none fixed z-100
            px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
            opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style="left: 82px; bottom: 28px; background: rgba(255,248,240,0.9); backdrop-filter: blur(12px); color: var(--color-warm-800); border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 4px 16px rgba(194,101,58,0.12);">
            {data.user?.name}
          </span>
        </div>
        <button
          type="button"
          onclick={handleLogout}
          class="p-2 text-warm-400 hover:text-argile-500 transition-colors rounded-lg hover:bg-argile-400/10 outline-none cursor-pointer"
          title="Déconnexion"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  </aside>

  <main class="relative z-10 pt-11 lg:pt-0 pb-[72px] lg:pb-0 min-h-screen transition-[margin-left] duration-300 min-w-0
    {sidebarCollapsed ? 'lg:ml-[calc(72px+8px)]' : 'lg:ml-[calc(16rem+8px)]'}">
    <div class="p-4 sm:p-6 lg:p-8 page-stagger">
      {@render children()}
    </div>
  </main>

  <AgentButton />
  {#if AgentPanel}
    <AgentPanel childrenNames={data.children?.map((c: { id: string; firstName: string }) => c.firstName) ?? []} />
  {/if}

  {#if data.user?.role}
    <BottomNav
      role={data.user.role}
      badges={{
        '/app/inbox': unacknowledgedCount,
        '/app/notes': unseenResponsesCount,
      }}
    />
  {/if}

</div>

<style>
  .sidebar-glass {
    background: rgba(255, 248, 240, 0.6);
    backdrop-filter: blur(28px) saturate(160%);
    -webkit-backdrop-filter: blur(28px) saturate(160%);
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 8px 40px rgba(194, 101, 58, 0.08),
      0 2px 12px rgba(194, 101, 58, 0.04);
  }

  .nav-link {
    color: var(--color-warm-700);
    transition: color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
  }

  .nav-link::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 44px;
    background: rgba(232, 145, 58, 0.1);
    box-shadow: inset 0 0 0 1px rgba(232, 145, 58, 0.15);
    border-radius: 12px;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .nav-item-active {
    background: rgba(232, 145, 58, 0.1);
    box-shadow: inset 0 0 0 1px rgba(232, 145, 58, 0.15);
  }

  .nav-item-active-compact::before {
    opacity: 1;
  }

  /* Badge: compact mode — small dot on icon top-right */
  .nav-badge-compact {
    position: absolute;
    top: 2px;
    left: 32px;
    min-width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    line-height: 1;
    border-radius: 9999px;
    background: var(--color-sienne-500);
    color: white;
    padding: 0 4px;
    box-shadow: 0 2px 6px rgba(194, 101, 58, 0.3);
  }

  /* Badge: expanded mode — pill aligned right of label */
  .nav-badge-expanded {
    flex-shrink: 0;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    border-radius: 9999px;
    background: var(--color-sienne-500);
    color: white;
    padding: 0 5px;
    box-shadow: 0 2px 6px rgba(194, 101, 58, 0.25);
  }

  .sidebar-logo-btn {
    cursor: pointer;
    background: none;
    border: none;
    outline: none;
    transition: background 0.2s, box-shadow 0.2s;
  }

  .sidebar-logo-btn:hover {
    background: rgba(232, 145, 58, 0.06);
  }

  .sidebar-collapse-icon {
    transition: opacity 0.2s, transform 0.3s;
    color: #9C826A;
  }

  .sidebar-logo-btn:hover .sidebar-collapse-icon {
    color: #C2653A;
  }

  .mobile-header {
    background: rgba(255, 248, 240, 0.85);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  }

  /* Decorative warm orbs */
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
    animation-delay: 0s;
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
