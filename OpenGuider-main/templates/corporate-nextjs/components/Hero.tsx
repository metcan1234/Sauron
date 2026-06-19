import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-surface-elevated">
      <div className="container-page py-20 sm:py-28 lg:py-32">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            {{COMPANY_NAME}}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {{TAGLINE}}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            We deliver enterprise-grade solutions with the agility of a focused
            team. Partner with us to transform your vision into measurable results.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/contact" className="btn-primary">
              Get started
            </Link>
            <Link href="/services" className="btn-secondary">
              View services
            </Link>
          </div>
        </div>
      </div>
      <div
        className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        aria-hidden="true"
      />
    </section>
  );
}
