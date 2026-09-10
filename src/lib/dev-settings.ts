import type { DevSettings } from "@/types";
import { nid } from "@/lib/ids";

export function defaultDevSettings(): DevSettings {
  return {
    localApiEnabled: false,
    localApiPort: 7431,
    localApiToken: nid(24),
    webhookUrls: [],
    semanticSearch: true,
  };
}

export function normalizeDevSettings(raw: Partial<DevSettings> | undefined): DevSettings {
  const d = defaultDevSettings();
  if (!raw) return d;
  return {
    localApiEnabled: Boolean(raw.localApiEnabled),
    localApiPort: Number(raw.localApiPort) > 0 ? Number(raw.localApiPort) : d.localApiPort,
    localApiToken: typeof raw.localApiToken === "string" && raw.localApiToken ? raw.localApiToken : d.localApiToken,
    webhookUrls: Array.isArray(raw.webhookUrls) ? raw.webhookUrls.map(String) : [],
    semanticSearch: raw.semanticSearch !== false,
  };
}
