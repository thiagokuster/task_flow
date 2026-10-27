import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight", className)} aria-label="TaskFlow, página inicial">
      <span
        aria-hidden
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          inverted ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-primary text-primary-foreground",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l4.5 4.5L20 6" />
        </svg>
      </span>
      <span>
        Task<span className={inverted ? "text-sidebar-primary" : "text-primary"}>Flow</span>
      </span>
    </Link>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} TaskFlow</p>
        <nav className="flex gap-5" aria-label="Links legais">
          <Link to="/privacy" className="hover:text-foreground">Privacidade</Link>
          <Link to="/terms" className="hover:text-foreground">Termos de uso</Link>
        </nav>
      </div>
    </footer>
  );
}
