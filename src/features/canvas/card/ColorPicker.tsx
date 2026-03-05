import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  CANVAS_COLOR_PRESETS,
  type CanvasNodeColor,
} from "../../../constants/colors";
import { cn } from "../../../lib/utils";
import { useCanvasStore } from "../../../stores/canvasStore";

type ColorPickerProps = {
  nodeId: string;
  color: CanvasNodeColor;
  className?: string;
  onSelectColor?: (nextColor: CanvasNodeColor) => void;
};

export function ColorPicker({
  nodeId,
  color,
  className,
  onSelectColor,
}: ColorPickerProps) {
  const { t } = useTranslation();
  const updateNodeColor = useCanvasStore((state) => state.updateNodeColor);

  const handleSelectColor = useCallback(
    (nextColor: CanvasNodeColor) => {
      updateNodeColor(nodeId, nextColor);
      onSelectColor?.(nextColor);
    },
    [nodeId, onSelectColor, updateNodeColor],
  );

  return (
    <div
      className={cn("card-color-picker", className)}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="card-color-picker__title">{t("colorPicker.title")}</div>
      <div className="card-color-picker__grid">
        <button
          type="button"
          className={cn("card-color-picker__option", {
            "card-color-picker__option--active": color === null,
          })}
          aria-label={t("colorPicker.noneLabel")}
          title={t("colorPicker.none")}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => handleSelectColor(null)}
        >
          <span className="card-color-picker__swatch card-color-picker__swatch--none" />
        </button>

        {CANVAS_COLOR_PRESETS.map((preset) => {
          const isActive = color === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              className={cn("card-color-picker__option", {
                "card-color-picker__option--active": isActive,
              })}
              aria-label={t("colorPicker.colorLabel", { color: preset.label })}
              title={preset.label}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => handleSelectColor(preset.id)}
            >
              <span
                className="card-color-picker__swatch"
                style={{
                  backgroundColor: preset.background,
                  borderColor: preset.border,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
