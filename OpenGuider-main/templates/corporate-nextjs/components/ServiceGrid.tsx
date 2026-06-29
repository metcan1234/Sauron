import Image from "next/image";
import { siteData } from "@/lib/site-data";

export default function ServiceGrid({ showHeading = true }: { showHeading?: boolean }) {
  return (
    <section className="section-py" aria-labelledby={showHeading ? "services-heading" : undefined}>
      <div className="container-page">
        {showHeading && (
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              {siteData.servicesEyebrow}
            </p>
            <h2 id="services-heading" className="mt-2 font-display text-3xl font-bold text-foreground">
              {siteData.servicesTitle}
            </h2>
          </div>
        )}
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {siteData.services.map((service) => (
            <li key={service.title} className="card-elevated">
              <Image
                src="/icons/service-default.svg"
                alt=""
                width={48}
                height={48}
                className="mb-4 opacity-80"
              />
              <h3 className="text-lg font-semibold text-foreground">{service.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{service.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
