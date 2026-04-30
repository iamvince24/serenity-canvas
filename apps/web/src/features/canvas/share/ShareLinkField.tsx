import { useState, useRef, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "react-i18next";

type ShareLinkFieldProps = {
  shareUrl: string | null;
  isGenerating?: boolean;
};

export function ShareLinkField({
  shareUrl,
  isGenerating = false,
}: ShareLinkFieldProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      inputRef.current?.select();
    }
  }, [shareUrl]);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor="share-link-input"
        className="text-sm font-medium text-foreground"
      >
        {t("share.linkField.label")}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id="share-link-input"
          type="text"
          readOnly
          value={isGenerating ? "" : (shareUrl ?? "")}
          placeholder={isGenerating ? t("share.linkField.generatingLink") : ""}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground"
        />
        <button
          type="button"
          className="btn-secondary h-9 w-9 shrink-0 justify-center px-0"
          onClick={() => void handleCopy()}
          disabled={!shareUrl || isGenerating}
          aria-label={
            copied ? t("share.linkField.copied") : t("share.linkField.copy")
          }
          aria-live="polite"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}
