import type { Metadata } from "next";
import Section from "@/components/Section";
import ServiceGrid from "@/components/ServiceGrid";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore services offered by {{COMPANY_NAME}}.",
};

export default function ServicesPage() {
  return (
    <>
      <Section
        eyebrow="Services"
        title="Solutions designed for growth"
        description="From strategy to delivery, {{COMPANY_NAME}} provides end-to-end support aligned with your business objectives."
      />
      <ServiceGrid showHeading={false} />
    </>
  );
}
