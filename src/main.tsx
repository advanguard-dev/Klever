import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/500.css";
import { App } from "@/App";
import { applyElectronPlatformClass } from "@/lib/electron";
import { applyDocumentLang, detectBrowserLocale } from "@/lib/i18n";
import "@/index.css";

applyElectronPlatformClass();
applyDocumentLang(detectBrowserLocale());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
