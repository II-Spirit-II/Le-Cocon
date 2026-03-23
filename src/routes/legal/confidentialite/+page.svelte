<svelte:head>
  <title>Politique de confidentialité - Le Cocon</title>
</svelte:head>

<h1 class="text-2xl font-display font-bold text-warm-900 mb-6">Politique de confidentialité</h1>

<p class="text-sm text-warm-400 mb-8">Dernière mise à jour : 22 mars 2026 — Version 1.0</p>

<div class="prose prose-warm max-w-none">
  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">1. Responsable du traitement</h2>
    <p class="text-warm-600 leading-relaxed">
      Le responsable du traitement des données à caractère personnel collectées via l'application
      Le Cocon est l'opérateur identifié dans les
      <a href="/legal/mentions" class="text-miel-600 hover:text-miel-700 underline">mentions légales</a>.
    </p>
    <p class="text-warm-600 leading-relaxed mt-2">
      Contact : <a href="mailto:contact@lecocon.app" class="text-miel-600 hover:text-miel-700 underline">contact@lecocon.app</a>
    </p>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">2. Données collectées</h2>
    <p class="text-warm-600 leading-relaxed">
      Le Cocon collecte uniquement les données strictement nécessaires au fonctionnement du service
      de cahier de liaison numérique entre professionnels de la petite enfance et parents.
    </p>
    <p class="text-warm-600 leading-relaxed mt-2">
      Les catégories de données collectées sont les suivantes :
    </p>
    <ul class="list-disc list-inside text-warm-600 mt-2 space-y-1">
      <li><strong>Données de compte</strong> : nom, adresse email, mot de passe (chiffré par hachage bcrypt, jamais stocké en clair)</li>
      <li><strong>Données relatives aux enfants</strong> : prénom, nom, date de naissance, photo d'avatar (facultative)</li>
      <li><strong>Carnets quotidiens</strong> : repas, siestes, humeur, santé, changes, notes de la journée</li>
      <li><strong>Communications</strong> : news, notes parentales, codes d'invitation</li>
      <li><strong>Menus</strong> : descriptions des repas prévus</li>
      <li><strong>Données techniques</strong> : cookie d'authentification (jeton JWT), horodatage des actions</li>
    </ul>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">3. Bases légales du traitement</h2>
    <p class="text-warm-600 leading-relaxed">
      Les traitements de données personnelles mis en œuvre reposent sur les bases légales suivantes :
    </p>
    <ul class="list-disc list-inside text-warm-600 mt-2 space-y-1">
      <li><strong>Exécution du contrat</strong> (article 6.1.b du RGPD) : les données de compte et les journaux quotidiens sont nécessaires à la fourniture du service de cahier de liaison</li>
      <li><strong>Consentement</strong> (article 6.1.a du RGPD) : le traitement des données des enfants, personnes mineures, est fondé sur le consentement du ou des titulaires de l'autorité parentale, recueilli lors de l'inscription</li>
      <li><strong>Intérêt légitime</strong> (article 6.1.f du RGPD) : la sécurisation du service et la prévention des abus</li>
    </ul>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">4. Finalités du traitement</h2>
    <p class="text-warm-600 leading-relaxed">
      Vos données sont utilisées exclusivement pour :
    </p>
    <ul class="list-disc list-inside text-warm-600 mt-2 space-y-1">
      <li>Permettre le suivi quotidien des enfants entre professionnels et parents</li>
      <li>Assurer la communication entre les utilisateurs autorisés</li>
      <li>Générer des synthèses et répondre aux questions via l'assistant IA intégré (voir section 7)</li>
      <li>Garantir la sécurité et le bon fonctionnement du service</li>
    </ul>
    <p class="text-warm-600 leading-relaxed mt-2">
      Aucune donnée n'est utilisée à des fins publicitaires, de profilage commercial ou de revente à des tiers.
    </p>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">5. Durées de conservation</h2>
    <p class="text-warm-600 leading-relaxed">
      Les données sont conservées pour les durées suivantes :
    </p>
    <ul class="list-disc list-inside text-warm-600 mt-2 space-y-1">
      <li><strong>Journaux quotidiens</strong> : 3 ans à compter de la date de saisie, afin de permettre un suivi longitudinal de l'enfant</li>
      <li><strong>Données de compte</strong> : conservées tant que le compte est actif, puis supprimées dans un délai de 30 jours après une demande de suppression</li>
      <li><strong>Données des enfants</strong> : conservées tant qu'au moins un utilisateur autorisé dispose d'un compte actif, puis supprimées avec le dernier compte associé</li>
      <li><strong>Codes d'invitation</strong> : supprimés automatiquement après utilisation ou expiration</li>
      <li><strong>Cookies d'authentification</strong> : durée de la session, supprimé à la déconnexion</li>
    </ul>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">6. Stockage et sécurité</h2>
    <p class="text-warm-600 leading-relaxed">
      Toutes les données sont stockées sur des infrastructures Scaleway, hébergeur français dont les
      centres de données sont situés en France. Les données ne quittent jamais le territoire de l'Union
      européenne.
    </p>
    <p class="text-warm-600 leading-relaxed mt-2">
      Mesures de sécurité mises en œuvre :
    </p>
    <ul class="list-disc list-inside text-warm-600 mt-2 space-y-1">
      <li>Chiffrement des mots de passe par hachage bcrypt</li>
      <li>Authentification par jetons JWT signés côté serveur</li>
      <li>Communications chiffrées en transit (HTTPS/TLS)</li>
      <li>Contrôle d'accès strict : chaque utilisateur n'accède qu'aux données des enfants qui lui sont associés</li>
      <li>Base de données PostgreSQL managée avec sauvegardes automatiques</li>
      <li>Limitation du nombre de tentatives de connexion (protection contre les attaques par force brute)</li>
    </ul>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">7. Assistant IA</h2>
    <p class="text-warm-600 leading-relaxed">
      Le Cocon intègre un assistant fondé sur l'intelligence artificielle, destiné à aider les
      utilisateurs dans le suivi des enfants (synthèses, réponses aux questions).
    </p>
    <ul class="list-disc list-inside text-warm-600 mt-2 space-y-1">
      <li>Le traitement IA est effectué par l'API Scaleway Generative (modèle Mistral), hébergée en France</li>
      <li>Seules les données de l'utilisateur connecté et des enfants qui lui sont associés sont transmises au modèle pour générer une réponse</li>
      <li>Aucune donnée n'est utilisée pour entraîner ou améliorer les modèles d'IA</li>
      <li>Aucune donnée ne transite en dehors de l'Union européenne dans le cadre de ce traitement</li>
    </ul>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">8. Sous-traitants</h2>
    <p class="text-warm-600 leading-relaxed">
      Le Cocon fait appel aux sous-traitants suivants pour le fonctionnement du service.
      L'ensemble des données restent hébergées en France.
    </p>
    <div class="mt-3 overflow-x-auto">
      <table class="w-full text-sm text-warm-600">
        <thead>
          <tr class="border-b border-warm-200">
            <th class="text-left py-2 pr-4 font-semibold text-warm-700">Sous-traitant</th>
            <th class="text-left py-2 pr-4 font-semibold text-warm-700">Service</th>
            <th class="text-left py-2 font-semibold text-warm-700">Localisation</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-warm-100">
            <td class="py-2 pr-4">Scaleway SAS</td>
            <td class="py-2 pr-4">Hébergement applicatif (Serverless)</td>
            <td class="py-2">France</td>
          </tr>
          <tr class="border-b border-warm-100">
            <td class="py-2 pr-4">Scaleway SAS</td>
            <td class="py-2 pr-4">Base de données managée (PostgreSQL)</td>
            <td class="py-2">France</td>
          </tr>
          <tr class="border-b border-warm-100">
            <td class="py-2 pr-4">Scaleway SAS</td>
            <td class="py-2 pr-4">Intelligence artificielle (API Generative)</td>
            <td class="py-2">France</td>
          </tr>
          <tr>
            <td class="py-2 pr-4">Scaleway SAS</td>
            <td class="py-2 pr-4">Envoi d'emails transactionnels</td>
            <td class="py-2">France</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">9. Cookies</h2>
    <p class="text-warm-600 leading-relaxed">
      Le Cocon utilise uniquement un cookie technique strictement nécessaire au fonctionnement du
      service : le jeton d'authentification (<code class="text-sienne-600">auth_token</code>).
      Ce cookie permet de maintenir votre session connectée.
    </p>
    <p class="text-warm-600 leading-relaxed mt-2">
      Aucun cookie publicitaire, analytique ou de traçage n'est utilisé.
      Aucun consentement supplémentaire n'est donc requis au titre de l'article 82 de la loi
      Informatique et Libertés.
    </p>
  </section>

  <section class="mb-8">
    <h2 class="text-lg font-semibold text-warm-800 mb-3">10. Vos droits</h2>
    <p class="text-warm-600 leading-relaxed">
      Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi
      Informatique et Libertés, vous disposez des droits suivants :
    </p>
    <ul class="list-disc list-inside text-warm-600 mt-2 space-y-1">
      <li><strong>Droit d'accès</strong> : obtenir la confirmation que vos données sont traitées et en recevoir une copie</li>
      <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes</li>
      <li><strong>Droit à l'effacement</strong> : demander la suppression de vos données</li>
      <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré et lisible par machine</li>
      <li><strong>Droit d'opposition</strong> : vous opposer au traitement de vos données</li>
      <li><strong>Droit à la limitation</strong> : demander la suspension du traitement de vos données</li>
      <li><strong>Droit de retrait du consentement</strong> : retirer votre consentement à tout moment, sans que cela ne remette en cause la licéité du traitement effectué avant ce retrait</li>
    </ul>
    <p class="text-warm-600 leading-relaxed mt-3">
      <strong>Exercice de vos droits :</strong> vous pouvez exercer ces droits directement depuis
      l'application ou en écrivant à
      <a href="mailto:contact@lecocon.app" class="text-miel-600 hover:text-miel-700 underline">contact@lecocon.app</a>.
    </p>
    <ul class="list-disc list-inside text-warm-600 mt-2 space-y-1">
      <li><strong>Export de données</strong> : disponible à tout moment depuis la page <code class="text-sienne-600">/api/data-export</code></li>
      <li><strong>Suppression de compte</strong> : disponible depuis les paramètres de votre compte. La suppression est effective dans un délai maximum de 30 jours.</li>
    </ul>
    <p class="text-warm-600 leading-relaxed mt-3">
      En cas de difficulté dans l'exercice de vos droits, vous pouvez introduire une réclamation
      auprès de la Commission Nationale de l'Informatique et des Libertés (CNIL) :
      <a href="https://www.cnil.fr" class="text-miel-600 hover:text-miel-700 underline" target="_blank" rel="noopener">www.cnil.fr</a>.
    </p>
  </section>

  <section>
    <h2 class="text-lg font-semibold text-warm-800 mb-3">11. Modification de la politique</h2>
    <p class="text-warm-600 leading-relaxed">
      La présente politique de confidentialité peut être mise à jour pour refléter les évolutions du
      service ou de la réglementation applicable. En cas de modification substantielle, les
      utilisateurs en seront informés par notification dans l'application. La version en vigueur est
      toujours consultable sur cette page.
    </p>
  </section>
</div>
