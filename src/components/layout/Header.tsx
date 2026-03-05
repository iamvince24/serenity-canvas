import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AuthModal } from "@/components/auth/AuthModal";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { SyncIndicator } from "@/components/layout/SyncIndicator";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/useSignOut";
import { getAvatarUrl, getDisplayName } from "@/lib/userMetadata";
import { useAuthStore } from "@/stores/authStore";

export function Header() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { isSigningOut, handleSignOut } = useSignOut();

  const displayName = user ? getDisplayName(user) : null;
  const avatarUrl = user ? getAvatarUrl(user) : null;
  const avatarInitial = displayName ? displayName[0]?.toUpperCase() : "S";

  return (
    <header className="nav-calm fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="text-[1.125rem] font-medium tracking-[-0.015em] text-foreground transition-colors duration-300 ease-in-out hover:text-sage-dark"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Serenity Canvas
        </Link>

        {user ? (
          <div className="flex items-center gap-2">
            <SyncIndicator />
            <Link
              to="/dashboard"
              className="hidden text-sm text-foreground-muted transition-colors hover:text-sage-dark sm:inline"
            >
              {t("header.nav.dashboard")}
            </Link>

            <div className="flex items-center gap-2 rounded-full border border-border bg-elevated px-2 py-1">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={t("header.avatar.alt", {
                    name: displayName ?? t("header.avatar.fallbackName"),
                  })}
                  className="h-6 w-6 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage-light text-xs font-semibold text-sage-dark">
                  {avatarInitial}
                </span>
              )}
              <span className="max-w-28 truncate text-sm text-foreground-muted">
                {displayName}
              </span>
            </div>

            <LanguageToggle />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut
                ? t("header.button.signingOut")
                : t("header.button.signOut")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Button
              type="button"
              size="sm"
              onClick={() => setIsAuthOpen(true)}
              className="h-8"
            >
              {t("header.button.signIn")}
            </Button>
          </div>
        )}
      </div>

      <AuthModal open={isAuthOpen} onOpenChange={setIsAuthOpen} />
    </header>
  );
}
