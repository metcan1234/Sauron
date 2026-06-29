export default function Testimonial() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="testimonial-heading">
      <div className="container-page">
        <h2 id="testimonial-heading" className="sr-only">
          Client testimonial
        </h2>
        <figure className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-surface-elevated p-8 sm:p-12">
          <blockquote className="text-xl leading-relaxed text-foreground sm:text-2xl">
            &ldquo;{{COMPANY_NAME}} transformed how we operate. Their team delivered on time,
            communicated clearly, and exceeded our expectations at every milestone.&rdquo;
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
              aria-hidden="true"
            >
              JD
            </div>
            <div>
              <p className="font-semibold text-foreground">Jane Doe</p>
              <p className="text-sm text-muted">Chief Operations Officer, Acme Corp</p>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
