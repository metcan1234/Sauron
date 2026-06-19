const STATS = [
  { value: "15+", label: "Years of experience" },
  { value: "200+", label: "Clients served" },
  { value: "98%", label: "Client retention" },
  { value: "24/7", label: "Support coverage" },
];

export default function StatsRow() {
  return (
    <section className="border-y border-white/10 bg-surface-elevated py-12" aria-label="Company statistics">
      <div className="container-page">
        <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="text-sm text-muted">{stat.label}</dt>
              <dd className="mt-2 text-3xl font-bold text-primary">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
