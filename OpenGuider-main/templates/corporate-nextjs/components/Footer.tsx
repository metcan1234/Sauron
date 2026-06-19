import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-surface-elevated">
      <div className="container-page py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold text-foreground">{{COMPANY_NAME}}</p>
            <p className="mt-2 max-w-sm text-sm text-muted">{{TAGLINE}}</p>
          </div>
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-4 text-sm text-muted">
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><Link href="/services" className="hover:text-foreground">Services</Link></li>
              <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
            </ul>
          </nav>
        </div>
        <p className="mt-8 border-t border-white/10 pt-8 text-sm text-muted">
          © {year} {{COMPANY_NAME}}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
