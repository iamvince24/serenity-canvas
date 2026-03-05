import { describe, expect, it } from "vitest";
import zhTW from "../locales/zh-TW.json";
import en from "../locales/en.json";

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return flatKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

describe("Translation key consistency", () => {
  const zhKeys = flatKeys(zhTW).sort();
  const enKeys = flatKeys(en).sort();

  it("zh-TW and en have identical key sets", () => {
    const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
    const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));

    expect(missingInEn, "Keys in zh-TW but missing in en").toEqual([]);
    expect(missingInZh, "Keys in en but missing in zh-TW").toEqual([]);
  });

  it("no empty values in zh-TW", () => {
    const emptyKeys = zhKeys.filter((key) => {
      const value = (zhTW as Record<string, string>)[key];
      return typeof value === "string" && value.trim().length === 0;
    });
    expect(emptyKeys, "Empty values in zh-TW").toEqual([]);
  });

  it("no empty values in en", () => {
    const emptyKeys = enKeys.filter((key) => {
      const value = (en as Record<string, string>)[key];
      return typeof value === "string" && value.trim().length === 0;
    });
    expect(emptyKeys, "Empty values in en").toEqual([]);
  });
});
