import type { Metadata } from "next";
import Section from "@/components/Section";
import { siteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "{{PAGE_ABOUT_SEO_TITLE}}",
  description: "{{PAGE_ABOUT_SEO_DESCRIPTION}}",
};

export default function AboutPage() {
  return (
    <Section
      eyebrow="Hakkımızda"
      title="Güven ve mükemmellikle büyüyoruz"
      description={`${siteData.companyName} olarak ölçülebilir sonuçlar için şeffaflık ve uzun vadeli ortaklık sunuyoruz.`}
    >
      <div className="grid gap-8 md:grid-cols-2">
        <article className="card-elevated">
          <h2 className="text-lg font-semibold text-foreground">Misyonumuz</h2>
          <p className="mt-3 leading-relaxed text-muted">{siteData.aboutMission}</p>
        </article>
        <article className="card-elevated">
          <h2 className="text-lg font-semibold text-foreground">Değerlerimiz</h2>
          <ul className="mt-3 space-y-2 text-muted">
            {siteData.aboutValues.map((value) => (
              <li key={value}>{value}</li>
            ))}
          </ul>
        </article>
      </div>
    </Section>
  );
}
