import { useState } from "react";
import { useAuthStore } from "@/stores/authStore";

type UseSignOutResult = {
  isSigningOut: boolean;
  handleSignOut: () => void;
};

export function useSignOut(): UseSignOutResult {
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = () => {
    setIsSigningOut(true);
    signOut()
      .catch((error: unknown) => {
        console.error("Failed to sign out", error);
      })
      .finally(() => {
        setIsSigningOut(false);
      });
  };

  return { isSigningOut, handleSignOut };
}
