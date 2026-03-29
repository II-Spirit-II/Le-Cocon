<script lang="ts">
  import { tick } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import { page } from '$app/state';
  import { Sparkles, X, Send, CircleCheckBig, CircleX, ChevronRight, Minus, Plus, Trash2, MapPin } from 'lucide-svelte';
  import { agentPanelOpen } from '$lib/stores/agent.svelte';
  import { isAssistante, currentUser } from '$lib/stores/auth';
  import PlateVisual from './PlateVisual.svelte';
  import type { ActionResult } from '$lib/types';
  import type { MealLevel, MoodLevel } from '$lib/types';

  // ── Types locaux ────────────────────────────────────────────────────────
  interface AgentMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    loading?: boolean;
    action?: ActionResult;
    timestamp: number;
  }

  interface MenuRef {
    mealType: string;
    description: string;
    id: string;
  }

  interface ChildOption {
    id: string;
    name: string;
  }

  type FollowUpPayload =
    | { type: 'journal_form'; childId: string; childName: string; menus: MenuRef[]; partial?: { mood?: MoodLevel } }
    | { type: 'child_picker'; childOptions: ChildOption[]; pendingAction: 'create_journal' | 'create_news' }
    | { type: 'news_content'; childId: string; childName: string }
    | { type: 'confirm_action'; action: 'create_journal' | 'create_news'; childId: string | null; childName?: string };

  interface NewsContentState {
    childId: string;
    childName: string;
    inputValue: string;
  }

  type JournalStep = 'mood' | 'meals' | 'nap' | 'changes' | 'health' | 'health_note';

  interface JournalFormState {
    childId: string;
    childName: string;
    mood: MoodLevel;
    menus: MenuRef[];
    currentStep: JournalStep;
    napQuality?: string;
    changes?: number;
    hasHealth?: boolean;
    healthNote?: string;
  }

  // ── Props ───────────────────────────────────────────────────────────────
  interface Props {
    childrenNames?: string[];
  }

  let { childrenNames = [] }: Props = $props();

  // ── State ───────────────────────────────────────────────────────────────
  let messages = $state<AgentMessage[]>([]);
  let inputValue = $state('');
  let isLoading = $state(false);
  let messagesEl = $state<HTMLDivElement | null>(null);
  let journalForm = $state<JournalFormState | null>(null);
  let childPickerOptions = $state<ChildOption[] | null>(null);
  let childPickerAction = $state<'create_journal' | 'create_news' | null>(null);
  let newsContent = $state<NewsContentState | null>(null);

  let pendingConfirm = $state<{ action: 'create_journal' | 'create_news'; childId: string | null; childName?: string } | null>(null);
  let pendingMeals = $state<Record<string, MealLevel | null>>({});
  let pendingChanges = $state(3);
  let pendingHealthNote = $state('');

  // ── Derived ─────────────────────────────────────────────────────────────

  const contextLabel = $derived.by(() => {
    const path = page.url.pathname;
    if (/\/app\/children\/[0-9a-f-]{36}/.test(path)) return 'Fiche enfant';
    if (path.startsWith('/app/journal'))  return 'Carnet';
    if (path.startsWith('/app/feed'))     return 'News';
    if (path.startsWith('/app/overview')) return "Vue d'ensemble";
    if (path.startsWith('/app/stats')) return 'Statistiques';
    if (path.startsWith('/app/inbox'))    return 'Boîte de réception';
    if (path.startsWith('/app/menus'))    return 'Menus';
    if (path.startsWith('/app/notes'))    return 'Notes parents';
    if (path.startsWith('/app/children')) return 'Enfants';
    if (path.startsWith('/app/settings')) return 'Paramètres';
    return null;
  });

  const welcomeMessage = $derived.by(() => {
    const firstName = ($currentUser?.name ?? '').split(' ')[0];
    if ($isAssistante) {
      return `Bonjour ${firstName} ! Je peux créer des carnets, publier des news ou répondre à vos questions.`;
    }
    return `Bonjour ${firstName} ! Posez-moi vos questions sur la journée de votre enfant.`;
  });

  const suggestions = $derived.by(() => {
    const path = page.url.pathname;
    const names = childrenNames.length > 0 ? childrenNames : [];
    const n1 = names[0] ?? '';
    const n2 = names.length > 1 ? names[1] : n1;

    if (!$isAssistante) {
      return [
        'Comment s\'est passée la journée ?',
        'Qu\'a mangé mon enfant ?',
        'La sieste s\'est bien passée ?',
      ];
    }

    if (path.startsWith('/app/journal')) {
      return [
        n1 ? `Crée le carnet de ${n1}` : 'Crée le carnet',
        n2 ? `Résumé de la semaine de ${n2}` : 'Résumé de la semaine',
        'Qui n\'a pas de carnet aujourd\'hui ?',
      ];
    }

    if (path.startsWith('/app/feed')) {
      return [
        n1 ? `Publie une news pour ${n1}` : 'Publie une news',
        n2 ? `${n2} a fait quelque chose de génial aujourd'hui !` : 'Annonce du jour',
        'Qu\'est-ce qui a été publié récemment ?',
      ];
    }

    if (/\/app\/children\/[0-9a-f-]{36}/.test(path)) {
      return [
        'Comment s\'est passée la journée ?',
        'Crée le carnet',
        'Publie une news',
      ];
    }

    if (path.startsWith('/app/overview')) {
      return [
        n1 ? `Résumé de la semaine de ${n1}` : 'Résumé de la semaine',
        'Qui n\'a pas de carnet aujourd\'hui ?',
        n2 ? `Crée le carnet de ${n2}` : 'Crée le carnet',
      ];
    }

    if (path.startsWith('/app/menus')) {
      return [
        'Qu\'est-ce qu\'on mange aujourd\'hui ?',
        n1 ? `Crée le carnet de ${n1}` : 'Crée le carnet',
        n2 ? `Publie une news pour ${n2}` : 'Publie une news',
      ];
    }

    // Default
    return [
      n1 ? `Crée le carnet de ${n1}` : 'Crée le carnet',
      n2 ? `Publie une news, ${n2} a peint un super tableau !` : 'Publie une news',
      n1 ? `Comment s'est passée la semaine de ${n1} ?` : 'Résumé de la semaine',
    ];
  });

  const inputPlaceholder = $derived.by(() => {
    const path = page.url.pathname;

    if (/\/app\/children\/[0-9a-f-]{36}/.test(path)) {
      return 'Une question sur cet enfant ?';
    }
    if (path.startsWith('/app/journal')) {
      return 'Créer un carnet, poser une question...';
    }
    if (path.startsWith('/app/feed')) {
      return 'Publier une news, poser une question...';
    }
    if (path.startsWith('/app/overview')) {
      return 'Resume, question sur un enfant...';
    }
    if (path.startsWith('/app/menus')) {
      return 'Question sur les menus...';
    }
    return 'Posez une question ou donnez une instruction...';
  });

  const MEAL_LABELS: Record<string, string> = {
    'petit-dejeuner': 'Petit-déj.',
    'dejeuner': 'Déjeuner',
    'gouter': 'Goûter',
  };

  const LEVEL_LABELS: Record<number, string> = {
    0: 'Pas mangé',
    1: 'Peu mangé',
    2: 'Bien mangé',
    3: 'Très bien',
  };

  const MOOD_OPTIONS: { value: MoodLevel; label: string }[] = [
    { value: 'joyeux',  label: 'Joyeux' },
    { value: 'calme',   label: 'Calme' },
    { value: 'grognon', label: 'Grognon' },
  ];

  const NAP_OPTIONS = [
    { value: 'paisible', label: 'Paisible' },
    { value: 'normale',  label: 'Normale' },
    { value: 'agitee',   label: 'Agitée' },
    { value: 'none',     label: 'Pas de sieste' },
  ];

  // ── Functions ───────────────────────────────────────────────────────────

  function clearConversation() {
    messages = [];
    journalForm = null;
    childPickerOptions = null;
    childPickerAction = null;
    newsContent = null;
    pendingConfirm = null;
    inputValue = '';
    pendingMeals = {};
    pendingChanges = 3;
    pendingHealthNote = '';
  }

  function createMessage(role: 'user' | 'assistant', content: string, extra?: Partial<AgentMessage>): AgentMessage {
    return { id: crypto.randomUUID(), role, content, timestamp: Date.now(), ...extra };
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? inputValue).trim();
    if (!msg || isLoading) return;

    inputValue = '';

    const history = messages
      .filter(m => !m.loading)
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content }));

    messages = [...messages, createMessage('user', msg)];

    const loadingId = crypto.randomUUID();
    messages = [...messages, { id: loadingId, role: 'assistant', content: '', loading: true, timestamp: Date.now() }];

    isLoading = true;
    await tick();
    scrollToBottom();

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          contextPath: page.url.pathname,
          conversationHistory: history
        })
      });

      const data = await res.json() as {
        reply: string;
        action?: ActionResult;
        followUp?: FollowUpPayload;
      };

      messages = messages.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, content: data.reply, action: data.action }
          : m
      );

      if (data.followUp?.type === 'confirm_action') {
        pendingConfirm = {
          action: data.followUp.action,
          childId: data.followUp.childId,
          childName: data.followUp.childName,
        };
      } else if (data.followUp?.type === 'journal_form') {
        const initMeals: Record<string, MealLevel | null> = {};
        for (const m of data.followUp.menus) initMeals[m.mealType] = null;
        pendingMeals = initMeals;
        pendingChanges = 3;
        pendingHealthNote = '';

        journalForm = {
          childId: data.followUp.childId,
          childName: data.followUp.childName,
          mood: data.followUp.partial?.mood ?? 'calme',
          menus: data.followUp.menus,
          currentStep: 'mood',
        };

        await tick();
        const childFirstName = data.followUp.childName.split(' ')[0];
        messages = [...messages, createMessage('assistant', `Comment avez-vous trouve ${childFirstName} aujourd'hui ?`)];
      } else if (data.followUp?.type === 'child_picker') {
        childPickerOptions = data.followUp.childOptions;
        childPickerAction = data.followUp.pendingAction;
      } else if (data.followUp?.type === 'news_content') {
        newsContent = { childId: data.followUp.childId, childName: data.followUp.childName, inputValue: '' };
      }
    } catch {
      messages = messages.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, content: 'Erreur de connexion. Veuillez reessayer.' }
          : m
      );
    } finally {
      isLoading = false;
      await tick();
      scrollToBottom();
    }
  }

  async function answerMood(mood: MoodLevel) {
    if (!journalForm) return;
    const label = MOOD_OPTIONS.find(o => o.value === mood)?.label ?? mood;
    messages = [...messages, createMessage('user', label)];
    journalForm = { ...journalForm, mood, currentStep: 'meals' };
    await tick();
    messages = [...messages, createMessage('assistant', 'Comment se sont passes les repas ?')];
    scrollToBottom();
  }

  async function answerMeals() {
    if (!journalForm) return;
    const summary = journalForm.menus
      .map(m => {
        const level = pendingMeals[m.mealType];
        return level !== null && level !== undefined
          ? `${MEAL_LABELS[m.mealType] ?? m.mealType}: ${LEVEL_LABELS[level]}`
          : null;
      })
      .filter(Boolean)
      .join(', ');
    messages = [...messages, createMessage('user', summary || 'Repas non renseignes')];
    journalForm = { ...journalForm, currentStep: 'nap' };
    await tick();
    messages = [...messages, createMessage('assistant', 'Et la sieste ?')];
    scrollToBottom();
  }

  async function answerNap(quality: string) {
    if (!journalForm) return;
    const label = NAP_OPTIONS.find(o => o.value === quality)?.label ?? quality;
    messages = [...messages, createMessage('user', label)];
    journalForm = { ...journalForm, napQuality: quality, currentStep: 'changes' };
    await tick();
    messages = [...messages, createMessage('assistant', 'Combien de changes aujourd\'hui ?')];
    scrollToBottom();
  }

  async function answerChanges() {
    if (!journalForm) return;
    messages = [...messages, createMessage('user', `${pendingChanges} change${pendingChanges > 1 ? 's' : ''}`)];
    journalForm = { ...journalForm, changes: pendingChanges, currentStep: 'health' };
    await tick();
    messages = [...messages, createMessage('assistant', 'Y a-t-il quelque chose a signaler au niveau de la sante ?')];
    scrollToBottom();
  }

  async function answerHealth(hasHealth: boolean) {
    if (!journalForm) return;
    messages = [...messages, createMessage('user', hasHealth ? 'Oui' : 'Non, rien a signaler')];
    if (hasHealth) {
      journalForm = { ...journalForm, hasHealth: true, currentStep: 'health_note' };
      await tick();
      messages = [...messages, createMessage('assistant', 'Decrivez brievement ce qui est a signaler :')];
      scrollToBottom();
    } else {
      journalForm = { ...journalForm, hasHealth: false };
      await submitJournal();
    }
  }

  async function answerHealthNote() {
    if (!journalForm || !pendingHealthNote.trim()) return;
    messages = [...messages, createMessage('user', pendingHealthNote)];
    const note = pendingHealthNote;
    pendingHealthNote = '';
    journalForm = { ...journalForm, healthNote: note };
    await submitJournal();
  }

  async function submitJournal() {
    if (!journalForm) return;
    const form = journalForm;
    const mealsSnapshot = { ...pendingMeals };
    journalForm = null;

    const loadingId = crypto.randomUUID();
    messages = [...messages, { id: loadingId, role: 'assistant', content: '', loading: true, timestamp: Date.now() }];
    isLoading = true;
    await tick();
    scrollToBottom();

    const menuId = form.menus.find(m => m.mealType === 'dejeuner')?.id ?? null;

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '__journal_form__',
          contextPath: page.url.pathname,
          conversationHistory: [],
          journalData: {
            childId: form.childId,
            childName: form.childName,
            mood: form.mood,
            napQuality: form.napQuality ?? 'none',
            meals: form.menus.map(m => ({
              type: m.mealType,
              description: m.description,
              level: mealsSnapshot[m.mealType] ?? null,
            })),
            changes: form.changes ?? pendingChanges,
            hasHealth: form.hasHealth ?? false,
            healthNote: form.healthNote ?? '',
            menuId,
          },
        }),
      });

      const data = await res.json() as { reply: string; action?: ActionResult };
      messages = messages.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, content: data.reply, action: data.action }
          : m
      );
    } catch {
      messages = messages.map(m =>
        m.id === loadingId
          ? { ...m, loading: false, content: 'Erreur lors de la création du carnet.' }
          : m
      );
    } finally {
      isLoading = false;
      await tick();
      scrollToBottom();
    }
  }

  async function selectChild(child: ChildOption) {
    const action = childPickerAction;
    childPickerOptions = null;
    childPickerAction = null;

    if (action === 'create_journal') {
      await sendMessage(`fais le carnet de ${child.name}`);
    } else if (action === 'create_news') {
      messages = [...messages, createMessage('user', child.name)];
      await tick();
      messages = [...messages, createMessage('assistant', `Que souhaitez-vous annoncer pour ${child.name} ?`)];
      newsContent = { childId: child.id, childName: child.name, inputValue: '' };
    }
  }

  async function confirmAction() {
    if (!pendingConfirm) return;
    const { action, childName } = pendingConfirm;
    pendingConfirm = null;
    messages = [...messages, createMessage('user', 'Oui, c\'est ça')];

    const actionVerb = action === 'create_journal' ? 'crée le carnet' : 'publie une news';
    const suffix = childName ? ` de ${childName}` : '';
    await sendMessage(`${actionVerb}${suffix}`);
  }

  async function declineAction() {
    if (!pendingConfirm) return;
    pendingConfirm = null;
    messages = [...messages, createMessage('user', 'Non, ce n\'est pas ce que je voulais')];
    await tick();
    messages = [...messages, createMessage('assistant', 'D\'accord ! N\'hésitez pas à reformuler votre demande.')];
    scrollToBottom();
  }

  async function submitNews() {
    if (!newsContent || !newsContent.inputValue.trim()) return;
    const { childId, childName, inputValue: content } = newsContent;
    newsContent = null;

    messages = [...messages, createMessage('user', content.trim())];

    const loadingId = crypto.randomUUID();
    messages = [...messages, { id: loadingId, role: 'assistant', content: '', loading: true, timestamp: Date.now() }];
    isLoading = true;
    await tick();
    scrollToBottom();

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '__news_form__',
          contextPath: page.url.pathname,
          conversationHistory: [],
          newsData: { childId, content: content.trim() },
        }),
      });
      const data = await res.json() as { reply: string; action?: ActionResult };
      messages = messages.map(m =>
        m.id === loadingId ? { ...m, loading: false, content: data.reply, action: data.action } : m
      );
    } catch {
      messages = messages.map(m =>
        m.id === loadingId ? { ...m, loading: false, content: 'Erreur lors de la publication.' } : m
      );
    } finally {
      isLoading = false;
      await tick();
      scrollToBottom();
    }
  }

  function handleNewsContentKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitNews(); }
  }

  function scrollToBottom() {
    if (messagesEl) {
      messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function handleHealthNoteKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); answerHealthNote(); }
  }

  function closePanel() {
    $agentPanelOpen = false;
  }
</script>

<!-- Backdrop — always in DOM, fades via CSS -->
<div
  class="agent-backdrop fixed inset-0 z-50 {$agentPanelOpen ? 'agent-backdrop-visible' : 'pointer-events-none'}"
  onclick={closePanel}
  onkeydown={e => e.key === 'Escape' && closePanel()}
  role="button"
  tabindex="-1"
  aria-label="Fermer l'agent"
  aria-hidden={!$agentPanelOpen}
></div>

<!-- Panel — always in DOM, slides via CSS transform -->
<div
  class="agent-panel fixed top-2 right-2 bottom-2 w-[calc(100%-16px)] sm:w-[440px] z-50 flex flex-col overflow-hidden
    {$agentPanelOpen ? 'agent-panel-open' : 'pointer-events-none'}"
  aria-hidden={!$agentPanelOpen}
>
    <!-- Header -->
    <header class="agent-header shrink-0">
      <div class="flex items-center gap-3 px-5 py-3.5">
        <div class="agent-sparkle-icon">
          <Sparkles size={14} class="text-white" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-bold text-warm-800 leading-tight tracking-tight">Assistant IA</p>
        </div>
        <div class="flex items-center gap-1">
          {#if messages.length > 0}
            <button
              type="button"
              onclick={clearConversation}
              class="agent-header-btn"
              aria-label="Effacer la conversation"
              title="Effacer la conversation"
              transition:scale={{ duration: 150, start: 0.8 }}
            >
              <Trash2 size={13} />
            </button>
          {/if}
          <button
            type="button"
            onclick={closePanel}
            class="agent-header-btn"
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </header>

    <!-- Messages zone -->
    <div
      bind:this={messagesEl}
      class="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0 agent-messages-zone"
    >
      <!-- Welcome -->
      {#if messages.length === 0}
        <div class="msg-appear" style="--delay: 0ms">
          <div class="flex justify-start">
            <div class="agent-bubble-assistant">
              {welcomeMessage}
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-1.5 pt-2">
          {#each suggestions as suggestion, i}
            <button
              type="button"
              onclick={() => sendMessage(suggestion)}
              class="suggestion-chip msg-appear"
              style="--delay: {(i + 1) * 100}ms"
            >
              <span class="suggestion-arrow"><ChevronRight size={12} /></span>
              <span>{suggestion}</span>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Messages history -->
      {#each messages as msg (msg.id)}
        {#if msg.role === 'user'}
          <div class="flex justify-end" in:fly={{ y: 20, duration: 400, easing: backOut, delay: 30 }}>
            <div class="agent-bubble-user">
              <span class="bubble-text">{msg.content}</span>
              <div class="bubble-glow" aria-hidden="true"></div>
            </div>
          </div>

        {:else if msg.loading}
          <div class="flex justify-start" in:fade={{ duration: 200 }}>
            <div class="agent-bubble-assistant shimmer-container">
              <div class="shimmer-orb"></div>
              <div class="shimmer-lines">
                <div class="shimmer-line"></div>
                <div class="shimmer-line short"></div>
              </div>
            </div>
          </div>

        {:else}
          <div class="flex justify-start" in:fly={{ y: 16, duration: 350, easing: backOut, delay: 50 }}>
            <div class="max-w-[88%] flex flex-col gap-1.5">
              <div class="agent-bubble-assistant">
                {msg.content}
              </div>

              {#if msg.action}
                <div
                  class="action-card {msg.action.success ? 'action-card-success' : 'action-card-error'}"
                  in:scale={{ duration: 280, start: 0.9, easing: backOut, delay: 120 }}
                >
                  <div class="action-card-icon {msg.action.success ? 'action-icon-success' : 'action-icon-error'}">
                    {#if msg.action.success}
                      <CircleCheckBig size={13} />
                    {:else}
                      <CircleX size={13} />
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-semibold {msg.action.success ? 'text-mousse-700' : 'text-argile-500'}">
                      {msg.action.message}
                    </p>
                    {#if msg.action.success && msg.action.resourcePath && msg.action.resourceLabel}
                      <a
                        href={msg.action.resourcePath}
                        onclick={closePanel}
                        class="mt-0.5 text-[10px] text-emerald-600 hover:text-emerald-800 font-medium
                               flex items-center gap-0.5 transition-colors"
                      >
                        {msg.action.resourceLabel}
                        <ChevronRight size={9} />
                      </a>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <!-- Context indicator + Input zone -->
    <div class="agent-input-zone px-4 py-3 shrink-0">
      {#if contextLabel}
        {#key contextLabel}
          <div class="context-badge" in:fly={{ y: 6, duration: 300, easing: backOut }}>
            <MapPin size={10} class="context-badge-icon" />
            <span>Vous etes sur <strong>{contextLabel}</strong></span>
            <span class="context-badge-dot"></span>
            <span class="context-badge-aware">Pris en compte</span>
          </div>
        {/key}
      {/if}

      {#if pendingConfirm}
        <div class="agent-form-card" transition:fly={{ y: 20, duration: 280, easing: backOut }}>
          <div class="flex gap-2">
            <button
              type="button"
              onclick={confirmAction}
              class="agent-primary-btn flex-1"
            >
              Oui, c'est ca
            </button>
            <button
              type="button"
              onclick={declineAction}
              class="option-chip flex-1 justify-center"
            >
              Non, pas ca
            </button>
          </div>
        </div>

      {:else if childPickerOptions}
        <div class="agent-form-card" transition:fly={{ y: 20, duration: 280, easing: backOut }}>
          <p class="form-label">Choisir un enfant</p>
          <div class="flex flex-wrap gap-2">
            {#each childPickerOptions as child, i}
              <button
                type="button"
                onclick={() => selectChild(child)}
                class="option-chip"
                style="animation-delay: {i * 60}ms"
              >
                {child.name}
              </button>
            {/each}
          </div>
        </div>

      {:else if newsContent}
        <div class="agent-form-card" transition:fly={{ y: 20, duration: 280, easing: backOut }}>
          <p class="form-label">News pour {newsContent.childName}</p>
          <div class="flex items-end gap-2">
            <textarea
              bind:value={newsContent.inputValue}
              onkeydown={handleNewsContentKeydown}
              placeholder="Ex : Elle a fait ses premiers pas aujourd'hui !"
              rows={2}
              class="agent-textarea"
            ></textarea>
            <button
              type="button"
              onclick={submitNews}
              disabled={!newsContent.inputValue.trim()}
              class="agent-send-btn {newsContent.inputValue.trim() ? 'agent-send-btn-active' : 'agent-send-btn-disabled'}"
              aria-label="Publier"
            >
              <Send size={13} />
            </button>
          </div>
        </div>

      {:else if journalForm}
        <div class="agent-form-card" transition:fly={{ y: 20, duration: 280, easing: backOut }}>

          {#if journalForm.currentStep === 'mood'}
            <p class="form-label">Humeur</p>
            <div class="flex flex-wrap gap-2">
              {#each MOOD_OPTIONS as opt, i}
                <button
                  type="button"
                  onclick={() => answerMood(opt.value)}
                  class="option-chip"
                  style="animation-delay: {i * 60}ms"
                >
                  {opt.label}
                </button>
              {/each}
            </div>

          {:else if journalForm.currentStep === 'meals'}
            <p class="form-label">Repas du jour</p>
            <div class="grid gap-2" style="grid-template-columns: repeat({journalForm.menus.length}, 1fr)">
              {#each journalForm.menus as menu}
                <div class="flex flex-col items-center gap-1">
                  <span class="text-[10px] font-semibold text-warm-500 uppercase tracking-wide">
                    {MEAL_LABELS[menu.mealType] ?? menu.mealType}
                  </span>
                  <PlateVisual
                    level={pendingMeals[menu.mealType]}
                    size="sm"
                    interactive
                    onchange={(l) => { pendingMeals[menu.mealType] = l; }}
                  />
                  <span class="text-[10px] text-warm-600 text-center leading-tight line-clamp-2 max-w-[90px]">
                    {menu.description}
                  </span>
                </div>
              {/each}
            </div>
            <button type="button" onclick={answerMeals} class="agent-primary-btn mt-3">
              Valider les repas
            </button>

          {:else if journalForm.currentStep === 'nap'}
            <p class="form-label">Sieste</p>
            <div class="flex flex-wrap gap-2">
              {#each NAP_OPTIONS as opt, i}
                <button
                  type="button"
                  onclick={() => answerNap(opt.value)}
                  class="option-chip"
                  style="animation-delay: {i * 60}ms"
                >
                  {opt.label}
                </button>
              {/each}
            </div>

          {:else if journalForm.currentStep === 'changes'}
            <p class="form-label">Nombre de changes</p>
            <div class="flex items-center justify-center gap-5 mb-3">
              <button
                type="button"
                onclick={() => { if (pendingChanges > 0) pendingChanges--; }}
                class="stepper-btn"
              >
                <Minus size={15} />
              </button>
              <span class="text-3xl font-bold text-warm-800 w-10 text-center tabular-nums">
                {pendingChanges}
              </span>
              <button
                type="button"
                onclick={() => { if (pendingChanges < 15) pendingChanges++; }}
                class="stepper-btn"
              >
                <Plus size={15} />
              </button>
            </div>
            <button type="button" onclick={answerChanges} class="agent-primary-btn">
              Valider
            </button>

          {:else if journalForm.currentStep === 'health'}
            <p class="form-label">Signalement sante</p>
            <div class="flex gap-2">
              <button
                type="button"
                onclick={() => answerHealth(false)}
                class="flex-1 option-chip text-center"
              >
                Non, rien
              </button>
              <button type="button" onclick={() => answerHealth(true)} class="flex-1 agent-primary-btn">
                Oui
              </button>
            </div>

          {:else if journalForm.currentStep === 'health_note'}
            <p class="form-label">Details sante</p>
            <div class="flex items-end gap-2">
              <textarea
                bind:value={pendingHealthNote}
                onkeydown={handleHealthNoteKeydown}
                placeholder="Ex : legere fievre (37,8), bosse sur le front..."
                rows={2}
                class="agent-textarea"
              ></textarea>
              <button
                type="button"
                onclick={answerHealthNote}
                disabled={!pendingHealthNote.trim()}
                class="agent-send-btn {pendingHealthNote.trim() ? 'agent-send-btn-active' : 'agent-send-btn-disabled'}"
                aria-label="Valider"
              >
                <Send size={13} />
              </button>
            </div>
          {/if}

        </div>
        <p class="text-[10px] text-warm-400/70 text-center mt-1.5">
          Carnet de {journalForm.childName}
        </p>

      {:else}
        <!-- Normal text input -->
        <div class="agent-input-wrapper" transition:fade={{ duration: 150 }}>
          <textarea
            bind:value={inputValue}
            onkeydown={handleKeydown}
            placeholder={inputPlaceholder}
            rows={1}
            disabled={isLoading}
            class="agent-textarea"
          ></textarea>
          <button
            type="button"
            onclick={() => sendMessage()}
            disabled={!inputValue.trim() || isLoading}
            class="agent-send-btn {inputValue.trim() && !isLoading ? 'agent-send-btn-active' : 'agent-send-btn-disabled'}"
            aria-label="Envoyer"
          >
            <Send size={13} />
          </button>
        </div>
      {/if}

    </div>
  </div>

<style>
  /* ── Panel — true glass ─────────────────────────────────────────────── */

  /* ── Backdrop — opacity only, no backdrop-filter animation (janky) ── */
  .agent-backdrop {
    background: rgba(26, 22, 18, 0.12);
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    opacity: 0;
    /* Close: quick fade out */
    transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
  }

  .agent-backdrop-visible {
    opacity: 1;
    /* Open: gentle fade in, slightly delayed to let panel lead */
    transition: opacity 0.35s cubic-bezier(0, 0, 0.2, 1) 0.02s;
  }

  /* ── Panel — asymmetric open/close, depth progression ── */
  .agent-panel {
    background: rgba(255, 252, 248, 0.6);
    backdrop-filter: blur(28px) saturate(160%);
    -webkit-backdrop-filter: blur(28px) saturate(160%);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    /* Resting state: off-screen, slightly scaled down, faded shadow */
    transform: translateX(105%) scale(0.96);
    opacity: 0.4;
    box-shadow:
      0 4px 16px rgba(194, 101, 58, 0.04),
      0 0 0 rgba(0, 0, 0, 0);
    will-change: transform, opacity;
    /* Close transition: fast, gravity-pull feel, no bounce */
    transition:
      transform 0.22s cubic-bezier(0.4, 0, 0.7, 0.2),
      opacity 0.18s cubic-bezier(0.4, 0, 1, 1),
      box-shadow 0.22s ease-out;
  }

  /* Open: overshoot then settle (iOS sheet feel) */
  .agent-panel-open {
    transform: translateX(0) scale(1);
    opacity: 1;
    box-shadow:
      0 20px 60px rgba(194, 101, 58, 0.1),
      0 8px 24px rgba(0, 0, 0, 0.08);
    transition:
      transform 0.42s cubic-bezier(0.34, 1.4, 0.64, 1),
      opacity 0.3s cubic-bezier(0, 0, 0.2, 1),
      box-shadow 0.42s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .agent-panel,
    .agent-panel-open,
    .agent-backdrop,
    .agent-backdrop-visible {
      transition: none !important;
    }
  }

  /* ── Header — glass bar ─────────────────────────────────────────────── */

  .agent-header {
    background: rgba(255,252,248,0.4);
    border-bottom: 1px solid rgba(200,180,160,0.1);
    position: relative;
  }

  .agent-sparkle-icon {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    background: linear-gradient(135deg, #ED7424, #D4621E);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 10px rgba(237,116,36,0.35);
    position: relative;
  }

  .agent-sparkle-icon::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(237,116,36,0.4), transparent);
    z-index: -1;
    filter: blur(4px);
  }

  .agent-header-btn {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: rgba(0,0,0,0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8a7a6e;
    cursor: pointer;
    transition: all 0.15s;
  }

  .agent-header-btn:hover {
    background: rgba(0,0,0,0.08);
    color: #5d4e43;
  }

  /* ── Messages zone ──────────────────────────────────────────────────── */

  .agent-messages-zone {
    scrollbar-width: none;
  }

  .agent-messages-zone::-webkit-scrollbar {
    display: none;
  }

  /* ── User bubbles — glowing send ────────────────────────────────────── */

  .agent-bubble-user {
    max-width: 82%;
    padding: 10px 15px;
    border-radius: 20px 20px 4px 20px;
    font-size: 13px;
    line-height: 1.55;
    color: white;
    background: linear-gradient(135deg, #ED7424 0%, #C8551A 100%);
    position: relative;
    overflow: hidden;
    animation: user-send 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .bubble-text {
    position: relative;
    z-index: 1;
  }

  /* Glowing sweep on send */
  .bubble-glow {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 0%,
      rgba(255,255,255,0.35) 45%,
      rgba(255,255,255,0.5) 50%,
      rgba(255,255,255,0.35) 55%,
      transparent 100%
    );
    transform: translateX(-110%);
    animation: glow-sweep 0.7s 0.15s ease-out forwards;
  }

  @keyframes user-send {
    0% {
      opacity: 0;
      transform: scale(0.6) translateY(20px);
      filter: blur(4px);
    }
    50% {
      filter: blur(0px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
      filter: blur(0px);
    }
  }

  @keyframes glow-sweep {
    0%   { transform: translateX(-110%); }
    100% { transform: translateX(110%);  }
  }

  /* ── Assistant bubbles — frosted glass ──────────────────────────────── */

  .agent-bubble-assistant {
    max-width: 88%;
    padding: 10px 14px;
    border-radius: 20px 20px 20px 4px;
    font-size: 13px;
    line-height: 1.55;
    color: #3d2f27;
    background: rgba(255,255,255,0.5);
    border: 1px solid rgba(255,255,255,0.45);
    box-shadow: 0 1px 4px rgba(0,0,0,0.03);
  }

  /* ── Shimmer — breathing orb + lines ────────────────────────────────── */

  .shimmer-container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    min-width: 170px;
  }

  .shimmer-orb {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 40%,
      rgba(237,116,36,0.35) 0%,
      rgba(237,116,36,0.15) 50%,
      rgba(237,116,36,0.05) 100%
    );
    animation: orb-breathe 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  .shimmer-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shimmer-line {
    height: 8px;
    border-radius: 4px;
    width: 100%;
    background: linear-gradient(
      90deg,
      rgba(237,116,36,0.05) 0%,
      rgba(237,116,36,0.18) 30%,
      rgba(237,116,36,0.28) 50%,
      rgba(237,116,36,0.18) 70%,
      rgba(237,116,36,0.05) 100%
    );
    background-size: 250% 100%;
    animation: shimmer-wave 1.6s ease-in-out infinite;
  }

  .shimmer-line.short {
    width: 55%;
    animation-delay: 0.2s;
  }

  @keyframes orb-breathe {
    0%, 100% { transform: scale(0.85); opacity: 0.5; }
    50%      { transform: scale(1.1);  opacity: 1;   }
  }

  @keyframes shimmer-wave {
    0%   { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }

  /* ── Suggestion chips — glass ───────────────────────────────────────── */

  .suggestion-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    padding: 10px 14px;
    border-radius: 14px;
    background: rgba(255,255,255,0.45);
    border: 1px solid rgba(255,255,255,0.4);
    font-size: 12.5px;
    color: #5d4e43;
    font-weight: 500;
    line-height: 1.4;
    transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0,0,0,0.03);
  }

  .suggestion-arrow {
    color: #c89a72;
    transition: all 0.25s;
    flex-shrink: 0;
    display: flex;
  }

  .suggestion-chip:hover {
    background: rgba(237,116,36,0.08);
    border-color: rgba(237,116,36,0.25);
    color: #C8551A;
    transform: translateX(3px);
    box-shadow: 0 2px 12px rgba(237,116,36,0.1);
  }

  .suggestion-chip:hover .suggestion-arrow {
    color: #ED7424;
    transform: translateX(2px);
  }

  .suggestion-chip:active {
    transform: translateX(3px) scale(0.97);
  }

  /* ── Staggered appear ───────────────────────────────────────────────── */

  .msg-appear {
    animation: msg-appear 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--delay, 0ms);
  }

  @keyframes msg-appear {
    0% {
      opacity: 0;
      transform: translateY(14px) scale(0.97);
      filter: blur(2px);
    }
    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0px);
    }
  }

  /* ── Action cards — glass ───────────────────────────────────────────── */

  .action-card {
    padding: 10px 12px;
    border-radius: 14px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border: 1px solid;
  }

  .action-card-success {
    border-color: rgba(16,185,129,0.2);
    background: rgba(16,185,129,0.08);
  }

  .action-card-error {
    border-color: rgba(239,68,68,0.2);
    background: rgba(239,68,68,0.08);
  }

  .action-card-icon {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .action-icon-success {
    background: rgba(16,185,129,0.15);
    color: #059669;
  }

  .action-icon-error {
    background: rgba(239,68,68,0.15);
    color: #dc2626;
  }

  /* ── Context badge ────────────────────────────────────────────────── */

  .context-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    margin-bottom: 8px;
    border-radius: 10px;
    background: rgba(237,116,36,0.06);
    border: 1px solid rgba(237,116,36,0.1);
    font-size: 11px;
    color: #8a7a6e;
    line-height: 1;
  }

  .context-badge strong {
    color: #C8551A;
    font-weight: 600;
  }

  :global(.context-badge-icon) {
    color: #ED7424;
    flex-shrink: 0;
    animation: ctx-pin-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes ctx-pin-in {
    0% { transform: scale(0) rotate(-90deg); opacity: 0; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }

  .context-badge-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(237,116,36,0.35);
    flex-shrink: 0;
  }

  .context-badge-aware {
    color: #ED7424;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.02em;
    animation: ctx-aware-in 0.6s 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes ctx-aware-in {
    0% { opacity: 0; transform: translateX(-4px); filter: blur(2px); }
    100% { opacity: 1; transform: translateX(0); filter: blur(0); }
  }

  /* ── Input zone — glass ─────────────────────────────────────────────── */

  .agent-input-zone {
    border-top: 1px solid rgba(200,180,160,0.1);
    background: rgba(255,252,248,0.3);
  }

  .agent-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.5);
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.45);
    padding: 6px 6px 6px 14px;
    transition: all 0.25s;
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  }

  .agent-input-wrapper:focus-within {
    border-color: rgba(237,116,36,0.3);
    box-shadow: 0 0 0 3px rgba(237,116,36,0.06), 0 4px 20px rgba(237,116,36,0.08);
    background: rgba(255,255,255,0.6);
  }

  .agent-textarea {
    flex: 1;
    font-size: 13px;
    color: #3d2f27;
    resize: none;
    outline: none;
    background: transparent;
    line-height: 1.5;
    padding: 5px 0;
    min-height: 32px;
    max-height: 80px;
    overflow-y: auto;
    border: none;
    box-shadow: none;
    -webkit-appearance: none;
    appearance: none;
  }

  .agent-textarea::placeholder {
    color: #b5a99e;
  }

  .agent-textarea:focus {
    outline: none;
    border: none;
    box-shadow: none;
  }

  /* ── Send button ────────────────────────────────────────────────────── */

  .agent-send-btn {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .agent-send-btn-active {
    color: white;
    background: linear-gradient(135deg, #ED7424, #C8551A);
    cursor: pointer;
    box-shadow:
      0 2px 10px rgba(237,116,36,0.35),
      0 0 20px rgba(237,116,36,0.15);
  }

  .agent-send-btn-active:hover {
    transform: scale(1.08);
    box-shadow:
      0 3px 16px rgba(237,116,36,0.45),
      0 0 30px rgba(237,116,36,0.2);
  }

  .agent-send-btn-active:active {
    transform: scale(0.92);
  }

  .agent-send-btn-disabled {
    background: rgba(0,0,0,0.04);
    color: #c4b5aa;
    cursor: not-allowed;
  }

  /* ── Form card — glass ──────────────────────────────────────────────── */

  .agent-form-card {
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.45);
    background: rgba(255,255,255,0.45);
    padding: 14px 16px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.03);
  }

  .form-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #8a7a6e;
    margin-bottom: 10px;
  }

  /* ── Option chips — glass ───────────────────────────────────────────── */

  .option-chip {
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 500;
    border: 1px solid rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.4);
    color: #5d4e43;
    transition: all 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    cursor: pointer;
    animation: chip-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  .option-chip:hover {
    border-color: rgba(237,116,36,0.3);
    background: rgba(237,116,36,0.08);
    color: #C8551A;
    box-shadow: 0 2px 10px rgba(237,116,36,0.1);
  }

  .option-chip:active {
    transform: scale(0.94);
  }

  @keyframes chip-in {
    0% {
      opacity: 0;
      transform: scale(0.85) translateY(6px);
      filter: blur(2px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
      filter: blur(0px);
    }
  }

  /* ── Primary action button ──────────────────────────────────────────── */

  .agent-primary-btn {
    width: 100%;
    padding: 10px 0;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    color: white;
    background: linear-gradient(135deg, #ED7424, #C8551A);
    box-shadow:
      0 2px 10px rgba(200,85,26,0.3),
      0 0 20px rgba(237,116,36,0.1);
    transition: all 0.2s;
  }

  .agent-primary-btn:hover {
    box-shadow:
      0 4px 16px rgba(200,85,26,0.4),
      0 0 30px rgba(237,116,36,0.15);
  }

  .agent-primary-btn:active {
    transform: scale(0.97);
  }

  /* ── Stepper buttons — glass ────────────────────────────────────────── */

  .stepper-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.4);
    cursor: pointer;
    color: #5d4e43;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .stepper-btn:hover {
    background: rgba(255,255,255,0.7);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  .stepper-btn:active {
    transform: scale(0.9);
  }

  /* ── Reduced motion ─────────────────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .agent-bubble-user,
    .bubble-glow,
    .msg-appear,
    .option-chip,
    .shimmer-orb,
    .shimmer-line,
    .context-badge-aware {
      animation: none !important;
    }

    :global(.context-badge-icon) {
      animation: none !important;
    }

    .bubble-glow {
      display: none;
    }

    .shimmer-orb {
      opacity: 0.5;
    }

    .shimmer-line {
      background: rgba(237,116,36,0.1);
    }
  }
</style>
