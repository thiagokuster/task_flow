import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, FieldError } from "@/components/auth-shell";
import { supabase } from "@/integrations/supabase/client";
import { probeSupabaseAuth, type AuthProbe } from "@/lib/auth-status";
import {
  AUTH_UNREACHABLE_ERROR,
  PASSWORD_HINT,
  signInSchema,
  signUpSchema,
  GENERIC_AUTH_ERROR,
  friendlyAuthError,
} from "@/lib/validation";
import {
  clientThrottle,
  markSessionPersistence,
  rememberPostLoginRedirect,
  safeRedirect,
} from "@/lib/session";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({
    mode: z.enum(["signin", "signup"]).catch("signin"),
    redirect: z.string().optional(),
    reauth: z.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — TaskFlow" },
      { name: "description", content: "Acesse sua conta TaskFlow." },
      { property: "og:title", content: "Entrar — TaskFlow" },
      { property: "og:description", content: "Acesse sua conta TaskFlow." },
    ],
  }),
  component: AuthPage,
});

type FormFields = {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
  remember: boolean;
};
type FieldName = keyof FormFields;

function firstFieldErrors(error: z.ZodError): Partial<Record<FieldName, string>> {
  const out: Partial<Record<FieldName, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key as FieldName] = issue.message;
    }
  }
  return out;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  error?: string | undefined;
  hint?: string | undefined;
}) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="pr-10"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      </div>
      {hint && !error ? (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function AuthPage() {
  const { mode, redirect, reauth } = Route.useSearch();
  const navigate = useNavigate();
  const [f, setF] = useState<FormFields>({
    fullName: "",
    email: "",
    password: "",
    confirm: "",
    terms: false,
    remember: true,
  });
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthProbe | null>(null);
  const signup = mode === "signup";

  useEffect(() => {
    void probeSupabaseAuth().then(setAuthStatus);
  }, []);

  function set(k: FieldName) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setF((prev) => ({ ...prev, [k]: value }));
      setErrors((prev) => ({ ...prev, [k]: undefined }));
    };
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (signup) {
      const p = signUpSchema.safeParse(f);
      if (!p.success) {
        setErrors(firstFieldErrors(p.error));
        toast.error(p.error.issues[0]?.message);
        return;
      }
      const wait = clientThrottle("auth");
      if (wait) {
        toast.error(`Muitas tentativas. Aguarde ${wait}s.`);
        return;
      }
      setBusy(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: p.data.email,
          password: p.data.password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: p.data.fullName, terms_accepted: true },
          },
        });
        if (error && !/registered/i.test(error.message)) {
          toast.error(friendlyAuthError(error.message));
          return;
        }
        if (data.session) {
          markSessionPersistence(true);
          navigate({ to: safeRedirect(redirect) as "/dashboard" });
          return;
        }
        setSent(true);
      } catch (err) {
        toast.error(friendlyAuthError(err instanceof Error ? err.message : undefined));
      } finally {
        setBusy(false);
      }
      return;
    }

    const p = signInSchema.safeParse(f);
    if (!p.success) {
      setErrors(firstFieldErrors(p.error));
      toast.error(p.error.issues[0]?.message);
      return;
    }
    const wait = clientThrottle("auth");
    if (wait) {
      toast.error(`Muitas tentativas. Aguarde ${wait}s.`);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(p.data);
      if (error) {
        toast.error(
          /rate|many/i.test(error.message) ? friendlyAuthError(error.message) : GENERIC_AUTH_ERROR,
        );
        return;
      }
      markSessionPersistence(f.remember);
      navigate({ to: safeRedirect(redirect) as "/dashboard" });
    } catch (err) {
      toast.error(friendlyAuthError(err instanceof Error ? err.message : undefined));
    } finally {
      setBusy(false);
    }
  }

  async function social() {
    if (signup && !f.terms) {
      setErrors({ terms: "Aceite os termos para continuar." });
      toast.error("Aceite os termos para continuar.");
      return;
    }
    setBusy(true);
    try {
      const status = await probeSupabaseAuth();
      setAuthStatus(status);
      if (!status.reachable) {
        toast.error(AUTH_UNREACHABLE_ERROR);
        return;
      }
      if (!status.google) {
        toast.error("O login com Google não está habilitado neste projeto Supabase.");
        return;
      }
      sessionStorage.setItem("tf_post_oauth", "1");
      rememberPostLoginRedirect(redirect);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/callback`,
          skipBrowserRedirect: true,
          ...(reauth ? { queryParams: { prompt: "login" } } : {}),
        },
      });
      if (error || !data.url) {
        toast.error(friendlyAuthError(error?.message) || "Não foi possível entrar com Google.");
        return;
      }
      window.location.assign(data.url);
    } catch (err) {
      toast.error(friendlyAuthError(err instanceof Error ? err.message : AUTH_UNREACHABLE_ERROR));
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <AuthShell
        title="Verifique seu e-mail"
        subtitle="Se o endereço puder ser cadastrado, enviamos um link de confirmação. Abra-o para ativar sua conta — o login só funciona depois disso."
      >
        <Link className="text-primary underline" to="/auth" search={{ mode: "signin" }}>
          Voltar para entrar
        </Link>
      </AuthShell>
    );

  return (
    <AuthShell
      title={signup ? "Criar conta" : "Entrar"}
      subtitle={
        reauth
          ? "Entre de novo para confirmar a exclusão da conta."
          : signup
            ? "Comece a organizar suas tarefas."
            : "Bem-vindo de volta."
      }
    >
      {reauth ? (
        <p className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          Por segurança, precisamos que você autentique outra vez antes de apagar a conta.
        </p>
      ) : null}
      {authStatus && !authStatus.reachable ? (
        <p className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {AUTH_UNREACHABLE_ERROR}
        </p>
      ) : null}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {signup && (
          <div>
            <Label htmlFor="n">Nome completo</Label>
            <Input
              id="n"
              autoComplete="name"
              value={f.fullName}
              onChange={set("fullName")}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "n-error" : undefined}
            />
            <FieldError id="n-error" message={errors.fullName} />
          </div>
        )}
        <div>
          <Label htmlFor="e">E-mail</Label>
          <Input
            id="e"
            type="email"
            autoComplete="email"
            value={f.email}
            onChange={set("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "e-error" : undefined}
          />
          <FieldError id="e-error" message={errors.email} />
        </div>
        <PasswordField
          id="p"
          label="Senha"
          autoComplete={signup ? "new-password" : "current-password"}
          value={f.password}
          onChange={set("password")}
          error={errors.password}
          hint={signup ? PASSWORD_HINT : undefined}
        />
        {signup ? (
          <>
            <PasswordField
              id="c"
              label="Confirmar senha"
              autoComplete="new-password"
              value={f.confirm}
              onChange={set("confirm")}
              error={errors.confirm}
            />
            <div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  id="terms"
                  type="checkbox"
                  className="mt-0.5"
                  checked={f.terms}
                  onChange={set("terms")}
                  aria-invalid={Boolean(errors.terms)}
                />
                <span>
                  Aceito os{" "}
                  <Link to="/terms" className="underline">
                    termos
                  </Link>{" "}
                  e a{" "}
                  <Link to="/privacy" className="underline">
                    política de privacidade
                  </Link>
                  {"."}
                </span>
              </label>
              <FieldError id="terms-error" message={errors.terms} />
            </div>
          </>
        ) : (
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={f.remember} onChange={set("remember")} />
            Lembrar de mim
          </label>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Aguarde…" : signup ? "Criar conta" : "Entrar"}
        </Button>
      </form>
      {authStatus?.google ? (
        <div className="mt-4 grid gap-2">
          <Button variant="outline" onClick={social} disabled={busy}>
            Continuar com Google
          </Button>
        </div>
      ) : null}
      <p className="mt-6 text-sm text-muted-foreground">
        {signup ? "Já tem conta? " : "Não tem conta? "}
        <Link
          className="text-primary underline"
          to="/auth"
          search={{ mode: signup ? "signin" : "signup" }}
        >
          {signup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </AuthShell>
  );
}
