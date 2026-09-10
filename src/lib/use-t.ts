import { t, type Locale, type MessageKey } from "@/lib/i18n";
import { useApp } from "@/store";
import { useCallback } from "react";

export function useLocale(): Locale {
  return useApp((s) => s.locale);
}

export function useT() {
  const locale = useLocale();
  return useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => t(locale, key, vars),
    [locale],
  );
}
