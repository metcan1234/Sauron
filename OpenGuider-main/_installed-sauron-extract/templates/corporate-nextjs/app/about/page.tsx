import type { Metadata } from "next";
import Section from "@/components/Section";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about {{COMPANY_NAME}} — {{TAGLINE}}",
};

export default function AboutPage() {
  return (
    <Section
      eyebrow="About us"
      title="Building trust through excellence"
      description="{{COMPANY_NAME}} partners with organizations to deliver measurable outcomes with clarity, integrity, and long-term vision."
    >
      <div className="grid gap-8 md:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-foreground">Our mission</h2>
          <p className="mt-3 text-muted leading-relaxed">
            We help businesses navigate complexity with strategic guidance and
            dependable execution. Every engagement is tailored to your goals.
          </p>
        </article>
        <article className="rounded-xl border border-white/10 bg-surface-elevated p-6">
          <h2 className="text-lg font-semibold text-foreground">Our values</h2>
          <ul className="mt-3 space-y-2 text-muted">
            <li>Transparency in every recommendation</li>
            <li>Quality without compromise</li>
            <li>Partnership beyond the project timeline</li>
          </ul>
        </article>
      </div>
    </Section>
  );
}
