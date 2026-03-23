/**
 * Zod validation schemas for all form inputs.
 * Single source of truth for input validation across routes.
 */
import { z } from 'zod';

// -- Reusable primitives --

const uuid = z.string().uuid();
const trimmedString = z.string().trim();
const dateString = z.string().date('Format attendu : YYYY-MM-DD');

// -- Auth --

export const loginSchema = z.object({
  email: trimmedString.email('Email invalide').toLowerCase(),
  password: z.string().min(1, 'Mot de passe requis'),
  redirectUrl: z.string().startsWith('/').default('/app/overview'),
});

export const signupSchema = z.object({
  name: trimmedString.min(2, 'Nom trop court').max(100, 'Nom trop long'),
  email: trimmedString.email('Email invalide').toLowerCase(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  role: z.enum(['assistante', 'parent']),
});

// -- Children --

export const createChildSchema = z.object({
  firstName: trimmedString.min(1, 'Prénom requis').max(100),
  lastName: trimmedString.min(1, 'Nom requis').max(100),
  birthDate: dateString,
});

// -- News --

export const createNewsSchema = z.object({
  childId: uuid,
  content: trimmedString.min(1, 'Contenu requis').max(500, 'Le message ne peut pas dépasser 500 caractères'),
  emoji: z.string().max(10).optional(),
});

export const updateNewsSchema = z.object({
  content: trimmedString.min(1).max(500).optional(),
  emoji: z.string().max(10).nullable().optional(),
});

// -- Parent Notes --

export const createNoteSchema = z.object({
  childId: uuid,
  kind: z.enum(['absence', 'retard', 'sante', 'logistique', 'autre']),
  content: trimmedString.min(1, 'Contenu requis').max(800),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
});

export const respondToNoteSchema = z.object({
  noteId: uuid,
  response: trimmedString.min(1).max(500),
});

// -- Email Verification --

export const verifyEmailSchema = z.object({
  email: trimmedString.email('Email invalide').toLowerCase(),
  code: z.string().trim().regex(/^\d{6}$/, 'Le code doit contenir 6 chiffres'),
});

export const resendCodeSchema = z.object({
  email: trimmedString.email('Email invalide').toLowerCase(),
});

// -- Invite --

export const inviteCodeSchema = z.object({
  code: z.string().trim().toUpperCase().length(8, 'Le code doit contenir 8 caractères'),
});

// -- Helpers --

/** Extract and validate FormData against a Zod schema. Discriminated union narrows via `ok`. */
export function parseFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    raw[key] = value;
  }
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? 'Données invalides' };
}
