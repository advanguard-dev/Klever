import type { Locale } from "@/lib/i18n";
import type {
  DbView,
  DbViewType,
  FreeformConnection,
  FreeformObject,
  SchemaProp,
} from "@/types";

export type StarterKind = "page" | "board" | "database";
export type StarterPurpose = "write" | "plan" | "track" | "meet" | "learn" | "create";
export type StarterTheme = "work" | "personal" | "studio" | "research" | "home";

export const STARTER_KINDS: StarterKind[] = ["page", "board", "database"];
export const STARTER_PURPOSES: StarterPurpose[] = ["write", "plan", "track", "meet", "learn", "create"];
export const STARTER_THEMES: StarterTheme[] = ["work", "personal", "studio", "research", "home"];

export interface StarterCopy {
  title: string;
  blurb: string;
}

export interface DbRowSeed {
  title: string;
  body?: string;
  icon?: string;
  props?: Record<string, unknown>;
}

export type StarterSeed =
  | { type: "page"; body: (locale: Locale) => string; tags?: string[] }
  | {
      type: "database";
      schema: (locale: Locale) => SchemaProp[];
      views?: DbView[];
      viewType?: DbViewType;
      rows?: (locale: Locale) => DbRowSeed[];
      body?: (locale: Locale) => string;
    }
  | {
      type: "board";
      build: (locale: Locale) => { objects: FreeformObject[]; connections?: FreeformConnection[] };
    }
  | {
      type: "pack";
      databaseTitle: (locale: Locale) => string;
      databaseIcon?: string;
      schema: (locale: Locale) => SchemaProp[];
      views?: DbView[];
      viewType?: DbViewType;
      rows?: (locale: Locale) => DbRowSeed[];
      pageBody: (locale: Locale, dbTitle: string) => string;
      tags?: string[];
    };

export interface Starter {
  id: string;
  kind: StarterKind;
  purpose: StarterPurpose;
  theme: StarterTheme;
  icon: string;
  blank?: boolean;
  copy: Record<Locale, StarterCopy>;
  seed: StarterSeed;
}
