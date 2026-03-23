import type { AIIntent } from './types';

// More specific patterns first to avoid false positives
const intentPatterns: Array<{ intent: AIIntent; keywords: string[] }> = [
  {
    intent: 'health_last',
    keywords: [
      'malade', 'maladie', 'fievre', 'temperature', 'toux', 'rhume',
      'medicament', 'symptome', 'sante', 'souffrant', 'mal', 'douleur',
      'vomi', 'diarrhee', 'allergie', 'vaccin', 'docteur', 'medecin'
    ]
  },
  {
    intent: 'absences',
    keywords: [
      'absent', 'absence', 'vacances', 'conge', 'pas venu', 'pas la',
      'manque', 'manquer', 'sera pas', 'etait pas', 'jour off', 'repos'
    ]
  },
  {
    intent: 'nap_recent',
    keywords: [
      'sieste', 'dormi', 'dort', 'dodo', 'sommeil', 'reveille',
      'reveil', 'couche', 'endormi', 'nuit', 'repos', 'fatigue'
    ]
  },
  {
    intent: 'meals_recent',
    keywords: [
      'mange', 'manger', 'repas', 'dejeuner', 'diner', 'petit-dejeuner',
      'gouter', 'nourriture', 'appetit', 'boire', 'biberon', 'aliment',
      'alimentation', 'assiette', 'compote', 'puree'
    ]
  },
  {
    intent: 'recap_week',
    keywords: [
      'resume', 'recapitulatif', 'recap', 'semaine', 'bilan',
      'comment ca s\'est passe', 'comment ca va', 'dernierement',
      'ces derniers jours', 'en general', 'globalement', 'vue d\'ensemble'
    ]
  },
  {
    intent: 'news_recent',
    keywords: [
      'news', 'actualite', 'nouvelle', 'quoi de neuf', 'derniere info',
      'activite', 'fait', 'journee', 'passe'
    ]
  }
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectIntent(question: string): AIIntent {
  const normalized = normalizeText(question);

  for (const { intent, keywords } of intentPatterns) {
    for (const keyword of keywords) {
      if (normalized.includes(normalizeText(keyword))) {
        return intent;
      }
    }
  }

  return 'fallback_unknown';
}

export const intentLabels: Record<AIIntent, string> = {
  meals_recent: 'Recent meals',
  nap_recent: 'Recent naps',
  health_last: 'Health',
  absences: 'Absences',
  recap_week: 'Week recap',
  news_recent: 'Recent news',
  fallback_unknown: 'General question'
};
