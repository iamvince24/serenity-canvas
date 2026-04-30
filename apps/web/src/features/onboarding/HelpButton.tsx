import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTour } from "./useTour";

interface HelpButtonProps {
  className?: string;
}

export function HelpButton({ className }: HelpButtonProps) {
  const { t } = useTranslation();
  const { startTour } = useTour();

  return (
    <button
      type="button"
      data-tour="toolbar-help"
      className={className}
      aria-label={t("tour.button.help")}
      onClick={startTour}
    >
      <CircleHelp size={16} />
    </button>
  );
}
