/**
 * Drizzle ORM schema — Le Cocon database.
 * UUIDs auto-generated, timestamps with timezone, proper indexes.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['assistante', 'parent']);
export const moodLevelEnum = pgEnum('mood_level', ['grognon', 'calme', 'joyeux']);
export const mealTypeEnum = pgEnum('meal_type', ['petit-dejeuner', 'dejeuner', 'gouter']);
export const parentNoteKindEnum = pgEnum('parent_note_kind', [
  'absence', 'retard', 'sante', 'logistique', 'autre'
]);

// ── Users (auth) ─────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  avatar: varchar('avatar', { length: 500 }).default(''),
  emailVerified: boolean('email_verified').notNull().default(false),
  defaultNapStart: varchar('default_nap_start', { length: 5 }),
  defaultNapEnd: varchar('default_nap_end', { length: 5 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Email Verifications ──────────────────────────────────────────────────────

export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
}, (table) => [
  index('email_verifications_user_idx').on(table.userId),
  index('email_verifications_expires_idx').on(table.expiresAt),
]);

// ── User Consents (RGPD) ─────────────────────────────────────────────────────

export const userConsents = pgTable('user_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 20 }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('user_consents_user_idx').on(table.userId),
]);

// ── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  userAgent: text('user_agent').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  index('sessions_user_idx').on(table.userId),
  index('sessions_token_hash_idx').on(table.tokenHash),
  index('sessions_expires_idx').on(table.expiresAt),
]);

// ── Children ─────────────────────────────────────────────────────────────────

export const children = pgTable('children', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  birthDate: date('birth_date').notNull(),
  avatar: varchar('avatar', { length: 500 }).default(''),
  assistanteId: uuid('assistante_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('children_assistante_idx').on(table.assistanteId),
]);

// ── Parent-Children (junction) ───────────────────────────────────────────────

export const parentChildren = pgTable('parent_children', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: uuid('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('parent_child_unique').on(table.parentId, table.childId),
  index('parent_children_child_idx').on(table.childId),
]);

// ── Daily Logs ───────────────────────────────────────────────────────────────

export const dailyLogs = pgTable('daily_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  meals: jsonb('meals').notNull().default([]),
  nap: jsonb('nap'),
  mood: moodLevelEnum('mood').notNull().default('calme'),
  health: jsonb('health'),
  changes: integer('changes').notNull().default(0),
  notes: text('notes').default(''),
  menuId: uuid('menu_id').references(() => menus.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('daily_log_child_date').on(table.childId, table.date),
  index('daily_logs_author_idx').on(table.authorId),
]);

// ── News ─────────────────────────────────────────────────────────────────────

export const news = pgTable('news', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  emoji: varchar('emoji', { length: 10 }),
  attachment: varchar('attachment', { length: 500 }).default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('news_child_idx').on(table.childId),
  index('news_created_at_idx').on(table.createdAt),
  index('news_author_idx').on(table.authorId),
]);

// ── Menus ────────────────────────────────────────────────────────────────────

export const menus = pgTable('menus', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  mealType: mealTypeEnum('meal_type').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('menu_date_meal_type').on(table.date, table.mealType),
]);

// ── Parent Notes ─────────────────────────────────────────────────────────────

export const parentNotes = pgTable('parent_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: parentNoteKindEnum('kind').notNull(),
  content: text('content').notNull(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  assistantAcknowledgedAt: timestamp('assistant_acknowledged_at', { withTimezone: true }),
  assistantAcknowledgedById: uuid('assistant_acknowledged_by_id').references(() => users.id, { onDelete: 'set null' }),
  assistantResponse: text('assistant_response'),
  assistantRespondedAt: timestamp('assistant_responded_at', { withTimezone: true }),
  parentSeenResponseAt: timestamp('parent_seen_response_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('parent_notes_child_idx').on(table.childId),
  index('parent_notes_date_range_idx').on(table.startDate, table.endDate),
  index('parent_notes_kind_idx').on(table.kind),
  index('parent_notes_ack_idx').on(table.assistantAcknowledgedAt),
  index('parent_notes_created_by_idx').on(table.createdById),
]);

// ── Invite Codes ─────────────────────────────────────────────────────────────

export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 8 }).notNull().unique(),
  childId: uuid('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  usedById: uuid('used_by_id').references(() => users.id, { onDelete: 'set null' }),
  usedAt: timestamp('used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('invite_codes_child_idx').on(table.childId),
  index('invite_codes_expires_idx').on(table.expiresAt),
]);
