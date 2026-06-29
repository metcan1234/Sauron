"use client";

import { FormEvent, useState } from "react";
import { siteData } from "@/lib/site-data";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="card-elevated" role="status">
        <p className="font-semibold text-foreground">Mesajınız alındı.</p>
        <p className="mt-2 text-sm text-muted">
          {siteData.companyName} ekibimiz en kısa sürede sizinle iletişime geçecek.
        </p>
      </div>
    );
  }

  return (
    <form className="card-elevated max-w-xl space-y-6" onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Ad soyad
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-2 w-full rounded-btn border border-white/20 bg-surface px-4 py-2.5 text-foreground placeholder:text-muted focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 w-full rounded-btn border border-white/20 bg-surface px-4 py-2.5 text-foreground placeholder:text-muted focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-foreground">
          Mesajınız
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="mt-2 w-full rounded-btn border border-white/20 bg-surface px-4 py-2.5 text-foreground placeholder:text-muted focus:border-accent"
        />
      </div>
      <button type="submit" className="btn-primary w-full sm:w-auto">
        Gönder
      </button>
    </form>
  );
}
