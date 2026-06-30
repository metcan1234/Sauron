import type { Metadata } from "next";
import Section from "@/components/Section";

export const metadata: Metadata = {
  title: "{{PAGE_ABOUT_SEO_TITLE}}",
  description: "{{PAGE_ABOUT_SEO_DESCRIPTION}}",
};

export default function AboutPage() {
  return (
    <Section
      eyebrow="Hakkımızda"
      title="Güven inşa eden mükemmellik"
      description="{{COMPANY_NAME}} — {{ABOUT_MISSION}}"
    >
      <div className="grid gap-8 md:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-foreground">Misyonumuz</h2>
          <p className="mt-3 text-muted leading-relaxed">
            {{ABOUT_MISSION}}
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-foreground">Değerlerimiz</h2>
          <ul className="mt-3 space-y-2 text-muted">
            <li>Her öneride şeffaflık</li>
            <li>Kaliteden ödün vermeme</li>
            <li>Proje sonrası da ortaklık</li>
          </ul>
        </article>
      </div>
    </Section>
  );
}
