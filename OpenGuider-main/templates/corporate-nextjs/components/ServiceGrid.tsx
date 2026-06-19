const SERVICES = [
  {
    title: "Strategy & Advisory",
    description: "Align leadership goals with actionable roadmaps and clear KPIs.",
  },
  {
    title: "Digital Transformation",
    description: "Modernize operations with scalable platforms and secure integrations.",
  },
  {
    title: "Managed Services",
    description: "Reliable ongoing support so your teams can focus on core business.",
  },
  {
    title: "Compliance & Risk",
    description: "Proactive governance frameworks tailored to regulated industries.",
  },
];

type ServiceGridProps = {
  showHeading?: boolean;
};

export default function ServiceGrid({ showHeading = true }: ServiceGridProps) {
  return (
    <section className="py-16 sm:py-20" aria-labelledby={showHeading ? "services-heading" : undefined}>
      <div className="container-page">
        {showHeading && (
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">What we do</p>
            <h2 id="services-heading" className="mt-2 text-3xl font-bold text-foreground">
              Services built for enterprise impact
            </h2>
          </div>
        )}
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <li
              key={service.title}
              className="rounded-xl border border-white/10 bg-surface-elevated p-6 transition hover:border-accent/40"
            >
              <h3 className="text-lg font-semibold text-foreground">{service.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{service.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
