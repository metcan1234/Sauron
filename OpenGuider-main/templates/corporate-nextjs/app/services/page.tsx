import type { Metadata } from "next";
import Section from "@/components/Section";
import ServiceGrid from "@/components/ServiceGrid";
import { siteData } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "{{PAGE_SERVICES_SEO_TITLE}}",
  description: "{{PAGE_SERVICES_SEO_DESCRIPTION}}",
};

export default function ServicesPage() {
  return (
    <>
      <Section
        eyebrow={siteData.servicesEyebrow}
        title={siteData.servicesTitle}
        description={`${siteData.companyName} olarak stratejiden teslimata uçtan uca destek sağlıyoruz.`}
      />
      <ServiceGrid showHeading={false} />
    </>
  );
}
