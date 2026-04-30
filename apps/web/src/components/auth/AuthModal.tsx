import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/authStore";
import i18n from "@/i18n";

type AuthMode = "signIn" | "signUp";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(email: string, password: string): string | null {
  const trimmedEmail = email.trim();
  if (!emailPattern.test(trimmedEmail)) {
    return i18n.t("auth.validation.invalidEmail");
  }

  if (password.length < 6) {
    return i18n.t("auth.validation.passwordTooShort");
  }

  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return i18n.t("auth.error.unknown");
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const signUp = useAuthStore((state) => state.signUp);

  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      return;
    }

    setEmail("");
    setPassword("");
    setErrorMessage(null);
    setNoticeMessage(null);
    setMode("signIn");
    setIsSubmitting(false);
  }, [open]);

  const title =
    mode === "signIn" ? t("auth.title.signIn") : t("auth.title.signUp");
  const submitLabel =
    mode === "signIn" ? t("auth.button.emailSignIn") : t("auth.button.signUp");

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    const validationError = validateForm(email, password);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "signIn") {
        await signInWithEmail(email.trim(), password);
        onOpenChange(false);
        navigate("/dashboard", { replace: true });
        return;
      }

      const result = await signUp(email.trim(), password);
      if (result.requiresEmailConfirmation) {
        setNoticeMessage(i18n.t("auth.notice.emailConfirmation"));
        setMode("signIn");
        setPassword("");
        return;
      }

      onOpenChange(false);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModeToggle = () => {
    setMode((currentMode) => (currentMode === "signIn" ? "signUp" : "signIn"));
    setErrorMessage(null);
    setNoticeMessage(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmitting) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="border-border bg-elevated sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("auth.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
          >
            {t("auth.button.google")}
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-divider" />
            <span className="text-xs text-foreground-subtle">
              {t("auth.divider")}
            </span>
            <div className="h-px flex-1 bg-divider" />
          </div>

          <form className="space-y-3" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1">
              <label htmlFor="auth-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="auth-password" className="text-sm font-medium">
                {t("auth.label.password")}
              </label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={
                  mode === "signIn" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("auth.placeholder.password")}
                disabled={isSubmitting}
              />
            </div>

            {errorMessage ? (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            {noticeMessage ? (
              <p role="status" className="text-sm text-success">
                {noticeMessage}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("auth.button.submitting") : submitLabel}
            </Button>
          </form>

          <div className="text-center text-sm text-foreground-muted">
            {mode === "signIn"
              ? t("auth.toggle.noAccount")
              : t("auth.toggle.hasAccount")}
            <button
              type="button"
              className="ml-1 text-sage-dark transition-colors hover:text-sage"
              onClick={handleModeToggle}
              disabled={isSubmitting}
            >
              {mode === "signIn"
                ? t("auth.toggle.signUp")
                : t("auth.toggle.signIn")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
