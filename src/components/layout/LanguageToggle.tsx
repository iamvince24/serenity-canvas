import { useTranslation } from "react-i18next";

export function LanguageToggle() {
  const { i18n } = useTranslation();

  const isZhTW = i18n.language.startsWith("zh");
  const label = isZhTW ? "EN" : "繁中";

  const toggle = () => {
    void i18n.changeLanguage(isZhTW ? "en" : "zh-TW");
  };

  return (
    <button
      type="button"
      className="flex h-8 items-center rounded-md border border-border bg-elevated px-2.5 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface hover:text-sage-dark"
      onClick={toggle}
      aria-label={isZhTW ? "Switch to English" : "切換至繁體中文"}
    >
      {label}
    </button>
  );
}
