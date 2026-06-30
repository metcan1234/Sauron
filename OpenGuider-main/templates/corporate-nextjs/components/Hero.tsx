import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-surface-elevated">
      <div className="container-page py-20 sm:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              {{COMPANY_NAME}}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {{TAGLINE}}
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              {{HERO_SUBTITLE}}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/contact" className="btn-primary">
                {{CTA_PRIMARY}}
              </Link>
              <Link href="/services" className="btn-secondary">
                {{CTA_SECONDARY}}
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <Image
              src="/placeholders/hero-abstract.svg"
              alt=""
              width={480}
              height={360}
              className="h-auto w-full"
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
