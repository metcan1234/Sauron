import { siteData } from "@/lib/site-data";

export default function FeatureBento() {
  const items = siteData.services.slice(0, 4);
  return (
    <section className="section-py" aria-labelledby="bento-heading">
      <div className="container-page">
        <h2 id="bento-heading" className="sr-only">Öne çıkan özellikler</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <article
              key={item.title}
              className={`card-elevated ${index === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
            >
              <h3 className="font-display text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
