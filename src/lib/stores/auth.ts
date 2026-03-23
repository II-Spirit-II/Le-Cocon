import { writable, derived } from 'svelte/store';
import type { User } from '$lib/types';

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthStore>({
    user: null,
    isLoading: true,
    isAuthenticated: false
  });

  return {
    subscribe,

    // Called by +layout.svelte with data from +layout.server.ts
    initFromServer: (serverUser: User | null) => {
      set({
        user: serverUser,
        isLoading: false,
        isAuthenticated: !!serverUser
      });
    },

    updateUser: (userData: Partial<User>) => {
      update((state) => {
        if (!state.user) return state;
        return { ...state, user: { ...state.user, ...userData } };
      });
    },

    logout: () => {
      set({ user: null, isLoading: false, isAuthenticated: false });
    }
  };
}

export const auth = createAuthStore();

export const currentUser = derived(auth, ($auth) => $auth.user);
export const isAssistante = derived(auth, ($auth) => $auth.user?.role === 'assistante');
export const isParent = derived(auth, ($auth) => $auth.user?.role === 'parent');
export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const isLoading = derived(auth, ($auth) => $auth.isLoading);
