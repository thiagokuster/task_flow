export function displayFirstName(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const fromProfile = fullName?.trim().split(/\s+/).find(Boolean);
  if (fromProfile) return fromProfile;
  const local = email?.split("@")[0]?.trim();
  if (local) return local;
  return "você";
}

export function displayFullName(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed;
  return displayFirstName(fullName, email);
}

export function displayInitial(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const name = displayFirstName(fullName, email);
  const letter = name.charAt(0);
  return letter ? letter.toLocaleUpperCase("pt-BR") : "?";
}

export function displayInitials(
  fullName: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const first = parts[0]?.charAt(0) ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
    const letters = `${first}${last}`.toLocaleUpperCase("pt-BR");
    if (letters) return letters;
  }
  return displayInitial(fullName, email);
}

export function dashboardSubtitle(input: {
  pending: number;
  inProgress: number;
  done: number;
}): string {
  if (input.done > 0 && input.pending === 0 && input.inProgress === 0) return "Tudo em dia! 🎉";
  if (input.pending === 1) return "Você tem 1 tarefa pendente hoje";
  return `Você tem ${input.pending} tarefas pendentes hoje`;
}
