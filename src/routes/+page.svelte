<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    BookOpen, Camera, MessageSquare, UtensilsCrossed,
    Sparkles, QrCode, ChevronDown, ArrowRight, Heart,
    Clock, Shield, Users
  } from 'lucide-svelte';

  // ── Feature data ──────────────────────────────────────────────────────────

  const features = [
    {
      num: '01',
      icon: BookOpen,
      title: 'Chaque repas, chaque sieste, transmis en temps reel',
      body: "Plus besoin d'attendre le soir pour savoir comment s'est passee la journee. Repas, siestes, humeur, changes — tout arrive au fil de l'eau, dans un journal clair et chaleureux.",
      cta: 'Decouvrir le journal',
      mockup: 'journal' as const,
    },
    {
      num: '02',
      icon: Camera,
      title: "Les premiers pas, partages a l'instant",
      body: "Un sourire, une activite, un moment de fierte — l'assistante capture et partage. Les parents vivent les petites victoires meme a distance.",
      cta: "Voir les actualites",
      mockup: 'news' as const,
    },
    {
      num: '03',
      icon: MessageSquare,
      title: "Absence, allergie, consigne : rien n'est oublie",
      body: "Fini les mots griffonnes sur un coin de table. Les notes parents arrivent directement, avec accuse de reception et reponse de l'assistante.",
      cta: 'Decouvrir les notes',
      mockup: 'notes' as const,
    },
    {
      num: '04',
      icon: UtensilsCrossed,
      title: 'Le menu de la semaine, accessible en un coup d\'oeil',
      body: "Petit-dejeuner, dejeuner, gouter — les parents savent exactement ce que leur enfant mange. Transparent, simple, rassurant.",
      cta: 'Voir les menus',
      mockup: 'menus' as const,
    },
    {
      num: '05',
      icon: Sparkles,
      title: "Un assistant intelligent qui vous fait gagner du temps",
      body: "Saisie simplifiee, suggestions contextuelles, resume automatique — l'IA aide l'assistante a documenter la journee en quelques secondes, pas en quelques minutes.",
      cta: "Essayer l'assistant",
      mockup: 'ai' as const,
    },
    {
      num: '06',
      icon: QrCode,
      title: 'Inviter un parent en 10 secondes',
      body: "Un code, un lien, un QR — le parent scanne et rejoint l'espace de son enfant. Pas de formulaire complexe, pas d'attente.",
      cta: "Voir comment ca marche",
      mockup: 'invite' as const,
    },
  ];

  const stats = [
    { value: 30, suffix: 's', label: 'pour saisir un journal complet' },
    { value: 100, suffix: '%', label: 'des parents informes en temps reel' },
    { value: 0, suffix: '', label: 'carnet papier perdu', prefix: 'Zero' },
    { value: 6, suffix: '', label: "fonctionnalites pensees pour le quotidien" },
  ];

  // ── Scroll observation ────────────────────────────────────────────────────

  let heroReady = $state(false);
  let observers: IntersectionObserver[] = [];
  let visibleSections = $state<Set<string>>(new Set());
  let counterTriggered = $state(false);
  let counterValues = $state<number[]>([0, 0, 0, 0]);
  let prefersReducedMotion = $state(false);
  let focusedSections = $state<Set<string>>(new Set());

  function animateCounter(target: number, index: number, duration: number) {
    if (prefersReducedMotion) {
      counterValues[index] = target;
      return;
    }
    const start = performance.now();
    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      counterValues[index] = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  onMount(() => {
    prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Hero entrance stagger
    setTimeout(() => { heroReady = true; }, 100);

    // Section reveal observer
    const sectionObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.section;
            if (id) {
              visibleSections = new Set([...visibleSections, id]);
            }
            sectionObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );
    observers.push(sectionObs);

    document.querySelectorAll('[data-section]').forEach((el) => {
      sectionObs.observe(el);
    });

    // Focus observer — tracks which feature block the user is actively viewing
    // Uses a high threshold so it only fires when the section is well in view
    const focusObs = new IntersectionObserver(
      (entries) => {
        const next = new Set(focusedSections);
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.section;
          if (!id) return;
          if (entry.isIntersecting) {
            next.add(id);
          } else {
            next.delete(id);
          }
        });
        focusedSections = next;
      },
      { threshold: 0.55 }
    );
    observers.push(focusObs);

    document.querySelectorAll('.feature-block[data-section]').forEach((el) => {
      focusObs.observe(el);
    });

    // Counter observer
    const counterObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !counterTriggered) {
            counterTriggered = true;
            stats.forEach((s, i) => {
              setTimeout(() => animateCounter(s.value, i, 1200), i * 150);
            });
            counterObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    observers.push(counterObs);

    const counterEl = document.getElementById('stats-section');
    if (counterEl) counterObs.observe(counterEl);

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  function sectionVisible(id: string): boolean {
    return visibleSections.has(id);
  }

  function sectionFocused(id: string): boolean {
    return focusedSections.has(id);
  }
</script>

<svelte:head>
  <title>Le Cocon — Le cahier de liaison reinvente</title>
  <meta name="description" content="Le Cocon remplace le carnet papier par un espace numerique chaleureux entre assistantes maternelles et parents. Journal, actualites, menus, notes — tout en temps reel." />
</svelte:head>

<div class="landing-page">

<!-- ════════════════════════════════════════════════════════════════════════
     FLOATING NAV
     ════════════════════════════════════════════════════════════════════════ -->

<nav class="floating-nav" class:nav-visible={heroReady}>
  <div class="floating-nav-inner">
    <a href="/" class="font-display text-base sm:text-lg font-bold text-gradient shrink-0">Le Cocon</a>
    <div class="nav-links">
      <a href="#features" class="nav-link">Fonctionnalites</a>
      <a href="#confiance" class="nav-link">Confiance</a>
      <a href="#commencer" class="nav-link nav-link-desktop">Commencer</a>
    </div>
    <a href="/login" class="btn btn-primary text-xs sm:text-sm px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl shrink-0">
      Connexion
    </a>
  </div>
</nav>

<!-- ════════════════════════════════════════════════════════════════════════
     HERO — 100vh emotional opening
     ════════════════════════════════════════════════════════════════════════ -->

<section class="hero-section relative min-h-dvh flex flex-col items-center justify-center overflow-hidden px-6">
  <!-- Background orbs -->
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>

  <!-- Golden threads SVG -->
  <svg class="threads-svg" aria-hidden="true" viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path class="thread thread-1" d="M100,300 Q250,100 400,280 Q550,460 700,250" stroke="url(#threadGrad)" stroke-width="1.5" fill="none" />
    <path class="thread thread-2" d="M150,450 Q300,200 450,350 Q600,500 750,300" stroke="url(#threadGrad2)" stroke-width="1" fill="none" />
    <path class="thread thread-3" d="M50,200 Q200,400 400,320 Q600,240 780,400" stroke="url(#threadGrad)" stroke-width="0.8" fill="none" />
    <defs>
      <linearGradient id="threadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#E8913A" stop-opacity="0" />
        <stop offset="30%" stop-color="#E8913A" stop-opacity="0.3" />
        <stop offset="70%" stop-color="#C2653A" stop-opacity="0.25" />
        <stop offset="100%" stop-color="#C2653A" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="threadGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#C2653A" stop-opacity="0" />
        <stop offset="40%" stop-color="#E8913A" stop-opacity="0.2" />
        <stop offset="60%" stop-color="#C2653A" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#E8913A" stop-opacity="0" />
      </linearGradient>
    </defs>
  </svg>

  <!-- Hero content -->
  <div class="relative z-10 max-w-3xl mx-auto text-center">
    <!-- Eyebrow -->
    <div
      class="hero-eyebrow mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
      class:hero-visible={heroReady}
    >
      <Heart class="w-3.5 h-3.5 text-sienne-500" />
      <span class="text-sm font-medium text-warm-700">Cahier de liaison numerique</span>
    </div>

    <!-- Headline -->
    <h1
      class="hero-headline font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-nuit leading-[1.3] tracking-tight mb-6"
      class:hero-visible={heroReady}
    >
      <span class="block">"Qu'est-ce qu'il a</span>
      <span class="block text-gradient">mange aujourd'hui ?"</span>
    </h1>

    <!-- Subheadline -->
    <p
      class="hero-sub text-lg sm:text-xl text-warm-700 max-w-xl mx-auto mb-10 leading-relaxed"
      class:hero-visible={heroReady}
    >
      Le lien entre vous et l'assistante maternelle, tisse en temps reel.
    </p>

    <!-- CTAs -->
    <div
      class="hero-ctas flex flex-col sm:flex-row items-center justify-center gap-4"
      class:hero-visible={heroReady}
    >
      <a href="/onboarding" class="btn btn-primary text-base px-8 py-3.5 rounded-2xl">
        Commencer gratuitement
        <ArrowRight class="w-4 h-4" />
      </a>
      <a href="#features" class="btn btn-ghost text-base px-6 py-3.5 rounded-2xl text-sienne-600">
        Decouvrir les fonctionnalites
      </a>
    </div>
  </div>

  <!-- Scroll indicator -->
  <div
    class="hero-scroll flex flex-col items-center gap-2"
    class:hero-visible={heroReady}
  >
    <span class="text-xs text-warm-500 tracking-widest uppercase">Decouvrir</span>
    <div class="scroll-pill">
      <div class="scroll-dot"></div>
    </div>
  </div>
</section>

<!-- Hero → page fade bridge -->
<div class="hero-fade" aria-hidden="true"></div>

<!-- ════════════════════════════════════════════════════════════════════════
     INTRO — transition bridge
     ════════════════════════════════════════════════════════════════════════ -->

<section
  class="py-20 sm:py-28 px-6"
  data-section="intro"
>
  <div class="max-w-2xl mx-auto text-center">
    <p
      class="section-reveal font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-warm-800 leading-snug"
      class:is-visible={sectionVisible('intro')}
    >
      Le carnet papier se perd. Les SMS se noient. Les parents s'inquietent.
      <span class="text-gradient font-bold">Le Cocon change tout.</span>
    </p>
  </div>
</section>

<!-- ════════════════════════════════════════════════════════════════════════
     FEATURES CASCADE — storyscrolling
     ════════════════════════════════════════════════════════════════════════ -->

<section id="features" class="relative pb-20 sm:pb-32">
  <!-- Vertical golden thread -->
  <div class="golden-thread" aria-hidden="true"></div>

  {#each features as feature, i}
    {@const isEven = i % 2 === 0}
    {@const sectionId = `feature-${i}`}
    <div
      class="feature-block relative px-6 py-16 sm:py-24"
      data-section={sectionId}
    >
      <div class="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <!-- Text side -->
        <div
          class="feature-text"
          class:lg:order-2={!isEven}
          class:is-visible={sectionVisible(sectionId)}
          class:from-left={isEven}
          class:from-right={!isEven}
        >
          <!-- Number -->
          <span class="feature-num font-display italic text-6xl sm:text-7xl font-light text-miel-300/60 select-none leading-none">
            {feature.num}
          </span>
          <!-- Icon + Title -->
          <div class="mt-2 mb-4 flex items-start gap-3">
            <div class="mt-1 shrink-0 w-10 h-10 rounded-xl bg-miel-100 flex items-center justify-center">
              <feature.icon class="w-5 h-5 text-miel-600" />
            </div>
            <h3 class="font-display text-2xl sm:text-3xl font-bold text-nuit leading-snug">
              {feature.title}
            </h3>
          </div>
          <!-- Body -->
          <p class="text-warm-600 text-base sm:text-lg leading-relaxed max-w-md mb-6">
            {feature.body}
          </p>
          <!-- Micro-CTA -->
          <a href="/onboarding" class="inline-flex items-center gap-1.5 text-sienne-500 font-semibold text-sm hover:text-sienne-600 transition-colors group">
            {feature.cta}
            <ArrowRight class="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </a>
        </div>

        <!-- App window mockup -->
        <div
          class="feature-window"
          class:lg:order-1={!isEven}
          class:is-visible={sectionVisible(sectionId)}
          class:is-focused={sectionFocused(sectionId)}
          class:tilt-left={isEven}
          class:tilt-right={!isEven}
        >
          <div class="app-chrome">
            <!-- Title bar -->
            <div class="chrome-bar">
              <div class="chrome-dots">
                <span class="dot dot-miel"></span>
                <span class="dot dot-sienne"></span>
                <span class="dot dot-mousse"></span>
              </div>
              <span class="chrome-title">Le Cocon</span>
              <div class="chrome-dots opacity-0">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
              </div>
            </div>
            <!-- Content -->
            <div class="chrome-body">
              {#if feature.mockup === 'journal'}
                <div class="mock-journal">
                  <div class="mock-header">
                    <div class="mock-avatar mock-avatar-e">E</div>
                    <div>
                      <div class="mock-name">Emma Dupont</div>
                      <div class="mock-date">Mercredi 26 mars 2026</div>
                    </div>
                    <span class="mock-mood">Joyeuse</span>
                  </div>
                  <div class="mock-grid">
                    <div class="mock-card-inner">
                      <div class="mock-label">Dejeuner</div>
                      <div class="mock-value">Puree de courgettes, poulet</div>
                      <div class="mock-plates">
                        <span class="plate plate-full"></span>
                        <span class="plate plate-full"></span>
                        <span class="plate plate-half"></span>
                        <span class="plate plate-empty"></span>
                      </div>
                    </div>
                    <div class="mock-card-inner">
                      <div class="mock-label">Sieste</div>
                      <div class="mock-value">12h30 — 14h45</div>
                      <div class="mock-badge badge-bleu">2h15 de sommeil</div>
                    </div>
                    <div class="mock-card-inner">
                      <div class="mock-label">Gouter</div>
                      <div class="mock-value">Compote pomme-poire, biscuit</div>
                      <div class="mock-plates">
                        <span class="plate plate-full"></span>
                        <span class="plate plate-full"></span>
                        <span class="plate plate-full"></span>
                        <span class="plate plate-full"></span>
                      </div>
                    </div>
                    <div class="mock-card-inner">
                      <div class="mock-label">Changes</div>
                      <div class="mock-value">3 changes aujourd'hui</div>
                      <div class="mock-badge badge-mousse">Tout va bien</div>
                    </div>
                  </div>
                  <div class="mock-notes">
                    <div class="mock-label">Notes</div>
                    <div class="mock-note-text">Emma a adore jouer avec les cubes ce matin. Elle commence a empiler 3 blocs !</div>
                  </div>
                </div>

              {:else if feature.mockup === 'news'}
                <div class="mock-news">
                  <div class="mock-news-item">
                    <div class="mock-avatar mock-avatar-t">T</div>
                    <div class="mock-news-content">
                      <div class="mock-news-top">
                        <span class="mock-name">Theo Martin</span>
                        <span class="mock-time">11h42</span>
                      </div>
                      <div class="mock-news-text">Premier dessin au doigt ! Il a choisi le bleu et le jaune.</div>
                      <div class="mock-news-img shimmer-slot"></div>
                    </div>
                  </div>
                  <div class="mock-news-item">
                    <div class="mock-avatar mock-avatar-l">L</div>
                    <div class="mock-news-content">
                      <div class="mock-news-top">
                        <span class="mock-name">Lucie Bernard</span>
                        <span class="mock-time">10h15</span>
                      </div>
                      <div class="mock-news-text">Lucie a dit "encore" pour la premiere fois en tendant son assiette !</div>
                    </div>
                  </div>
                  <div class="mock-news-item">
                    <div class="mock-avatar mock-avatar-e">E</div>
                    <div class="mock-news-content">
                      <div class="mock-news-top">
                        <span class="mock-name">Emma Dupont</span>
                        <span class="mock-time">09h30</span>
                      </div>
                      <div class="mock-news-text">Seance comptines ce matin — Emma connait presque toute la chanson des crocodiles.</div>
                    </div>
                  </div>
                </div>

              {:else if feature.mockup === 'notes'}
                <div class="mock-notes-list">
                  <div class="mock-note-card">
                    <div class="mock-note-badge badge-sienne">Absence</div>
                    <div class="mock-note-title">Emma absente jeudi 27 mars</div>
                    <div class="mock-note-meta">Par Mme Dupont · Hier, 20h30</div>
                    <div class="mock-note-ack">
                      <span class="ack-dot ack-done"></span>
                      Lu et confirme par Marie
                    </div>
                  </div>
                  <div class="mock-note-card">
                    <div class="mock-note-badge badge-soleil">Sante</div>
                    <div class="mock-note-title">Theo a un peu de fievre</div>
                    <div class="mock-note-meta">Par M. Martin · Ce matin, 07h45</div>
                    <div class="mock-note-response">
                      <div class="mock-note-response-label">Reponse de Marie :</div>
                      <div class="mock-note-response-text">"Bien note, je surveille sa temperature. Je vous tiens au courant."</div>
                    </div>
                  </div>
                  <div class="mock-note-card">
                    <div class="mock-note-badge badge-warm">Logistique</div>
                    <div class="mock-note-title">Remettre le doudou lapin dans le sac</div>
                    <div class="mock-note-meta">Par Mme Bernard · Lundi</div>
                    <div class="mock-note-ack">
                      <span class="ack-dot ack-pending"></span>
                      En attente de confirmation
                    </div>
                  </div>
                </div>

              {:else if feature.mockup === 'menus'}
                <div class="mock-menus">
                  <div class="mock-menu-header">Semaine du 24 mars</div>
                  <div class="mock-menu-grid">
                    <div class="mock-menu-day">
                      <div class="mock-menu-day-name">Lun</div>
                      <div class="mock-menu-meal">
                        <span class="mock-meal-type">Dej.</span>
                        Hachis parmentier, salade verte
                      </div>
                      <div class="mock-menu-meal">
                        <span class="mock-meal-type">Gou.</span>
                        Yaourt, tartine de confiture
                      </div>
                    </div>
                    <div class="mock-menu-day">
                      <div class="mock-menu-day-name">Mar</div>
                      <div class="mock-menu-meal">
                        <span class="mock-meal-type">Dej.</span>
                        Filet de colin, riz, epinards
                      </div>
                      <div class="mock-menu-meal">
                        <span class="mock-meal-type">Gou.</span>
                        Compote de poires, galette
                      </div>
                    </div>
                    <div class="mock-menu-day">
                      <div class="mock-menu-day-name">Mer</div>
                      <div class="mock-menu-meal">
                        <span class="mock-meal-type">Dej.</span>
                        Puree de carottes, jambon
                      </div>
                      <div class="mock-menu-meal">
                        <span class="mock-meal-type">Gou.</span>
                        Banane, petit beurre
                      </div>
                    </div>
                    <div class="mock-menu-day mock-menu-day-today">
                      <div class="mock-menu-day-name">Aujourd'hui</div>
                      <div class="mock-menu-meal">
                        <span class="mock-meal-type">Dej.</span>
                        Puree de courgettes, poulet
                      </div>
                      <div class="mock-menu-meal">
                        <span class="mock-meal-type">Gou.</span>
                        Compote pomme-poire, biscuit
                      </div>
                    </div>
                  </div>
                </div>

              {:else if feature.mockup === 'ai'}
                <div class="mock-ai">
                  <div class="mock-ai-chat">
                    <div class="mock-ai-msg mock-ai-user">
                      <div class="mock-ai-bubble user-bubble">Emma a bien mange son dejeuner, sieste de 12h30 a 14h45, 3 changes, elle etait joyeuse</div>
                    </div>
                    <div class="mock-ai-msg mock-ai-bot">
                      <div class="mock-ai-avatar">
                        <Sparkles class="w-3.5 h-3.5 text-miel-500" />
                      </div>
                      <div class="mock-ai-bubble bot-bubble">
                        <div class="mock-ai-label">Journal cree pour Emma :</div>
                        <div class="mock-ai-result">
                          <div class="mock-ai-line"><span class="mock-ai-key">Dejeuner</span> Bien mange</div>
                          <div class="mock-ai-line"><span class="mock-ai-key">Sieste</span> 12h30 — 14h45 (2h15)</div>
                          <div class="mock-ai-line"><span class="mock-ai-key">Changes</span> 3</div>
                          <div class="mock-ai-line"><span class="mock-ai-key">Humeur</span> Joyeuse</div>
                        </div>
                        <div class="mock-ai-confirm">Journal enregistre</div>
                      </div>
                    </div>
                  </div>
                  <div class="mock-ai-input">
                    <div class="mock-ai-input-placeholder">Decrivez la journee naturellement...</div>
                  </div>
                </div>

              {:else if feature.mockup === 'invite'}
                <div class="mock-invite">
                  <div class="mock-invite-card">
                    <div class="mock-invite-child">
                      <div class="mock-avatar mock-avatar-e">E</div>
                      <div>
                        <div class="mock-name">Emma Dupont</div>
                        <div class="mock-date">Inviter un parent</div>
                      </div>
                    </div>
                    <div class="mock-invite-code">
                      <div class="mock-invite-label">Code d'invitation</div>
                      <div class="mock-invite-value">AX7K-M2PL</div>
                      <div class="mock-invite-expiry">Expire dans 48h</div>
                    </div>
                    <div class="mock-invite-qr">
                      <!-- Stylized QR placeholder -->
                      <div class="mock-qr-grid">
                        {#each Array(7) as _, row}
                          <div class="mock-qr-row">
                            {#each Array(7) as _, col}
                              <div
                                class="mock-qr-cell"
                                class:filled={(row + col) % 3 === 0 || (row * col) % 5 === 1 || (row === 0 || row === 6 || col === 0 || col === 6) && (row < 3 || row > 3) && (col < 3 || col > 3)}
                              ></div>
                            {/each}
                          </div>
                        {/each}
                      </div>
                      <div class="mock-invite-scan">Scanner pour rejoindre</div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  {/each}
</section>

<!-- ════════════════════════════════════════════════════════════════════════
     STATS — proof section
     ════════════════════════════════════════════════════════════════════════ -->

<section id="stats-section" class="stats-section relative py-24 sm:py-32 px-6 overflow-hidden">
  <div class="stats-bg" aria-hidden="true"></div>
  <div class="relative z-10 max-w-5xl mx-auto">
    <h2 class="font-display text-3xl sm:text-4xl font-bold text-soie text-center mb-16">
      Des chiffres qui parlent d'eux-memes
    </h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
      {#each stats as stat, i}
        <div class="text-center">
          <div class="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-soie leading-none mb-3">
            {#if stat.prefix}
              {stat.prefix}
            {:else}
              {counterValues[i]}{stat.suffix}
            {/if}
          </div>
          <div class="text-miel-200 text-sm sm:text-base">
            {stat.label}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- ════════════════════════════════════════════════════════════════════════
     TRUST — security & privacy
     ════════════════════════════════════════════════════════════════════════ -->

<section id="confiance" class="py-20 sm:py-28 px-6" data-section="trust">
  <div class="max-w-4xl mx-auto text-center">
    <div
      class="section-reveal"
      class:is-visible={sectionVisible('trust')}
    >
      <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-2 mb-8">
        <Shield class="w-4 h-4 text-miel-500" />
        <span class="text-sm font-medium text-warm-700">Securite & Confiance</span>
      </div>
      <h2 class="font-display text-3xl sm:text-4xl font-bold text-nuit mb-6">
        Les donnees de vos enfants meritent le meilleur
      </h2>
      <p class="text-warm-600 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
        Chiffrement, hebergement en France, conformite RGPD, droit a l'export et a la suppression — parce que la confiance se construit sur des preuves, pas des promesses.
      </p>
    </div>
    <div
      class="grid grid-cols-1 sm:grid-cols-3 gap-6 section-reveal"
      class:is-visible={sectionVisible('trust')}
      style="transition-delay: 200ms"
    >
      <div class="trust-card glass-1 rounded-3xl p-6">
        <div class="w-12 h-12 rounded-2xl bg-miel-100 flex items-center justify-center mb-4 mx-auto">
          <Shield class="w-6 h-6 text-miel-600" />
        </div>
        <h3 class="font-display font-bold text-nuit mb-2">Chiffrement</h3>
        <p class="text-warm-600 text-sm">Donnees chiffrees en transit et au repos. Aucun acces non autorise.</p>
      </div>
      <div class="trust-card glass-1 rounded-3xl p-6">
        <div class="w-12 h-12 rounded-2xl bg-mousse-100 flex items-center justify-center mb-4 mx-auto">
          <Users class="w-6 h-6 text-mousse-600" />
        </div>
        <h3 class="font-display font-bold text-nuit mb-2">RGPD natif</h3>
        <p class="text-warm-600 text-sm">Export complet, suppression sur demande, consentement explicite.</p>
      </div>
      <div class="trust-card glass-1 rounded-3xl p-6">
        <div class="w-12 h-12 rounded-2xl bg-bleu-100 flex items-center justify-center mb-4 mx-auto">
          <Clock class="w-6 h-6 text-bleu-600" />
        </div>
        <h3 class="font-display font-bold text-nuit mb-2">Hebergement FR</h3>
        <p class="text-warm-600 text-sm">Serveurs en France, sauvegardes automatiques, disponibilite 99.9%.</p>
      </div>
    </div>
  </div>
</section>

<!-- ════════════════════════════════════════════════════════════════════════
     FINAL CTA
     ════════════════════════════════════════════════════════════════════════ -->

<section id="commencer" class="relative py-24 sm:py-32 px-6 overflow-hidden" data-section="final-cta">
  <!-- Background orbs -->
  <div class="orb orb-cta-1" aria-hidden="true"></div>
  <div class="orb orb-cta-2" aria-hidden="true"></div>

  <div
    class="relative z-10 max-w-2xl mx-auto text-center section-reveal"
    class:is-visible={sectionVisible('final-cta')}
  >
    <h2 class="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-nuit leading-tight mb-6">
      Rejoignez les assistantes qui ont dit
      <span class="text-gradient">adieu au carnet papier</span>
    </h2>
    <p class="text-warm-600 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
      Vous ne vous demanderez plus jamais ce que votre enfant a mange, combien il a dormi, ni comment s'est passee sa journee.
    </p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="/onboarding" class="btn btn-primary text-base px-8 py-3.5 rounded-2xl">
        Creer mon espace
        <ArrowRight class="w-4 h-4" />
      </a>
      <a href="/login" class="btn btn-ghost text-base px-6 py-3.5 rounded-2xl text-sienne-600">
        J'ai deja un compte
      </a>
    </div>
  </div>
</section>

<!-- ════════════════════════════════════════════════════════════════════════
     FOOTER
     ════════════════════════════════════════════════════════════════════════ -->

<footer class="border-t border-warm-200/50 py-12 px-6">
  <div class="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
    <div class="flex items-center gap-2">
      <span class="font-display text-xl font-bold text-gradient">Le Cocon</span>
    </div>
    <nav class="flex flex-wrap items-center justify-center gap-6 text-sm text-warm-600">
      <a href="/legal/mentions" class="hover:text-sienne-500 transition-colors">Mentions legales</a>
      <a href="/legal/confidentialite" class="hover:text-sienne-500 transition-colors">Confidentialite</a>
      <a href="/legal/cgu" class="hover:text-sienne-500 transition-colors">CGU</a>
    </nav>
    <div class="text-sm text-warm-500">
      &copy; {new Date().getFullYear()} Le Cocon
    </div>
  </div>
</footer>

</div><!-- .landing-page -->

<style>
  .landing-page {
    overflow-x: hidden;
  }
  /* ════════════════════════════════════════
     HERO
     ════════════════════════════════════════ */

  .hero-section {
    background:
      radial-gradient(ellipse 90% 70% at 30% 20%, rgba(232, 145, 58, 0.1), transparent 60%),
      radial-gradient(ellipse 70% 50% at 75% 70%, rgba(194, 101, 58, 0.07), transparent 55%),
      radial-gradient(ellipse 50% 40% at 50% 50%, rgba(250, 221, 187, 0.12), transparent 50%),
      linear-gradient(170deg, #FFF8F0 0%, #F5E6D3 35%, #FADCC5 65%, #F0C8A8 100%);
  }

  /* Smooth transition from hero warm tones to page background */
  .hero-fade {
    height: 10rem;
    margin-top: -1px;
    background: linear-gradient(to bottom, #F0C8A8 0%, #F5E6D3 30%, #FFF8F0 100%);
  }

  /* Orbs */
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    will-change: transform;
  }
  .orb-1 {
    width: 500px; height: 500px;
    top: -10%; left: -5%;
    background: radial-gradient(circle, rgba(232, 145, 58, 0.18) 0%, transparent 70%);
    animation: orbFloat 18s ease-in-out infinite;
  }
  .orb-2 {
    width: 400px; height: 400px;
    top: 30%; right: -8%;
    background: radial-gradient(circle, rgba(194, 101, 58, 0.12) 0%, transparent 70%);
    animation: orbFloat 22s ease-in-out infinite reverse;
  }
  .orb-3 {
    width: 350px; height: 350px;
    bottom: 5%; left: 20%;
    background: radial-gradient(circle, rgba(250, 221, 187, 0.2) 0%, transparent 70%);
    animation: orbFloat 15s ease-in-out infinite 3s;
  }
  .orb-cta-1 {
    width: 400px; height: 400px;
    top: -20%; right: -10%;
    background: radial-gradient(circle, rgba(232, 145, 58, 0.1) 0%, transparent 70%);
    animation: orbFloat 20s ease-in-out infinite;
  }
  .orb-cta-2 {
    width: 350px; height: 350px;
    bottom: -15%; left: -5%;
    background: radial-gradient(circle, rgba(194, 101, 58, 0.08) 0%, transparent 70%);
    animation: orbFloat 17s ease-in-out infinite reverse;
  }

  /* Golden threads */
  .threads-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0.6;
    pointer-events: none;
  }
  .thread {
    stroke-dasharray: 1200;
    stroke-dashoffset: 1200;
    animation: drawThread 3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .thread-1 { animation-delay: 0.8s; }
  .thread-2 { animation-delay: 1.3s; }
  .thread-3 { animation-delay: 1.8s; }

  @keyframes drawThread {
    to { stroke-dashoffset: 0; }
  }

  /* Hero entrance stagger */
  .hero-eyebrow,
  .hero-headline,
  .hero-sub,
  .hero-ctas {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .hero-eyebrow.hero-visible { opacity: 1; transform: none; transition-delay: 0.15s; }
  .hero-headline.hero-visible { opacity: 1; transform: none; transition-delay: 0.3s; }
  .hero-sub.hero-visible { opacity: 1; transform: none; transition-delay: 0.5s; }
  .hero-ctas.hero-visible { opacity: 1; transform: none; transition-delay: 0.7s; }

  .hero-scroll {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    opacity: 0;
    transform: translateX(-50%) translateY(24px);
    transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .hero-scroll.hero-visible { opacity: 1; transform: translateX(-50%) translateY(0); transition-delay: 1.1s; }

  .hero-eyebrow {
    background: rgba(255, 248, 240, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  /* Scroll indicator */
  .scroll-pill {
    width: 24px;
    height: 40px;
    border-radius: 12px;
    border: 2px solid rgba(184, 158, 134, 0.35);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 6px;
  }
  .scroll-dot {
    width: 4px;
    height: 8px;
    border-radius: 2px;
    background: rgba(232, 145, 58, 0.5);
    animation: scrollBounce 2s ease-in-out infinite;
  }
  @keyframes scrollBounce {
    0%, 100% { transform: translateY(0); opacity: 1; }
    50% { transform: translateY(12px); opacity: 0.3; }
  }

  /* ════════════════════════════════════════
     SECTION REVEAL
     ════════════════════════════════════════ */

  .section-reveal {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .section-reveal.is-visible {
    opacity: 1;
    transform: none;
  }

  /* ════════════════════════════════════════
     FEATURE CASCADE
     ════════════════════════════════════════ */

  /* Vertical golden thread */
  .golden-thread {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-50%);
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(232, 145, 58, 0.15) 10%,
      rgba(232, 145, 58, 0.3) 50%,
      rgba(194, 101, 58, 0.15) 90%,
      transparent 100%
    );
    display: none;
  }
  @media (min-width: 1024px) {
    .golden-thread { display: block; }
  }

  /* Feature text entrance */
  .feature-text {
    opacity: 0;
    transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .feature-text.from-left { transform: translateX(-40px); }
  .feature-text.from-right { transform: translateX(40px); }
  .feature-text.is-visible {
    opacity: 1;
    transform: none;
  }

  /* Feature window entrance */
  .feature-window {
    opacity: 0;
    transform: scale(0.93);
    border-radius: 1.5rem;
    transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.12s,
                transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.12s,
                box-shadow 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .feature-window.is-visible {
    opacity: 1;
    transform: none;
  }
  @media (min-width: 1024px) {
    .feature-window.tilt-left.is-visible {
      transform: perspective(1200px) rotateY(8deg) rotateX(2deg) scale(0.96);
    }
    .feature-window.tilt-right.is-visible {
      transform: perspective(1200px) rotateY(-8deg) rotateX(2deg) scale(0.96);
    }
    /* Straighten + lift when user is actively viewing the section */
    .feature-window.is-focused.is-visible {
      transform: perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1);
      box-shadow: 0 32px 80px rgba(194, 101, 58, 0.18),
                  0 8px 24px rgba(194, 101, 58, 0.08);
      transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.12s,
                  transform 1s cubic-bezier(0.34, 1.56, 0.64, 1),
                  box-shadow 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    }
  }

  /* App chrome */
  .app-chrome {
    border-radius: 1.5rem;
    overflow: hidden;
    background: rgba(255, 248, 240, 0.65);
    backdrop-filter: blur(20px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 24px 60px rgba(194, 101, 58, 0.15),
                0 4px 16px rgba(194, 101, 58, 0.06);
  }

  .chrome-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 240, 220, 0.35);
    background: rgba(255, 248, 238, 0.45);
  }
  .chrome-dots {
    display: flex;
    gap: 6px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(184, 158, 134, 0.3);
  }
  .dot-miel { background: #E8913A; }
  .dot-sienne { background: #C2653A; }
  .dot-mousse { background: #5FA05B; }
  .chrome-title {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 600;
    font-size: 0.8rem;
    color: var(--color-warm-700);
    letter-spacing: 0.02em;
  }
  .chrome-body {
    padding: 16px;
    background: #FFF8F0;
    min-height: 280px;
  }

  /* ════════════════════════════════════════
     MOCKUP INTERNALS
     ════════════════════════════════════════ */

  .mock-avatar {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 700;
    font-size: 0.85rem;
    color: white;
    flex-shrink: 0;
  }
  .mock-avatar-e { background: linear-gradient(135deg, #E8913A, #C2653A); }
  .mock-avatar-t { background: linear-gradient(135deg, #6A96AB, #557A8D); }
  .mock-avatar-l { background: linear-gradient(135deg, #5FA05B, #4A8747); }

  .mock-name { font-weight: 600; font-size: 0.85rem; color: var(--color-nuit); }
  .mock-date { font-size: 0.75rem; color: var(--color-warm-500); }
  .mock-time { font-size: 0.7rem; color: var(--color-warm-500); }
  .mock-label { font-size: 0.7rem; font-weight: 600; color: var(--color-warm-500); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .mock-value { font-size: 0.8rem; color: var(--color-warm-800); line-height: 1.4; }

  /* Journal mockup */
  .mock-journal .mock-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .mock-mood {
    margin-left: auto;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba(95, 160, 91, 0.12);
    color: #4A8747;
  }
  .mock-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 10px;
  }
  .mock-card-inner {
    padding: 10px;
    border-radius: 12px;
    background: rgba(255, 248, 238, 0.45);
    border: 1px solid rgba(255, 240, 220, 0.35);
  }
  .mock-plates {
    display: flex;
    gap: 3px;
    margin-top: 6px;
  }
  .plate {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1.5px solid rgba(232, 145, 58, 0.3);
  }
  .plate-full { background: rgba(232, 145, 58, 0.7); }
  .plate-half { background: linear-gradient(to top, rgba(232, 145, 58, 0.7) 50%, transparent 50%); }
  .plate-empty { background: transparent; }
  .mock-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    margin-top: 6px;
  }
  .badge-bleu { background: rgba(106, 150, 171, 0.12); color: #466372; }
  .badge-mousse { background: rgba(95, 160, 91, 0.12); color: #4A8747; }
  .badge-sienne { background: rgba(194, 101, 58, 0.12); color: #8f4328; }
  .badge-soleil { background: rgba(229, 176, 58, 0.15); color: #8e6a10; }
  .badge-warm { background: rgba(184, 158, 134, 0.15); color: #5E4C3E; }

  .mock-notes { padding-top: 8px; border-top: 1px solid rgba(255, 240, 220, 0.4); }
  .mock-note-text { font-size: 0.8rem; color: var(--color-warm-700); line-height: 1.5; font-style: italic; }

  /* News mockup */
  .mock-news { display: flex; flex-direction: column; gap: 14px; }
  .mock-news-item { display: flex; gap: 10px; }
  .mock-news-content { flex: 1; min-width: 0; }
  .mock-news-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
  .mock-news-text { font-size: 0.8rem; color: var(--color-warm-700); line-height: 1.45; }
  .mock-news-img {
    margin-top: 8px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
  }

  /* Shimmer warm */
  .shimmer-slot {
    background: linear-gradient(90deg,
      rgba(255,248,240,0.8) 25%,
      rgba(232,145,58,0.15) 50%,
      rgba(255,248,240,0.8) 75%
    );
    background-size: 200% 100%;
    animation: shimmer-warm 2s ease-in-out infinite;
  }
  @keyframes shimmer-warm {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* Notes list mockup */
  .mock-notes-list { display: flex; flex-direction: column; gap: 10px; }
  .mock-note-card {
    padding: 12px;
    border-radius: 14px;
    background: rgba(255, 248, 238, 0.45);
    border: 1px solid rgba(255, 240, 220, 0.35);
  }
  .mock-note-badge {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 8px;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .mock-note-title { font-weight: 600; font-size: 0.85rem; color: var(--color-nuit); margin-bottom: 4px; }
  .mock-note-meta { font-size: 0.7rem; color: var(--color-warm-500); margin-bottom: 8px; }
  .mock-note-ack {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--color-warm-600);
  }
  .ack-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .ack-done { background: #5FA05B; }
  .ack-pending { background: #E5B03A; }
  .mock-note-response {
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(232, 145, 58, 0.06);
    border-left: 3px solid rgba(232, 145, 58, 0.3);
  }
  .mock-note-response-label { font-size: 0.7rem; font-weight: 600; color: var(--color-miel-600); margin-bottom: 2px; }
  .mock-note-response-text { font-size: 0.78rem; color: var(--color-warm-700); font-style: italic; line-height: 1.45; }

  /* Menus mockup */
  .mock-menu-header {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--color-nuit);
    margin-bottom: 12px;
  }
  .mock-menu-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mock-menu-day {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 248, 238, 0.45);
    border: 1px solid rgba(255, 240, 220, 0.35);
  }
  .mock-menu-day-today {
    border-color: rgba(232, 145, 58, 0.35);
    background: rgba(232, 145, 58, 0.06);
  }
  .mock-menu-day-name {
    font-weight: 700;
    font-size: 0.75rem;
    color: var(--color-warm-600);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }
  .mock-menu-day-today .mock-menu-day-name { color: var(--color-miel-600); }
  .mock-menu-meal {
    font-size: 0.78rem;
    color: var(--color-warm-700);
    line-height: 1.5;
    padding-left: 8px;
  }
  .mock-meal-type {
    font-weight: 600;
    font-size: 0.68rem;
    color: var(--color-warm-500);
    margin-right: 4px;
  }

  /* AI mockup */
  .mock-ai { display: flex; flex-direction: column; min-height: 260px; }
  .mock-ai-chat { flex: 1; display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px; }
  .mock-ai-msg { display: flex; gap: 8px; }
  .mock-ai-user { justify-content: flex-end; }
  .mock-ai-bot { align-items: flex-start; }
  .mock-ai-avatar {
    width: 28px;
    height: 28px;
    border-radius: 10px;
    background: rgba(232, 145, 58, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mock-ai-bubble {
    padding: 10px 12px;
    border-radius: 14px;
    font-size: 0.78rem;
    line-height: 1.45;
    max-width: 85%;
  }
  .user-bubble {
    background: rgba(232, 145, 58, 0.1);
    color: var(--color-warm-800);
    border-bottom-right-radius: 4px;
  }
  .bot-bubble {
    background: rgba(255, 248, 238, 0.65);
    border: 1px solid rgba(255, 240, 220, 0.4);
    color: var(--color-warm-800);
    border-bottom-left-radius: 4px;
  }
  .mock-ai-label { font-weight: 600; font-size: 0.75rem; color: var(--color-miel-600); margin-bottom: 6px; }
  .mock-ai-result { display: flex; flex-direction: column; gap: 3px; }
  .mock-ai-line { font-size: 0.76rem; color: var(--color-warm-700); }
  .mock-ai-key {
    font-weight: 600;
    color: var(--color-warm-600);
    display: inline-block;
    min-width: 65px;
    font-size: 0.7rem;
  }
  .mock-ai-confirm {
    margin-top: 8px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #4A8747;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .mock-ai-confirm::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #5FA05B;
  }
  .mock-ai-input {
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(255, 248, 238, 0.45);
    border: 1px solid rgba(255, 240, 220, 0.35);
  }
  .mock-ai-input-placeholder { font-size: 0.78rem; color: var(--color-warm-400); }

  /* Invite mockup */
  .mock-invite-card { text-align: center; }
  .mock-invite-child {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    text-align: left;
  }
  .mock-invite-code {
    padding: 16px;
    border-radius: 16px;
    background: rgba(255, 248, 238, 0.45);
    border: 1px solid rgba(255, 240, 220, 0.35);
    margin-bottom: 14px;
  }
  .mock-invite-label { font-size: 0.7rem; font-weight: 600; color: var(--color-warm-500); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
  .mock-invite-value {
    font-family: 'Fraunces', Georgia, serif;
    font-weight: 800;
    font-size: 1.6rem;
    letter-spacing: 0.08em;
    color: var(--color-nuit);
    margin-bottom: 6px;
  }
  .mock-invite-expiry { font-size: 0.7rem; color: var(--color-warm-500); }
  .mock-invite-qr {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .mock-qr-grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 12px;
    border-radius: 12px;
    background: rgba(255, 248, 238, 0.45);
    border: 1px solid rgba(255, 240, 220, 0.35);
  }
  .mock-qr-row { display: flex; gap: 3px; }
  .mock-qr-cell {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: rgba(184, 158, 134, 0.12);
  }
  .mock-qr-cell.filled { background: var(--color-nuit); }
  .mock-invite-scan { font-size: 0.72rem; color: var(--color-warm-500); }

  /* ════════════════════════════════════════
     STATS SECTION
     ════════════════════════════════════════ */

  .stats-section {
    position: relative;
  }
  .stats-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 30% 0%, rgba(232, 145, 58, 0.15), transparent 60%),
      radial-gradient(ellipse 60% 50% at 70% 80%, rgba(194, 101, 58, 0.1), transparent 60%),
      linear-gradient(160deg, #E8913A 0%, #C2653A 60%, #9E4A35 100%);
    border-radius: 2rem;
    margin: 0 1rem;
  }
  @media (min-width: 640px) {
    .stats-bg { margin: 0 2rem; border-radius: 2.5rem; }
  }
  @media (min-width: 1024px) {
    .stats-bg { margin: 0 4rem; border-radius: 3rem; }
  }

  /* ════════════════════════════════════════
     TRUST CARDS
     ════════════════════════════════════════ */

  .trust-card {
    transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
                box-shadow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .trust-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 16px 48px rgba(194, 101, 58, 0.12);
  }

  /* ════════════════════════════════════════
     FEATURE NUM WATERMARK
     ════════════════════════════════════════ */

  .feature-num {
    font-variation-settings: 'WONK' 1, 'SOFT' 100;
  }

  /* ════════════════════════════════════════
     FLOATING NAV
     ════════════════════════════════════════ */

  .floating-nav {
    position: fixed;
    top: 0.75rem;
    left: 50%;
    transform: translateX(-50%) translateY(-20px);
    z-index: 50;
    opacity: 0;
    pointer-events: none;
    width: calc(100% - 1.5rem);
    max-width: 42rem;
    transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1),
                transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .floating-nav.nav-visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
    transition-delay: 0.9s;
  }
  .floating-nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.4rem 0.4rem 0.4rem 1rem;
    border-radius: 1.25rem;
    background: rgba(255, 248, 240, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow: 0 4px 24px rgba(194, 101, 58, 0.08),
                0 1px 4px rgba(194, 101, 58, 0.04);
  }
  @media (min-width: 640px) {
    .floating-nav { top: 1rem; width: auto; max-width: none; }
    .floating-nav-inner { padding: 0.5rem 0.5rem 0.5rem 1.25rem; gap: 1rem; justify-content: center; }
  }
  /* Apply backdrop-filter only after visible to prevent blur flash on load */
  .floating-nav.nav-visible .floating-nav-inner {
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
  }
  .nav-links {
    display: flex;
    align-items: center;
    gap: 0.1rem;
  }
  .nav-link {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--color-warm-600);
    padding: 0.3rem 0.4rem;
    border-radius: 0.625rem;
    transition: color 0.2s, background 0.2s;
    white-space: nowrap;
  }
  .nav-link:hover {
    color: var(--color-sienne-600);
    background: rgba(232, 145, 58, 0.08);
  }
  /* "Commencer" hidden on mobile — redundant with hero CTAs */
  .nav-link-desktop { display: none; }
  @media (min-width: 640px) {
    .nav-links { gap: 0.25rem; }
    .nav-link { font-size: 0.8rem; padding: 0.35rem 0.65rem; }
    .nav-link-desktop { display: inline; }
  }

  /* ════════════════════════════════════════
     REDUCED MOTION
     ════════════════════════════════════════ */

  @media (prefers-reduced-motion: reduce) {
    .floating-nav {
      opacity: 1 !important;
      transform: translateX(-50%) !important;
      transition: none !important;
    }
    .hero-eyebrow,
    .hero-headline,
    .hero-sub,
    .hero-ctas,
    .hero-scroll {
      opacity: 1 !important;
      transform: translateX(-50%) !important;
      transition: none !important;
    }
    .feature-text,
    .feature-window,
    .section-reveal {
      opacity: 1 !important;
      transform: none !important;
      transition: none !important;
    }
    .thread { animation: none !important; stroke-dashoffset: 0 !important; }
    .orb { animation: none !important; }
    .scroll-dot { animation: none !important; }
    .shimmer-slot { animation: none !important; }
  }
</style>
