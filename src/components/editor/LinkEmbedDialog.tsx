import { Overlay, Field, Segmented, SolidButton, TextButton } from "@/components/ui";
import { coerceHttpUrl, isHttpUrl } from "@/lib/url-embed";
import { useT } from "@/lib/use-t";
import { useState } from "react";

export type LinkEmbedMode = "link" | "embed";

export function LinkEmbedDialog({
  initialHref,
  initialText,
  initialMode,
  onClose,
  onApply,
}: {
  initialHref: string;
  initialText: string;
  initialMode: LinkEmbedMode;
  onClose: () => void;
  onApply: (next: { href: string; text: string; mode: LinkEmbedMode }) => void;
}) {
  const t = useT();
  const [href, setHref] = useState(initialHref);
  const [text, setText] = useState(initialText);
  const [mode, setMode] = useState<LinkEmbedMode>(initialMode);
  const parsed = coerceHttpUrl(href);
  const invalid = href.trim().length > 0 && !parsed;

  const submit = () => {
    const url = parsed;
    if (!url) return;
    onApply({ href: url, text: text.trim(), mode });
    onClose();
  };

  return (
    <Overlay onClose={onClose} title={t("insert.linkEmbed")}>
      <div className="flex flex-col gap-4 p-4">
        <Segmented<LinkEmbedMode>
          aria-label={t("insert.linkEmbed")}
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "link", label: t("insert.asLink") },
            { value: "embed", label: t("insert.asEmbed") },
          ]}
        />
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-faint">{t("insert.url")}</span>
          <Field
            value={href}
            placeholder="https://"
            autoFocus
            aria-invalid={invalid || undefined}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-faint">{t("insert.linkText")}</span>
          <Field
            value={text}
            placeholder={parsed && isHttpUrl(parsed) ? parsed : t("insert.linkText")}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <div className="flex justify-end gap-2">
          <TextButton onClick={onClose}>{t("common.cancel")}</TextButton>
          <SolidButton disabled={!parsed} onClick={submit}>
            {t("common.done")}
          </SolidButton>
        </div>
      </div>
    </Overlay>
  );
}
