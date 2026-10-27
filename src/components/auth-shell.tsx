import type { ReactNode } from "react";
import { Logo } from "./brand";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-ink-foreground lg:flex lg:flex-col lg:justify-between">
        <Logo inverted />
        <div className="space-y-6">
          <p className="font-display text-4xl font-bold leading-tight">
            Menos ruído.
            <br />
            <span className="text-accent">Mais feito.</span>
          </p>
          <ul className="space-y-3 text-sm text-ink-foreground/75">
            <li>• Seus dados isolados por conta, protegidos no banco.</li>
            <li>• Entre com e-mail ou Google.</li>
            <li>• Exporte ou exclua seus dados quando quiser.</li>
          </ul>
        </div>
        <div aria-hidden className="bg-grid absolute inset-0 opacity-40" />
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-md animate-rise">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-destructive">
      {message}
    </p>
  );
}
