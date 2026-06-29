import type { Metadata } from "next";
import Section from "@/components/Section";
import ContactForm from "@/components/ContactForm";
import { siteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "{{PAGE_CONTACT_SEO_TITLE}}",
  description: "{{PAGE_CONTACT_SEO_DESCRIPTION}}",
};

export default function ContactPage() {
  return (
    <Section
      eyebrow="İletişim"
      title="Hadi konuşalım"
      description="Projenizi anlatın; ekibimiz bir iş günü içinde dönüş yapacaktır."
    >
      <ContactForm />
      {siteData.contactEmail && (
        <p className="mt-6 text-sm text-muted">
          E-posta:{" "}
          <a href={`mailto:${siteData.contactEmail}`} className="text-accent hover:underline">
            {siteData.contactEmail}
          </a>
        </p>
      )}
    </Section>
  );
}
