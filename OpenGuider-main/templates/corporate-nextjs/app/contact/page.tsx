import type { Metadata } from "next";
import Section from "@/components/Section";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with {{COMPANY_NAME}}.",
};

export default function ContactPage() {
  return (
    <Section
      eyebrow="Contact"
      title="Let's start a conversation"
      description="Tell us about your project and our team will respond within one business day."
    >
      <ContactForm />
    </Section>
  );
}
