import "fake-indexeddb/auto";
import type { ReactNode } from "react";
import { beforeEach, vi } from "vitest";
import { resetIdCounter } from "./factories";

beforeEach(() => {
  resetIdCounter();
});

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// jsdom 25 (enforced by monorepo pnpm.overrides) lacks Blob.arrayBuffer / Blob.text.
if (
  typeof Blob !== "undefined" &&
  typeof Blob.prototype.arrayBuffer === "undefined"
) {
  Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof Blob !== "undefined" && typeof Blob.prototype.text === "undefined") {
  Blob.prototype.text = function (): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

// jsdom 25 (enforced by monorepo pnpm.overrides) lacks PointerEvent.
// Polyfill so tests that use new PointerEvent() or fireEvent.pointerDown work correctly.
if (typeof globalThis.PointerEvent === "undefined") {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? false;
    }
  }

  (globalThis as Record<string, unknown>).PointerEvent = PointerEvent;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-TW", changeLanguage: vi.fn() },
  }),
  Trans: ({
    i18nKey,
    children,
  }: {
    i18nKey?: string;
    children?: ReactNode;
  }): ReactNode => i18nKey ?? children,
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/i18n", () => ({
  default: {
    t: (key: string) => key,
    language: "zh-TW",
    changeLanguage: vi.fn(),
  },
}));
