export type UserRole = 'assistante' | 'parent';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  avatarPath?: string;
  defaultNapStart?: string;
  defaultNapEnd?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}
