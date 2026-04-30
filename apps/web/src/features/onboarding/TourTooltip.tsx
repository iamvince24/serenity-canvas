import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TourStep } from "./tourSteps";

interface TourTooltipProps {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function TourTooltip({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  style,
  className,
}: TourTooltipProps) {
  const { t } = useTranslation();
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;
  const shortcutKey = `tour.step.${step.i18nKey}.shortcut`;
  const shortcut = t(shortcutKey) !== shortcutKey ? t(shortcutKey) : undefined;

  return (
    <div
      className={cn(
        "z-[3200] w-80 max-w-[calc(100vw-32px)] rounded-xl border border-border bg-elevated p-5 shadow-xl",
        className,
      )}
      style={style}
      role="dialog"
      aria-label={t(`tour.step.${step.i18nKey}.title`)}
    >
      {/* Header: title + step indicator */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">
          {t(`tour.step.${step.i18nKey}.title`)}
        </h3>
        <span className="shrink-0 text-xs text-foreground-muted pt-1">
          {currentIndex + 1} / {totalSteps}
        </span>
      </div>

      {/* Description */}
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        {t(`tour.step.${step.i18nKey}.description`)}
      </p>

      {/* Shortcut badge */}
      {shortcut && (
        <span className="mt-2 inline-block rounded-md bg-surface px-2 py-0.5 text-xs font-mono text-foreground-muted">
          {shortcut}
        </span>
      )}

      {/* Footer: dismiss + navigation */}
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
          onClick={onSkip}
        >
          {t("tour.button.skip")}
        </button>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="ghost" size="sm" onClick={onPrev}>
              {t("tour.button.prev")}
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            {isLast ? t("tour.button.complete") : t("tour.button.next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
