import Link from "next/link";
import { siteData } from "@/lib/site-data";

export default function CtaBand() {
  return (
    <section className="section-py bg-primary" aria-labelledby="cta-heading">
      <div className="container-page text-center">
        <h2 id="cta-heading" className="font-display text-3xl font-bold text-white sm:text-4xl">
          {siteData.companyName} ile tanışın
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/85">{siteData.tagline}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link href="/contact" className="inline-flex rounded-btn bg-white px-6 py-3 text-sm font-semibold text-primary transition hover:opacity-90">
            {siteData.ctaPrimary}
          </Link>
          <Link href="/services" className="inline-flex rounded-btn border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            {siteData.ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}
