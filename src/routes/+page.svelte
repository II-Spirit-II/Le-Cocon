<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Button, PlateVisual } from '$lib/ui';
  import {
    BookOpen, UtensilsCrossed, Moon, Smile, Newspaper, Calendar,
    Sparkles, MessageSquare, Shield, Lock, Heart, ChevronDown,
    Check, X, Clock, Baby, Users, ArrowRight, Star, Send, FileText
  } from 'lucide-svelte';

  // Scroll-based reveal
  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.animate-on-scroll').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });

  // FAQ accordion
  let openFaq = $state<number | null>(null);
  function toggleFaq(i: number) {
    openFaq = openFaq === i ? null : i;
  }

  const faqs = [
    {
      q: "C'est compliqué à utiliser ?",
      a: "Non. Si vous savez envoyer un SMS, vous saurez utiliser Le Cocon. L'interface est pensée pour être simple : on clique, on remplit, c'est fait. Pas besoin de formation."
    },
    {
      q: "Est-ce que les parents voient tout ce que je note ?",
      a: "Oui, les parents voient le carnet de leur enfant dès que vous le validez. Ils reçoivent les repas, la sieste, l'humeur, les notes, tout ce que vous remplissez. Rien n'est caché."
    },
    {
      q: "Combien ça coûte ?",
      a: "Le Cocon est entièrement gratuit pendant la phase de lancement. Pas de carte bancaire demandée, pas d'engagement. On vous prévient avant tout changement."
    },
    {
      q: "Mes données sont-elles en sécurité ?",
      a: "Oui. Tout est hébergé en France chez Scaleway, chiffré en transit et au repos. Seuls vous et les parents liés à un enfant peuvent voir ses informations. Conforme RGPD."
    }
  ];
</script>

<div class="min-h-screen bg-aube">

  <!-- ═══════════════════════════════════════
       NAVIGATION
       ═══════════════════════════════════════ -->
  <nav class="fixed top-0 left-0 right-0 z-50 landing-nav">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <div class="flex items-center gap-2.5">
          <img src="/favicon.png" alt="Le Cocon" class="w-8 h-8" />
          <span class="font-display font-bold text-xl text-warm-900">Le Cocon</span>
        </div>
        <div class="hidden md:flex items-center gap-8">
          <a href="#fonctionnalites" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors">Fonctionnalités</a>
          <a href="#comment-ca-marche" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors">Comment ça marche</a>
          <a href="#temoignages" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors">Témoignages</a>
          <a href="#tarifs" class="text-sm font-medium text-warm-600 hover:text-warm-900 transition-colors">Tarifs</a>
        </div>
        <div class="flex items-center gap-3">
          <Button variant="ghost" href="/login">Connexion</Button>
          <Button variant="primary" href="/onboarding">S'inscrire</Button>
        </div>
      </div>
    </div>
  </nav>


  <!-- ═══════════════════════════════════════
       HERO
       ═══════════════════════════════════════ -->
  <section class="relative overflow-hidden pt-28 pb-20 sm:pt-32 sm:pb-28 px-4 sm:px-6 lg:px-8">
    <!-- Decorative orbs -->
    <div class="orb" style="width:380px;height:380px;background:rgba(232,145,58,0.08);top:-5%;right:8%;animation-delay:0s;"></div>
    <div class="orb" style="width:300px;height:300px;background:rgba(194,101,58,0.06);bottom:5%;left:3%;animation-delay:-8s;"></div>

    <div class="max-w-6xl mx-auto">
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        <!-- Text -->
        <div class="text-center lg:text-left">
          <p class="text-sm font-semibold text-miel-600 uppercase tracking-wider mb-4">Pour les assistantes maternelles et les structures</p>

          <h1 class="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-bold text-warm-900 mb-6 leading-[1.15]">
            Le Cahier de Liaison<br/>
            <span class="text-gradient">Nouvelle Génération.</span>
          </h1>

          <p class="text-lg text-warm-700 max-w-xl mb-8 leading-relaxed">
            Le Cocon remplace le carnet papier et les messages éparpillés.
            Vous notez les repas, la sieste, l'humeur. Les parents consultent tout depuis leur téléphone.
          </p>

          <div class="flex flex-col sm:flex-row items-center lg:items-start gap-3 mb-6">
            <Button variant="primary" size="lg" href="/onboarding">
              Créer mon compte
            </Button>
            <Button variant="ghost" size="lg" href="/login">
              J'ai déjà un compte
            </Button>
          </div>

          <div class="flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm text-warm-600">
            <span class="flex items-center gap-1.5">
              <Check size={14} class="text-mousse-500" /> Prêt en 1 minute
            </span>
          </div>
        </div>

        <!-- Product mockup: layered journal scene -->
        <div class="hidden lg:block relative hero-mockup-area">

          <!-- Floating badge: AI agent (left side, mid-height) -->
          <div class="absolute -left-14 top-[28%] z-20 animate-float" style="animation-delay:-7s;">
            <div class="hero-badge rounded-2xl px-3.5 py-2.5 max-w-50">
              <div class="flex items-start gap-2.5">
                <div class="w-7 h-7 bg-miel-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={13} class="text-miel-600" />
                </div>
                <div class="min-w-0">
                  <p class="text-[10px] text-warm-500 font-medium mb-0.5">Vous avez dit :</p>
                  <p class="text-[11px] text-warm-800 font-semibold leading-snug italic">"Remplis le carnet d'Emma, elle a bien mangé et dormi 1h30"</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Main journal card -->
          <div class="relative z-10 animate-float" style="animation-delay:-1s;">
            <div class="hero-card-main rounded-3xl p-5 max-w-88 mx-auto">
              <!-- Header -->
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-miel-100 flex items-center justify-center font-bold text-sm text-miel-700">E</div>
                  <div>
                    <p class="text-sm font-bold text-warm-900">Emma L.</p>
                    <p class="text-[11px] text-warm-500">Mercredi 12 mars</p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-mousse-50 border border-mousse-200">
                  <Smile size={12} class="text-mousse-600" />
                  <span class="text-[11px] font-semibold text-mousse-600">Joyeuse</span>
                </div>
              </div>

              <!-- Meals with PlateVisual -->
              <div class="glass-2 rounded-xl p-3 mb-2.5">
                <div class="flex items-center gap-2 mb-2.5">
                  <UtensilsCrossed size={13} class="text-sienne-500" />
                  <span class="text-[11px] font-semibold text-warm-700 uppercase tracking-wide">Repas</span>
                </div>
                <div class="flex justify-around">
                  {#each [
                    { label: 'Matin', level: 2 as const },
                    { label: 'Déjeuner', level: 3 as const },
                    { label: 'Goûter', level: 1 as const }
                  ] as meal}
                    <div class="flex flex-col items-center gap-1">
                      <PlateVisual level={meal.level} size="sm" />
                      <span class="text-[10px] text-warm-500 font-medium">{meal.label}</span>
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Nap -->
              <div class="glass-2 rounded-xl p-3 mb-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <Moon size={13} class="text-bleu-500" />
                    <span class="text-[11px] font-semibold text-warm-700 uppercase tracking-wide">Sieste</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <Clock size={11} class="text-bleu-400" />
                    <span class="text-xs text-warm-700">13h15 - 14h45</span>
                    <span class="text-[10px] text-bleu-500 font-medium">(1h30)</span>
                  </div>
                </div>
              </div>

              <!-- Note -->
              <div class="glass-2 rounded-xl p-3">
                <div class="flex items-center gap-2 mb-1.5">
                  <BookOpen size={13} class="text-miel-600" />
                  <span class="text-[11px] font-semibold text-warm-700 uppercase tracking-wide">Note</span>
                </div>
                <p class="text-[13px] text-warm-700 leading-snug">Emma a adoré le bac à sable ce matin, elle a joué dehors toute la matinée.</p>
              </div>
            </div>
          </div>

          <!-- Floating badges below the card -->
          <div class="flex items-center justify-between mt-4 px-2">
            <div class="hero-badge rounded-2xl px-3.5 py-2 flex items-center gap-2.5 animate-float" style="animation-delay:-4s;">
              <div class="w-7 h-7 bg-mousse-100 rounded-lg flex items-center justify-center">
                <Check size={13} class="text-mousse-600" />
              </div>
              <div>
                <p class="text-[11px] font-semibold text-warm-800">Maman d'Emma a consulté le carnet</p>
                <p class="text-[10px] text-mousse-600 font-medium">Lu il y a 3 min</p>
              </div>
            </div>
            <div class="hero-badge rounded-xl px-3 py-2 flex items-center gap-2 animate-float" style="animation-delay:-9s;">
              <div class="w-7 h-7 bg-miel-100 rounded-lg flex items-center justify-center">
                <BookOpen size={13} class="text-miel-600" />
              </div>
              <span class="text-[11px] font-semibold text-warm-700">3/4 carnets remplis</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       LE PROBLEME — Pourquoi Le Cocon ?
       ═══════════════════════════════════════ -->
  <section class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-14">
        <h2 class="animate-on-scroll fade-up font-display text-3xl sm:text-4xl font-bold text-warm-900 mb-4">
          Vous reconnaissez ça ?
        </h2>
        <p class="animate-on-scroll fade-up delay-100 text-lg text-warm-600 max-w-2xl mx-auto">
          Si vous êtes assistante maternelle, vous faites probablement ça tous les jours.
        </p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each [
          { icon: MessageSquare, text: "Envoyer des SMS aux parents un par un pour raconter la journée" },
          { icon: BookOpen, text: "Remplir un carnet papier que les parents oublient chez vous" },
          { icon: Clock, text: "Passer du temps à expliquer les mêmes choses au téléphone le soir" },
          { icon: Baby, text: "Oublier un détail important sur la journée d'un enfant" }
        ] as item}
          <div class="animate-on-scroll fade-up">
            <div class="glass-1 rounded-2xl p-5 h-full">
              <div class="w-10 h-10 rounded-xl bg-argile-400/10 flex items-center justify-center mb-3">
                <item.icon size={20} class="text-argile-500" />
              </div>
              <p class="text-sm text-warm-700 leading-relaxed">{item.text}</p>
            </div>
          </div>
        {/each}
      </div>

      <div class="animate-on-scroll fade-up text-center mt-10">
        <p class="text-lg font-display font-bold text-warm-900">
          Le Cocon règle tout ça. En quelques clics, c'est fait.
        </p>
      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       FONCTIONNALITES
       ═══════════════════════════════════════ -->
  <section id="fonctionnalites" class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-14">
        <h2 class="animate-on-scroll fade-up font-display text-3xl sm:text-4xl font-bold text-warm-900 mb-4">
          Ce que fait Le Cocon, concrètement
        </h2>
        <p class="animate-on-scroll fade-up delay-100 text-lg text-warm-600 max-w-2xl mx-auto">
          Des outils simples pour noter la journée des enfants et la partager avec les parents.
        </p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">

        <div class="animate-on-scroll fade-up delay-100">
          <div class="feature-card glass-1 rounded-3xl p-6 h-full">
            <div class="w-13 h-13 bg-miel-100 rounded-2xl flex items-center justify-center mb-4">
              <BookOpen size={26} class="text-miel-600" />
            </div>
            <h3 class="font-display font-bold text-lg text-warm-900 mb-2">Carnet quotidien</h3>
            <p class="text-sm text-warm-700 leading-relaxed">
              Remplissez une fiche par enfant chaque jour : repas, sieste, humeur, changes, santé, notes.
              Les parents la voient immédiatement.
            </p>
          </div>
        </div>

        <div class="animate-on-scroll fade-up delay-200">
          <div class="feature-card glass-1 rounded-3xl p-6 h-full">
            <div class="w-13 h-13 bg-sienne-100 rounded-2xl flex items-center justify-center mb-4">
              <UtensilsCrossed size={26} class="text-sienne-500" />
            </div>
            <h3 class="font-display font-bold text-lg text-warm-900 mb-2">Suivi des repas</h3>
            <p class="text-sm text-warm-700 leading-relaxed">
              Notez ce que l'enfant a mangé et en quelle quantité. Le menu du jour peut être pré-rempli pour gagner du temps.
            </p>
          </div>
        </div>

        <div class="animate-on-scroll fade-up delay-300">
          <div class="feature-card glass-1 rounded-3xl p-6 h-full">
            <div class="w-13 h-13 bg-bleu-400/15 rounded-2xl flex items-center justify-center mb-4">
              <Moon size={26} class="text-bleu-500" />
            </div>
            <h3 class="font-display font-bold text-lg text-warm-900 mb-2">Sieste et humeur</h3>
            <p class="text-sm text-warm-700 leading-relaxed">
              Indiquez les heures de sieste, la qualité du sommeil et l'humeur de l'enfant.
              Les parents savent comment s'est passé la journée.
            </p>
          </div>
        </div>

        <div class="animate-on-scroll fade-up delay-100">
          <div class="feature-card glass-1 rounded-3xl p-6 h-full">
            <div class="w-13 h-13 bg-mousse-100 rounded-2xl flex items-center justify-center mb-4">
              <Newspaper size={26} class="text-mousse-600" />
            </div>
            <h3 class="font-display font-bold text-lg text-warm-900 mb-2">News</h3>
            <p class="text-sm text-warm-700 leading-relaxed">
              Partagez des nouvelles, des photos et des moments forts avec les parents de chaque enfant. Ils voient tout depuis leur téléphone.
            </p>
          </div>
        </div>

        <div class="animate-on-scroll fade-up delay-200">
          <div class="feature-card glass-1 rounded-3xl p-6 h-full">
            <div class="w-13 h-13 bg-soleil-400/15 rounded-2xl flex items-center justify-center mb-4">
              <Calendar size={26} class="text-soleil-500" />
            </div>
            <h3 class="font-display font-bold text-lg text-warm-900 mb-2">Absences et calendrier</h3>
            <p class="text-sm text-warm-700 leading-relaxed">
              Les parents signalent les absences et retards directement dans l'appli. Vous avez une vue calendrier de tout.
            </p>
          </div>
        </div>

        <div class="animate-on-scroll fade-up delay-300">
          <div class="feature-card glass-1 rounded-3xl p-6 h-full">
            <div class="w-13 h-13 bg-miel-100 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles size={26} class="text-miel-600" />
            </div>
            <h3 class="font-display font-bold text-lg text-warm-900 mb-2">Assistant IA</h3>
            <p class="text-sm text-warm-700 leading-relaxed">
              Demandez "Qu'a mangé Lucas cette semaine ?" et l'assistant vous répond en cherchant dans les carnets. Pratique pour les bilans.
            </p>
          </div>
        </div>

      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       COMMENT CA MARCHE
       ═══════════════════════════════════════ -->
  <section id="comment-ca-marche" class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <div class="text-center mb-14">
        <h2 class="animate-on-scroll fade-up font-display text-3xl sm:text-4xl font-bold text-warm-900 mb-4">
          Prêt en 3 étapes
        </h2>
        <p class="animate-on-scroll fade-up delay-100 text-lg text-warm-600">
          Pas besoin d'être à l'aise avec l'informatique. C'est fait pour être simple.
        </p>
      </div>

      <div class="relative">
        <!-- Connecting line (desktop) — animated on scroll -->
        <div class="hidden md:block absolute top-8 left-[16.66%] right-[16.66%] h-[2px] z-0">
          <div class="animate-on-scroll steps-line h-full rounded-full bg-linear-to-r from-miel-200 via-miel-400 to-miel-200"></div>
        </div>

        <div class="grid md:grid-cols-3 gap-10">
          {#each [
            { num: '1', title: "Créez votre compte", desc: "Choisissez \"assistante maternelle\" ou \"parent\". Renseignez votre nom et votre email. C'est tout." },
            { num: '2', title: "Ajoutez les enfants", desc: "L'assistante ajoute chaque enfant et génère un code d'invitation. Le parent entre ce code pour se connecter." },
            { num: '3', title: "Remplissez et partagez", desc: "Chaque jour, l'assistante remplit le carnet. Les parents le voient tout de suite sur leur téléphone." }
          ] as step, i}
            <div class="animate-on-scroll fade-up delay-{(i + 1) * 100} text-center">
              <div class="relative z-10 w-16 h-16 mx-auto glass-1 rounded-2xl flex items-center justify-center mb-5" style="box-shadow: 0 8px 24px rgba(194,101,58,0.1);">
                <span class="font-display font-bold text-2xl text-miel-600">{step.num}</span>
              </div>
              <h3 class="font-display font-bold text-lg text-warm-900 mb-2">{step.title}</h3>
              <p class="text-sm text-warm-700 leading-relaxed">{step.desc}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       POUR QUI ?
       ═══════════════════════════════════════ -->
  <section class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-14">
        <h2 class="animate-on-scroll fade-up font-display text-3xl sm:text-4xl font-bold text-warm-900 mb-4">
          Pour les assistantes maternelles et les parents
        </h2>
      </div>

      <div class="grid md:grid-cols-2 gap-6">
        <!-- Assistantes -->
        <div class="animate-on-scroll fade-left">
          <div class="glass-1 rounded-3xl p-7 h-full">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-12 h-12 bg-miel-100 rounded-xl flex items-center justify-center">
                <Heart size={24} class="text-miel-600" />
              </div>
              <div>
                <h3 class="font-display font-bold text-xl text-warm-900">Assistantes maternelles</h3>
                <p class="text-sm text-warm-600">Gagnez du temps au quotidien</p>
              </div>
            </div>
            <ul class="space-y-3">
              {#each [
                "Remplissez les carnets en quelques clics, pas de cahier à transporter",
                "La saisie rapide permet de faire tous les enfants en une seule fois",
                "Les parents sont informés automatiquement, plus besoin de les appeler",
                "Vos notes et historiques sont sauvegardés, rien ne se perd",
                "Le menu du jour se pré-remplit dans les fiches"
              ] as item}
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-mousse-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} class="text-mousse-600" />
                  </div>
                  <span class="text-sm text-warm-800">{item}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>

        <!-- Parents -->
        <div class="animate-on-scroll fade-right delay-200">
          <div class="glass-1 rounded-3xl p-7 h-full">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-12 h-12 bg-bleu-400/15 rounded-xl flex items-center justify-center">
                <Users size={24} class="text-bleu-500" />
              </div>
              <div>
                <h3 class="font-display font-bold text-xl text-warm-900">Parents</h3>
                <p class="text-sm text-warm-600">Suivez la journée de votre enfant</p>
              </div>
            </div>
            <ul class="space-y-3">
              {#each [
                "Consultez le carnet du jour : repas, sieste, humeur, santé",
                "Recevez les nouvelles et photos dans les news",
                "Signalez une absence ou un retard en 2 clics",
                "Envoyez des notes à l'assistante (médicaments, consignes...)",
                "Posez des questions à l'assistant IA sur l'historique"
              ] as item}
                <li class="flex items-start gap-3">
                  <div class="w-5 h-5 rounded-full bg-bleu-400/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} class="text-bleu-500" />
                  </div>
                  <span class="text-sm text-warm-800">{item}</span>
                </li>
              {/each}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       TEMOIGNAGES
       ═══════════════════════════════════════ -->
  <section id="temoignages" class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-14">
        <h2 class="animate-on-scroll fade-up font-display text-3xl sm:text-4xl font-bold text-warm-900 mb-4">
          Ce qu'en disent les utilisateurs
        </h2>
      </div>

      <div class="grid md:grid-cols-3 gap-5">

        <div class="animate-on-scroll fade-up delay-100">
          <div class="testimonial-card glass-1 rounded-3xl p-6 h-full">
            <div class="flex items-center gap-0.5 mb-4">
              {#each Array(5) as _}
                <Star size={15} class="text-soleil-400 fill-soleil-400" />
              {/each}
            </div>
            <blockquote class="text-sm text-warm-800 mb-5 leading-relaxed">
              "Je gardais 4 enfants et je passais mes soirées à envoyer des messages aux parents.
              Maintenant je remplis le carnet pendant la sieste et c'est fini. Ça me change la vie."
            </blockquote>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-linear-to-br from-miel-200 to-miel-300 rounded-full flex items-center justify-center font-semibold text-sm text-miel-800">
                NB
              </div>
              <div>
                <p class="text-sm font-semibold text-warm-900">Nathalie B.</p>
                <p class="text-xs text-warm-500">Assistante maternelle, Nantes</p>
              </div>
            </div>
          </div>
        </div>

        <div class="animate-on-scroll fade-up delay-200">
          <div class="testimonial-card glass-1 rounded-3xl p-6 h-full">
            <div class="flex items-center gap-0.5 mb-4">
              {#each Array(5) as _}
                <Star size={15} class="text-soleil-400 fill-soleil-400" />
              {/each}
            </div>
            <blockquote class="text-sm text-warm-800 mb-5 leading-relaxed">
              "Le soir en rentrant du travail, je sais déjà ce qu'il a mangé, combien de temps il a dormi
              et comment il allait. Ça me rassure énormément."
            </blockquote>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-linear-to-br from-bleu-400/30 to-bleu-400/50 rounded-full flex items-center justify-center font-semibold text-sm text-bleu-500">
                SR
              </div>
              <div>
                <p class="text-sm font-semibold text-warm-900">Sophie R.</p>
                <p class="text-xs text-warm-500">Maman de Gabriel, 14 mois</p>
              </div>
            </div>
          </div>
        </div>

        <div class="animate-on-scroll fade-up delay-300">
          <div class="testimonial-card glass-1 rounded-3xl p-6 h-full">
            <div class="flex items-center gap-0.5 mb-4">
              {#each Array(5) as _}
                <Star size={15} class="text-soleil-400 fill-soleil-400" />
              {/each}
            </div>
            <blockquote class="text-sm text-warm-800 mb-5 leading-relaxed">
              "J'avais peur que ce soit compliqué mais pas du tout. J'ai créé mon compte en 2 minutes
              et j'ai commencé à remplir les fiches le jour même. Très bien pensé."
            </blockquote>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-linear-to-br from-sienne-200 to-sienne-300 rounded-full flex items-center justify-center font-semibold text-sm text-sienne-800">
                MC
              </div>
              <div>
                <p class="text-sm font-semibold text-warm-900">Marie C.</p>
                <p class="text-xs text-warm-500">Assistante maternelle, Lyon</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       SECURITE
       ═══════════════════════════════════════ -->
  <section class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-4xl mx-auto">
      <div class="animate-on-scroll scale-in bg-warm-900 rounded-3xl p-8 sm:p-12 relative overflow-hidden">
        <!-- Decorative -->
        <div class="absolute top-0 left-0 w-40 h-40 bg-miel-500/8 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
        <div class="absolute bottom-0 right-0 w-48 h-48 bg-miel-500/8 rounded-full translate-x-1/2 translate-y-1/2"></div>

        <div class="relative text-center">
          <div class="w-14 h-14 bg-miel-500/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Shield size={28} class="text-miel-300" />
          </div>

          <h2 class="font-display text-2xl sm:text-3xl font-bold text-warm-50 mb-4">
            Vos données sont protégées
          </h2>

          <p class="text-warm-300 mb-8 max-w-lg mx-auto text-sm leading-relaxed">
            On parle d'enfants, la sécurité n'est pas optionnelle.
            Voici ce qu'on fait pour protéger vos informations.
          </p>

          <div class="grid sm:grid-cols-3 gap-6 text-left">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 bg-miel-500/15 rounded-xl flex items-center justify-center shrink-0">
                <Lock size={18} class="text-miel-300" />
              </div>
              <div>
                <p class="font-semibold text-warm-50 text-sm">Chiffrement</p>
                <p class="text-xs text-warm-400">Toutes les données sont chiffrées en transit et au repos</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 bg-miel-500/15 rounded-xl flex items-center justify-center shrink-0">
                <Shield size={18} class="text-miel-300" />
              </div>
              <div>
                <p class="font-semibold text-warm-50 text-sm">Hébergement français</p>
                <p class="text-xs text-warm-400">Serveurs Scaleway en France, conformes RGPD</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 bg-miel-500/15 rounded-xl flex items-center justify-center shrink-0">
                <Users size={18} class="text-miel-300" />
              </div>
              <div>
                <p class="font-semibold text-warm-50 text-sm">Accès restreint</p>
                <p class="text-xs text-warm-400">Seuls vous et les parents liés à un enfant voient ses infos</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       TARIFS
       ═══════════════════════════════════════ -->
  <section id="tarifs" class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-lg mx-auto text-center">
      <h2 class="animate-on-scroll fade-up font-display text-3xl sm:text-4xl font-bold text-warm-900 mb-4">
        Gratuit pendant le lancement
      </h2>
      <p class="animate-on-scroll fade-up delay-100 text-warm-600 mb-10">
        Le Cocon est en phase de lancement. Toutes les fonctionnalités sont gratuites, sans engagement.
      </p>

      <div class="animate-on-scroll scale-in delay-200">
        <div class="glass-1 rounded-3xl p-8" style="box-shadow: 0 16px 48px rgba(194,101,58,0.12);">
          <p class="text-sm font-semibold text-miel-600 uppercase tracking-wider mb-2">Offre de lancement</p>
          <div class="flex items-baseline justify-center gap-1 mb-2">
            <span class="font-display text-5xl font-bold text-warm-900">0</span>
            <span class="text-2xl font-display font-bold text-warm-900">&euro;</span>
          </div>
          <p class="text-sm text-warm-500 mb-6">par mois, sans limite</p>

          <ul class="space-y-3 text-left mb-8">
            {#each [
              "Carnet quotidien complet",
              "Nombre d'enfants illimité",
              "News et photos",
              "Calendrier des absences",
              "Notes aux parents",
              "Assistant IA",
              "Codes d'invitation parents"
            ] as item}
              <li class="flex items-center gap-3">
                <div class="w-5 h-5 rounded-full bg-mousse-100 flex items-center justify-center shrink-0">
                  <Check size={12} class="text-mousse-600" />
                </div>
                <span class="text-sm text-warm-800">{item}</span>
              </li>
            {/each}
          </ul>

          <Button variant="primary" size="lg" href="/onboarding" class="w-full">
            Créer mon compte
          </Button>
          <p class="text-xs text-warm-400 mt-3">Pas de carte bancaire demandée</p>
        </div>
      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       FAQ
       ═══════════════════════════════════════ -->
  <section class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto">
      <h2 class="animate-on-scroll fade-up font-display text-3xl sm:text-4xl font-bold text-warm-900 mb-10 text-center">
        Questions fréquentes
      </h2>

      <div class="space-y-3">
        {#each faqs as faq, i}
          <div class="animate-on-scroll fade-up">
            <button
              type="button"
              onclick={() => toggleFaq(i)}
              class="w-full glass-1 rounded-2xl px-6 py-4 text-left transition-colors hover:bg-warm-50/40"
              aria-expanded={openFaq === i}
            >
              <div class="flex items-center justify-between gap-4">
                <span class="text-sm font-semibold text-warm-900">{faq.q}</span>
                <ChevronDown
                  size={18}
                  class="text-warm-400 shrink-0 transition-transform duration-300
                    {openFaq === i ? 'rotate-180' : ''}"
                />
              </div>
              {#if openFaq === i}
                <p class="text-sm text-warm-700 mt-3 leading-relaxed pr-8">{faq.a}</p>
              {/if}
            </button>
          </div>
        {/each}
      </div>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       CTA FINAL
       ═══════════════════════════════════════ -->
  <section class="py-20 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto text-center">
      <h2 class="animate-on-scroll fade-up font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-warm-900 mb-6 leading-tight">
        Prête à essayer ?
      </h2>
      <p class="animate-on-scroll fade-up delay-100 text-lg text-warm-600 mb-8 max-w-xl mx-auto">
        Créez votre compte en 1 minute, ajoutez vos premiers enfants et commencez à remplir les journaux dès aujourd'hui.
      </p>

      <div class="animate-on-scroll fade-up delay-200 flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
        <Button variant="primary" size="lg" href="/onboarding">
          Créer mon compte gratuitement
          <ArrowRight size={18} />
        </Button>
      </div>

      <p class="animate-on-scroll fade-up delay-300 text-sm text-warm-500">
        Gratuit &middot; Sans engagement &middot; Sans carte bancaire
      </p>
    </div>
  </section>


  <!-- ═══════════════════════════════════════
       FOOTER
       ═══════════════════════════════════════ -->
  <footer class="bg-warm-900 text-warm-300 py-14 px-4">
    <div class="max-w-6xl mx-auto">
      <div class="grid md:grid-cols-4 gap-10 mb-10">
        <!-- Brand -->
        <div class="md:col-span-2">
          <div class="flex items-center gap-2.5 mb-4">
            <img src="/favicon.png" alt="Le Cocon" class="w-9 h-9" />
            <span class="font-display font-bold text-xl text-warm-50">Le Cocon</span>
          </div>
          <p class="text-sm text-warm-400 max-w-sm leading-relaxed">
            Le cahier de liaison numérique pour les assistantes maternelles et les parents.
            Simple, sécurisé, gratuit.
          </p>
        </div>

        <!-- Navigation -->
        <div>
          <h4 class="font-semibold text-warm-50 mb-4 text-sm">Navigation</h4>
          <ul class="space-y-2.5 text-sm">
            <li><a href="#fonctionnalites" class="hover:text-warm-50 transition-colors">Fonctionnalités</a></li>
            <li><a href="#comment-ca-marche" class="hover:text-warm-50 transition-colors">Comment ça marche</a></li>
            <li><a href="#temoignages" class="hover:text-warm-50 transition-colors">Témoignages</a></li>
            <li><a href="#tarifs" class="hover:text-warm-50 transition-colors">Tarifs</a></li>
          </ul>
        </div>

        <!-- Legal -->
        <div>
          <h4 class="font-semibold text-warm-50 mb-4 text-sm">Légal</h4>
          <ul class="space-y-2.5 text-sm">
            <li><a href="/legal/mentions" class="hover:text-warm-50 transition-colors">Mentions légales</a></li>
            <li><a href="/legal/confidentialite" class="hover:text-warm-50 transition-colors">Confidentialité</a></li>
            <li><a href="/legal/cgu" class="hover:text-warm-50 transition-colors">CGU</a></li>
          </ul>
        </div>
      </div>

      <div class="border-t border-warm-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-xs text-warm-500">
          &copy; 2025 Le Cocon. Tous droits réservés.
        </p>
        <p class="text-xs text-warm-500 flex items-center gap-1.5">
          Fait avec <Heart size={12} class="text-argile-400" /> en France
        </p>
      </div>
    </div>
  </footer>

</div>

<style>
  .landing-nav {
    background: rgba(255, 248, 240, 0.8);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  }

  .orb {
    position: fixed;
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    filter: blur(80px);
    animation: orbFloat 20s ease-in-out infinite;
  }

  @keyframes orbFloat {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(15px, -20px) scale(1.05); }
    66% { transform: translate(-10px, 10px) scale(0.97); }
  }

  .hero-mockup-area {
    min-height: 420px;
  }

  .hero-card-main {
    background: rgba(255, 248, 240, 0.72);
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow:
      0 20px 60px rgba(194, 101, 58, 0.1),
      0 4px 16px rgba(194, 101, 58, 0.06);
  }

  .hero-card-bg {
    background: rgba(255, 248, 240, 0.35);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(194, 101, 58, 0.06);
  }

  .hero-badge {
    background: rgba(255, 248, 240, 0.55);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 6px 20px rgba(194, 101, 58, 0.07);
  }

  .w-13 {
    width: 3.25rem;
  }
  .h-13 {
    height: 3.25rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .orb { animation: none !important; }
  }
</style>
