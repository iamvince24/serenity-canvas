import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type SignUpResult = {
  requiresEmailConfirmation: boolean;
};

type AuthStore = {
  user: User | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

let isInitialized = false;
let initializePromise: Promise<void> | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;

function getDashboardRedirectUrl(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}/dashboard`;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  initialize: async () => {
    if (isInitialized) {
      return;
    }

    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      set({ loading: true });

      if (!authSubscription) {
        const { data } = supabase.auth.onAuthStateChange((_, session) => {
          set({
            user: session?.user ?? null,
            loading: false,
          });
        });
        authSubscription = data.subscription;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Failed to load initial auth session", error);
        set({ user: null, loading: false });
        return;
      }

      set({
        user: data.session?.user ?? null,
        loading: false,
      });
    })().finally(() => {
      isInitialized = true;
      initializePromise = null;
    });

    return initializePromise;
  },
  signInWithGoogle: async () => {
    const redirectTo = getDashboardRedirectUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (error) {
      throw new Error(error.message);
    }
  },
  signInWithEmail: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }
  },
  signUp: async (email, password) => {
    const redirectTo = getDashboardRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      requiresEmailConfirmation: !data.session,
    };
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  },
}));
