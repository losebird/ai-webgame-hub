import { en } from "./en.js";
import { zh } from "./zh.js";

export type Locale = "en" | "zh";
export type Dict = typeof en;
export type MessageKey = keyof Dict;

export const LOCALES: Locale[] = ["en", "zh"];
export const dictionaries: Record<Locale, Dict> = { en, zh };

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "zh";
}

export function dict(locale: Locale): Dict {
  return dictionaries[locale];
}

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = dictionaries[locale][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function localeTag(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}

export function pickLocale(acceptLanguage: string | null, cookieLang: string | null): Locale {
  if (isLocale(cookieLang)) return cookieLang;
  const header = (acceptLanguage ?? "").toLowerCase();
  const zhAt = header.search(/(^|,|;|\s)zh(-|$|,|;)/);
  const enAt = header.search(/(^|,|;|\s)en(-|$|,|;)/);
  if (zhAt >= 0 && (enAt < 0 || zhAt < enAt)) return "zh";
  return "en";
}

export function splitLocalePath(pathname: string): { locale: Locale | null; rest: string } {
  const match = /^\/(en|zh)(?=\/|$)/.exec(pathname);
  if (!match) return { locale: null, rest: pathname || "/" };
  const rest = pathname.slice(match[0].length) || "/";
  return { locale: match[1] as Locale, rest };
}

export function withLocale(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (clean === "/") return `/${locale}/`;
  return `/${locale}${clean}`;
}

export function swapLocalePath(pathname: string, search: string, next: Locale): string {
  const { rest } = splitLocalePath(pathname);
  return `${withLocale(next, rest)}${search}`;
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

export function formatDate(locale: Locale, ms: number): string {
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium" }).format(new Date(ms));
}
