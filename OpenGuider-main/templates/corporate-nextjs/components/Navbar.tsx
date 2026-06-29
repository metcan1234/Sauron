"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteData } from "@/lib/site-data";

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-surface/95 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between" aria-label="Ana menü">
        <Link href="/" className="font-display text-lg font-bold text-foreground">
          {siteData.companyName}
        </Link>

        <button
          type="button"
          className="rounded-btn p-2 text-foreground md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="sr-only">Menüyü aç/kapat</span>
          <span aria-hidden="true" className="text-xl leading-none">{open ? "×" : "≡"}</span>
        </button>

        <ul
          id="mobile-menu"
          className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-16 flex-col gap-1 border-b border-white/10 bg-surface p-4 md:static md:flex md:flex-row md:items-center md:gap-6 md:border-0 md:bg-transparent md:p-0`}
        >
          {siteData.navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`block rounded-btn px-3 py-2 text-sm font-medium transition ${
                    active ? "text-accent" : "text-muted hover:text-foreground"
                  }`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
