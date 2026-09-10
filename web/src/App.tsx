import Noise from "@/bits/Noise";
import { DeskSheets } from "@/components/DeskSheets";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { PrivacyStrip } from "@/components/PrivacyStrip";
import { SkipLink } from "@/components/SkipLink";
import { VaultFolder } from "@/components/VaultFolder";

export function App() {
  return (
    <div className="relative min-h-dvh bg-blotter text-ink">
      <SkipLink />
      <Noise patternAlpha={10} patternRefreshInterval={10} />
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <VaultFolder />
        <DeskSheets />
        <PrivacyStrip />
      </main>
      <Footer />
    </div>
  );
}
