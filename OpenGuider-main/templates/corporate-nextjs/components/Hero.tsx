import Image from "next/image";
import Link from "next/link";
import { siteData } from "@/lib/site-data";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-surface-elevated section-py">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            {siteData.companyName}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {siteData.tagline}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            {siteData.heroSubtitle}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/contact" className="btn-primary">
              {siteData.ctaPrimary}
            </Link>
            <Link href="/services" className="btn-secondary">
              {siteData.ctaSecondary}
            </Link>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-lg">
          <div className="card-elevated overflow-hidden p-2">
            <Image
              src="/placeholders/hero-abstract.svg"
              alt=""
              width={800}
              height={600}
              className="h-auto w-full rounded-card object-cover"
              priority
            />
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
