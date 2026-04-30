import { PenLine, Ungroup } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  CANVAS_COLOR_PRESETS,
  type CanvasNodeColor,
} from "../../../constants/colors";
import { cn } from "../../../lib/utils";
import { useCanvasStore } from "../../../stores/canvasStore";
import { useContextMenuBase } from "./useContextMenuBase";

type GroupContextMenuProps = {
  groupId: string;
  clientX: number;
  clientY: number;
  onClose: () => void;
};

export function GroupContextMenu({
  groupId,
  clientX,
  clientY,
  onClose,
}: GroupContextMenuProps) {
  const { t } = useTranslation();
  const groups = useCanvasStore((state) => state.groups);
  const selectedGroupIds = useCanvasStore((state) => state.selectedGroupIds);
  const updateGroup = useCanvasStore((state) => state.updateGroup);
  const deleteGroup = useCanvasStore((state) => state.deleteGroup);

  const activeSelectedGroupIds = useMemo(() => {
    const sanitizedGroupIds = selectedGroupIds.filter((selectedGroupId) =>
      Boolean(groups[selectedGroupId]),
    );
    if (sanitizedGroupIds.length > 0) {
      return sanitizedGroupIds;
    }

    if (groups[groupId]) {
      return [groupId];
    }

    return [];
  }, [groupId, groups, selectedGroupIds]);

  const primaryGroup =
    activeSelectedGroupIds.length > 0
      ? (groups[activeSelectedGroupIds[0]] ?? null)
      : null;

  const { menuRef, menuStyle, handleMenuKeyDown } = useContextMenuBase({
    clientX,
    clientY,
    onClose,
    shouldClose: !groups[groupId],
  });

  const handleRenameGroup = useCallback(() => {
    if (!primaryGroup) {
      return;
    }

    const nextLabel = window.prompt(
      t("groupContext.renamePrompt"),
      primaryGroup.label,
    );
    if (nextLabel === null) {
      return;
    }

    const trimmedLabel = nextLabel.trim();
    if (trimmedLabel.length === 0) {
      return;
    }

    updateGroup(primaryGroup.id, { label: trimmedLabel });
    onClose();
  }, [onClose, primaryGroup, t, updateGroup]);

  const handleUngroup = useCallback(() => {
    if (activeSelectedGroupIds.length === 0) {
      return;
    }

    for (const selectedGroupId of activeSelectedGroupIds) {
      deleteGroup(selectedGroupId);
    }
    onClose();
  }, [activeSelectedGroupIds, deleteGroup, onClose]);

  const handleSelectGroupColor = useCallback(
    (color: CanvasNodeColor) => {
      if (!primaryGroup) {
        return;
      }

      updateGroup(primaryGroup.id, { color });
      onClose();
    },
    [onClose, primaryGroup, updateGroup],
  );

  if (!primaryGroup || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="card-widget__settings-dropdown"
      style={menuStyle}
      data-node-context-menu="true"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={handleMenuKeyDown}
    >
      <button
        type="button"
        className="card-widget__settings-item"
        onClick={handleRenameGroup}
      >
        <PenLine size={14} />
        {t("groupContext.rename")}
      </button>
      <button
        type="button"
        className="card-widget__settings-item"
        onClick={handleUngroup}
      >
        <Ungroup size={14} />
        {t("groupContext.ungroup")}
      </button>
      <div className="card-widget__settings-divider" />
      <div
        className="card-color-picker px-1 pb-1 pt-0"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="card-color-picker__title">
          {t("groupContext.color")}
        </div>
        <div className="card-color-picker__grid">
          <button
            type="button"
            className={cn("card-color-picker__option", {
              "card-color-picker__option--active": primaryGroup.color === null,
            })}
            aria-label={t("groupContext.colorNoneLabel")}
            title={t("groupContext.colorNone")}
            onClick={() => handleSelectGroupColor(null)}
          >
            <span className="card-color-picker__swatch card-color-picker__swatch--none" />
          </button>
          {CANVAS_COLOR_PRESETS.map((preset) => {
            const isActive = primaryGroup.color === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={cn("card-color-picker__option", {
                  "card-color-picker__option--active": isActive,
                })}
                aria-label={t("groupContext.colorLabel", {
                  color: preset.label,
                })}
                title={preset.label}
                onClick={() => handleSelectGroupColor(preset.id)}
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
    </div>,
    document.body,
  );
}
