import { Segmented } from "@/components/ui";
import { MODE_ICONS } from "@/lib/chrome-icons";
import { useT } from "@/lib/use-t";
import type { MessageKey } from "@/lib/i18n";
import { useApp } from "@/store";
import { EDITOR_MODES, type EditorMode } from "@/types";

const MODE_I18N: Record<EditorMode, MessageKey> = {
  wysiwyg: "shell.modeBlock",
  markdown: "shell.modeSource",
  read: "shell.modeRead",
};

/** Compact Block / Source / Read control for the app title bar. */
export function EditorModeSwitch() {
  const t = useT();
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);

  return (
    <Segmented
      aria-label={t("shell.editorMode")}
      size="sm"
      variant="ghost"
      value={mode}
      onChange={setMode}
      options={EDITOR_MODES.map((m) => ({
        value: m,
        label: t(MODE_I18N[m]),
        icon: MODE_ICONS[m],
      }))}
    />
  );
}
