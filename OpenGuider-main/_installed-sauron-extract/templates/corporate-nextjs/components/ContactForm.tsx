"use client";

import { FormEvent, useState } from "react";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-accent/30 bg-surface-elevated p-6" role="status">
        <p className="font-semibold text-foreground">Thank you for reaching out.</p>
        <p className="mt-2 text-sm text-muted">
          A member of the {{COMPANY_NAME}} team will contact you shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      className="max-w-xl space-y-6 rounded-xl border border-white/10 bg-surface-elevated p-6"
      onSubmit={handleSubmit}
      noValidate
    >
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="mt-2 w-full rounded-lg border border-white/20 bg-surface px-4 py-2.5 text-foreground placeholder:text-muted focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-2 w-full rounded-lg border border-white/20 bg-surface px-4 py-2.5 text-foreground placeholder:text-muted focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-foreground">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="mt-2 w-full rounded-lg border border-white/20 bg-surface px-4 py-2.5 text-foreground placeholder:text-muted focus:border-accent"
        />
      </div>
      <button type="submit" className="btn-primary w-full sm:w-auto">
        Send message
      </button>
    </form>
  );
}
