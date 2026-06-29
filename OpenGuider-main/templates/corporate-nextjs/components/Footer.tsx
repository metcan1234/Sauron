import Link from "next/link";
import { siteData } from "@/lib/site-data";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-surface-elevated">
      <div className="container-page py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-foreground">{siteData.companyName}</p>
            <p className="mt-2 max-w-sm text-sm text-muted">{siteData.tagline}</p>
            {siteData.contactEmail && (
              <a href={`mailto:${siteData.contactEmail}`} className="mt-3 inline-block text-sm text-accent hover:underline">
                {siteData.contactEmail}
              </a>
            )}
          </div>
          <nav aria-label="Alt menü">
            <ul className="flex flex-wrap gap-4 text-sm text-muted">
              {siteData.navLinks.filter((l) => l.href !== "/").map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-8 border-t border-white/10 pt-8 text-sm text-muted">
          © {year} {siteData.companyName}. Tüm hakları saklıdır.
        </p>
      </div>
    </footer>
  );
}
