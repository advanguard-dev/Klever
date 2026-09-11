import { Segmented } from "@/components/ui";
import { PRESENT_MODE_ICONS } from "@/lib/chrome-icons";
import { useT } from "@/lib/use-t";
import { useApp } from "@/store";

type Surface = "edit" | "present";

/** Compact Block / Present control for the app title bar. */
export function EditorModeSwitch() {
  const t = useT();
  const presenting = useApp((s) => s.presenting);
  const setPresenting = useApp((s) => s.setPresenting);

  return (
    <Segmented
      aria-label={t("shell.editorMode")}
      size="sm"
      variant="ghost"
      value={presenting ? "present" : "edit"}
      onChange={(v: Surface) => setPresenting(v === "present")}
      options={[
        {
          value: "edit" as const,
          label: t("shell.modeBlock"),
          icon: PRESENT_MODE_ICONS.edit,
        },
        {
          value: "present" as const,
          label: t("shell.modePresent"),
          icon: PRESENT_MODE_ICONS.present,
        },
      ]}
    />
  );
}
