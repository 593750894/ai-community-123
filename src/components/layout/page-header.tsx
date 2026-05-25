import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 border-b border-border/60 px-6 py-6 sm:px-8 sm:py-7",
        className,
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          {eyebrow && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
              {eyebrow}
            </span>
          )}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
