import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STORAGE_KEY = "serenity-canvas:mobile-warning-dismissed";

function isDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistDismiss(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function MobileWarningDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 768px)").matches &&
      !isDismissed(),
  );
  const checkboxRef = useRef(false);

  const handleConfirm = () => {
    if (checkboxRef.current) {
      persistDismiss();
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("canvas.mobileWarning.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("canvas.mobileWarning.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            onChange={(e) => {
              checkboxRef.current = e.target.checked;
            }}
          />
          {t("canvas.mobileWarning.dontShowAgain")}
        </label>

        <AlertDialogFooter>
          <AlertDialogAction onClick={handleConfirm}>
            {t("canvas.mobileWarning.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
