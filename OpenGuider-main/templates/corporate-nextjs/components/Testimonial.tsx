import { siteData } from "@/lib/site-data";

export default function Testimonial() {
  const { quote, author, role } = siteData.testimonial;
  return (
    <section className="section-py" aria-labelledby="testimonial-heading">
      <div className="container-page max-w-3xl">
        <h2 id="testimonial-heading" className="sr-only">Müşteri görüşü</h2>
        <blockquote className="card-elevated">
          <p className="font-display text-xl leading-relaxed text-foreground sm:text-2xl">
            &ldquo;{quote}&rdquo;
          </p>
          <footer className="mt-6 flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-accent"
              aria-hidden="true"
            >
              {author.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <cite className="not-italic font-semibold text-foreground">{author}</cite>
              <p className="text-sm text-muted">{role}</p>
            </div>
          </footer>
        </blockquote>
      </div>
    </section>
  );
}
