import Link from "next/link";

export default function CtaBand() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="cta-heading">
      <div className="container-page">
        <div className="rounded-2xl bg-primary px-8 py-12 text-center sm:px-12">
          <h2 id="cta-heading" className="text-2xl font-bold text-white sm:text-3xl">
            Ready to work with {{COMPANY_NAME}}?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/90">
            Schedule a consultation and discover how we can help you achieve your next milestone.
          </p>
          <Link href="/contact" className="btn-secondary mt-8 border-white/40 text-white hover:border-white hover:text-white">
            Contact our team
          </Link>
        </div>
      </div>
    </section>
  );
}
