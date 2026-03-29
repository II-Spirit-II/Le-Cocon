export * from './auth';

export type CareWeekday = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';

export interface CareDay {
  start: string; // HH:MM
  end: string;   // HH:MM
}

/** Map of weekday → time slot. Only present days are care days. */
export type CareSchedule = Partial<Record<CareWeekday, CareDay>>;

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  avatarPath?: string;
  careSchedule: CareSchedule;
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


// -- Attendance --

export type AttendanceStatus = 'present' | 'absent_planned' | 'absent_unplanned';
export type CheckMethod = 'qr' | 'manual';
export type PersonType = 'parent' | 'authorized_person';

export interface Attendance {
  id: string;
  childId: string;
  date: string;
  status: AttendanceStatus;
  arrivalTime: string | null;
  arrivalPersonType: PersonType | null;
  arrivalPersonId: string | null;
  arrivalMethod: CheckMethod | null;
  departureTime: string | null;
  departurePersonType: PersonType | null;
  departurePersonId: string | null;
  departureMethod: CheckMethod | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceWithChild extends Attendance {
  childFirstName: string;
  childLastName: string;
  childAvatar: string | null;
  expectedStart: string | null;
  expectedEnd: string | null;
  parentIds: string[];
}

export interface MonthlyChildReport {
  childId: string;
  childFirstName: string;
  childLastName: string;
  childAvatar: string | null;
  expectedHours: number;
  actualHours: number;
  deltaHours: number;
  daysPresent: number;
  daysAbsentPlanned: number;
  daysAbsentUnplanned: number;
  daysExpected: number;
}

export interface AuthorizedPerson {
  id: string;
  childId: string;
  name: string;
  relationship: string;
  phone: string | null;
  photoPath: string | null;
  active: boolean;
  createdAt: string;
}

// -- AI Action Results --

export type ActionType = 'create_journal' | 'create_news';

export interface ActionResult {
  type: ActionType;
  success: boolean;
  message: string;
  resourcePath?: string;
  resourceLabel?: string;
}

// -- Parent Notes --

export type ParentNoteKind = 'absence' | 'retard' | 'sante' | 'logistique' | 'autre';

export interface CalendarEvent {
  id: string;
  childId: string;
  childName: string;
  kind: ParentNoteKind;
  startDate: string;
  endDate: string;
  content: string;
  acknowledgedAt: string | null;
  createdAt: string;
}

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
