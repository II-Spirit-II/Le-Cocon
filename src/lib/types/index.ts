export * from './auth';

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  avatarPath?: string;
  parentIds: string[];
  assistanteId: string;
  createdAt: string;
}

export interface News {
  id: string;
  childId: string;
  authorId: string;
  content: string;
  emoji?: string;
  attachmentPath?: string;
  createdAt: string;
}

export type MealType = 'petit-dejeuner' | 'dejeuner' | 'gouter';

export interface Menu {
  id: string;
  date: string;
  mealType: MealType;
  description: string;
  createdAt: string;
}

export interface DailyLog {
  id: string;
  childId: string;
  authorId: string;
  date: string;
  meals: MealEntry[];
  nap: NapEntry | null;
  mood: MoodLevel;
  health: HealthEntry | null;
  changes: number;
  notes: string;
  menuId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Niveau de consommation du repas (0 à 3, utilisé par PlateVisual) */
export type MealLevel = 0 | 1 | 2 | 3;

export interface MealEntry {
  type: MealType | 'diner';
  description: string;
  quantity: 'non-mange' | 'peu' | 'bien' | 'tres-bien';
}

export interface NapEntry {
  startTime: string;
  endTime: string;
  quality: 'agitee' | 'normale' | 'paisible';
}

export type MoodLevel = 'grognon' | 'calme' | 'joyeux';

export interface HealthEntry {
  temperature?: number;
  symptoms?: string;
  medication?: string;
  notes?: string;
}


export type ParentNoteKind = 'absence' | 'retard' | 'sante' | 'logistique' | 'autre';

export interface ParentNote {
  id: string;
  childId: string;
  createdBy: string;
  kind: ParentNoteKind;
  content: string;
  startDate: string | null;
  endDate: string | null;
  assistantAcknowledgedAt: string | null;
  assistantAcknowledgedBy: string | null;
  assistantResponse: string | null;
  assistantRespondedAt: string | null;
  parentSeenResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
}
