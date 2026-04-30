import { useTranslation } from "react-i18next";
import { Lock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type ShareMode = "private" | "public";

type ShareModeSegmentedProps = {
  value: ShareMode;
  onChange: (mode: ShareMode) => void;
  disabled?: boolean;
};

const OPTIONS: { mode: ShareMode; icon: typeof Lock; labelKey: string }[] = [
  { mode: "private", icon: Lock, labelKey: "share.mode.private" },
  { mode: "public", icon: Globe, labelKey: "share.mode.public" },
];

export function ShareModeSegmented({
  value,
  onChange,
  disabled = false,
}: ShareModeSegmentedProps) {
  const { t } = useTranslation();

  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        {t("share.mode.label")}
      </legend>
      <div className="flex rounded-lg border border-border p-1">
        {OPTIONS.map(({ mode, icon: Icon, labelKey }) => (
          <label
            key={mode}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              value === mode
                ? "bg-elevated text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              type="radio"
              name="share-mode"
              value={mode}
              checked={value === mode}
              onChange={() => onChange(mode)}
              className="sr-only"
            />
            <Icon size={14} />
            <span>{t(labelKey)}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === "private"
          ? t("share.mode.privateDescription")
          : t("share.mode.publicDescription")}
      </p>
    </fieldset>
  );
}
