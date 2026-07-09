import { ReactNode } from "react";

/** Consistent screen header: uppercase gradient title + context line. */
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="brand-heading text-3xl font-medium tracking-[-0.02em] md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm text-frost/60">{subtitle}</p>
        )}
      </div>
      {actions}
    </div>
  );
}
