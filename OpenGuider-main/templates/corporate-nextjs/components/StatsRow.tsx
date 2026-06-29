import { siteData } from "@/lib/site-data";

export default function StatsRow() {
  return (
    <section className="border-y border-white/10 bg-surface-elevated py-12" aria-label="İstatistikler">
      <div className="container-page">
        <ul className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {siteData.stats.map((stat) => (
            <li key={stat.label} className="text-center">
              <p className="font-display text-3xl font-bold text-accent sm:text-4xl">{stat.value}</p>
              <p className="mt-2 text-sm text-muted">{stat.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
