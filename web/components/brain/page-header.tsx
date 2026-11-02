import type { ReactNode } from 'react';

/** Title block shared by the app pages (same spacing as the home and roadmap headers). */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 px-4 pt-10 pb-6 sm:px-8 md:pt-12">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}
