import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { displayInitials } from "@/lib/greeting";
import { cn } from "@/lib/utils";

const TONES = [
  "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  "bg-violet-500/15 text-violet-800 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-rose-500/15 text-rose-800 dark:text-rose-300",
] as const;

function toneFor(seed: string): string {
  let n = 0;
  for (const ch of seed) n = (n + ch.charCodeAt(0)) % TONES.length;
  return TONES[n] ?? "bg-sky-500/15 text-sky-800 dark:text-sky-300";
}

export function UserAvatar({
  name,
  email,
  className,
}: {
  name: string | null | undefined;
  email?: string | null;
  className?: string;
}) {
  const initials = displayInitials(name, email);
  const seed = name?.trim() || email?.trim() || initials;
  return (
    <Avatar className={cn("size-8", className)}>
      <AvatarFallback className={cn("text-xs font-semibold", toneFor(seed))}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
