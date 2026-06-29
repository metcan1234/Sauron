const PARTNERS = ["Northwind", "Contoso", "Fabrikam", "Tailwind Labs", "Globex"];

export default function LogoCloud() {
  return (
    <section className="py-12" aria-label="Trusted by leading organizations">
      <div className="container-page">
        <p className="text-center text-sm font-medium uppercase tracking-wider text-muted">
          Trusted by industry leaders
        </p>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {PARTNERS.map((name) => (
            <li
              key={name}
              className="text-lg font-semibold text-muted/70 transition hover:text-muted"
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
