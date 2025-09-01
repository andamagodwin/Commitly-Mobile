import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { account } from '~/lib/appwrite';

// Minimal shapes for Appwrite session & user. Keep generic to avoid tight coupling.
export type AuthTokens = {
  sessionId: string;
};

export type AuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  tokens?: AuthTokens | null;
  user?: AuthUser | null;
  hydrate: () => Promise<void>;
  setAuth: (tokens: AuthTokens | null, user?: AuthUser | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const STORAGE_KEY = 'auth.appwrite';

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoading: true,
  isAuthenticated: false,
  tokens: null,
  user: null,
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { tokens: AuthTokens; user?: AuthUser | null };
        set({
          tokens: parsed.tokens,
          user: parsed.user ?? null,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
  setAuth: async (tokens, user) => {
    set({ tokens: tokens ?? null, user: user ?? null, isAuthenticated: !!tokens });
    if (tokens) {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ tokens, user: user ?? null }));
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    }
  },
  signOut: async () => {
    try {
      await account.deleteSession({ sessionId: 'current' });
    } catch {}
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    set({ tokens: null, user: null, isAuthenticated: false });
  },
}));
