import * as React from "react";

import { cn } from "@/lib/utils";

export function FormField({
  label,
  hint,
  required,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: string;
  hint?: React.ReactNode;
  required?: boolean;
  error?: string | string[] | null;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium leading-none">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      )}
      {children}
      {errors.length > 0 ? (
        <ul className="space-y-0.5">
          {errors.map((e) => (
            <li key={e} className="text-xs text-destructive">
              · {e}
            </li>
          ))}
        </ul>
      ) : (
        hint && <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function FormError({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive",
        className,
      )}
    >
      {message}
    </p>
  );
}
