import Image from "next/image";
import { siteData } from "@/lib/site-data";

export default function LogoCloud() {
  return (
    <section className="py-12" aria-labelledby="partners-heading">
      <div className="container-page">
        <h2 id="partners-heading" className="sr-only">İş ortakları</h2>
        <ul className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
          {siteData.partners.map((name) => (
            <li key={name} className="flex items-center gap-2 text-muted opacity-70 transition hover:opacity-100">
              <Image src="/icons/partner-mark.svg" alt="" width={32} height={32} className="shrink-0" />
              <span className="text-sm font-medium">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
