import "fake-indexeddb/auto";
import type { ReactNode } from "react";
import { vi } from "vitest";

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
