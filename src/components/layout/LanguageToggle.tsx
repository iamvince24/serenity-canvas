import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** 語言切換按鈕，hover 時顯示目標語言名稱 */
export function LanguageToggle() {
  const { i18n } = useTranslation();

  const isZhTW = i18n.language.startsWith("zh");
  const label = isZhTW ? "EN" : "繁中";
  const tooltipLabel = isZhTW ? "Switch to English" : "切換至繁體中文";

  const toggle = () => {
    void i18n.changeLanguage(isZhTW ? "en" : "zh-TW");
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="btn-secondary flex h-9 w-9 items-center justify-center px-0 text-xs font-medium"
          onClick={toggle}
          aria-label={tooltipLabel}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  );
}
