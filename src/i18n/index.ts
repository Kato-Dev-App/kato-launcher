import es from "./locales/es.json";
import en from "./locales/en.json";

export type Language = "es" | "en";

export const LOCALES: Record<Language, typeof es> = {
  es,
  en,
};

export const AVAILABLE_LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: "es", label: "Español", short: "ES" },
  { code: "en", label: "English", short: "EN" },
];

/**
 * Obtiene el texto traducido según la clave indicada y sustituye parámetros {key}.
 */
export function getTranslation(
  lang: Language,
  path: string,
  params?: Record<string, string | number>
): string {
  const currentLocale = LOCALES[lang] || LOCALES.es;
  const parts = path.split(".");

  let current: unknown = currentLocale;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      current = undefined;
      break;
    }
  }

  if (typeof current !== "string") {
    return path;
  }

  let text = current;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }

  return text;
}
