import { ReactNode } from "react";

type SectionProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

export default function Section({ eyebrow, title, description, children }: SectionProps) {
  return (
    <section className="py-16 sm:py-20">
      <div className="container-page">
        {eyebrow && (
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
        )}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-lg text-muted">{description}</p>
        )}
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}
