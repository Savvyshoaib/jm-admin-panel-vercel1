import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/admin/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearResetState, readResetContext } from "@/store/slices/authSlice";

const resetSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address"),
    token: z.string().trim().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetValues = z.infer<typeof resetSchema>;

function PasswordField({
  id,
  label,
  autoComplete,
  error,
  register,
  disabled,
}: {
  id: string;
  label: string;
  autoComplete: string;
  error?: string;
  register: ReturnType<typeof useForm<ResetValues>>["register"];
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="pr-10"
          disabled={disabled}
          aria-invalid={!!error}
          {...register(id as keyof ResetValues)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function readResetQueryParams(search: string): {
  email: string | null;
  token: string | null;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const email = params.get("email");
  const token = params.get("token") ?? params.get("resetToken");
  return {
    email: email?.trim() || null,
    token: token?.trim() || null,
  };
}

export type ResetPasswordFlowProps = {
  title: string;
  description: (ctx: { email: string | null }) => string;
  successTitle: string;
  successDescription: string;
  submitLabel: string;
  /** Invite links: only use email/token from the URL (ignore forgot-password session). */
  urlOnlyContext?: boolean;
  /** When true and URL has no token, show a blocking error instead of a paste field. */
  requireTokenFromUrl?: boolean;
  showForgotPasswordTip?: boolean;
};

export function ResetPasswordFlow({
  title,
  description,
  successTitle,
  successDescription,
  submitLabel,
  urlOnlyContext = false,
  requireTokenFromUrl = false,
  showForgotPasswordTip = false,
}: ResetPasswordFlowProps) {
  const { resetPassword } = useAuth();
  const dispatch = useAppDispatch();
  const reset = useAppSelector((s) => s.auth.reset);
  const [, setLocation] = useLocation();
  const search = useSearch();

  const initial = useMemo(() => {
    const fromQuery = readResetQueryParams(search);
    if (urlOnlyContext) {
      return {
        email: fromQuery.email ?? "",
        token: fromQuery.token ?? "",
      };
    }
    const fromSession = readResetContext();
    return {
      email: fromQuery.email ?? fromSession.email ?? "",
      token: fromQuery.token ?? fromSession.token ?? "",
    };
  }, [search, urlOnlyContext]);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: initial.email,
      token: initial.token,
      password: "",
      confirmPassword: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    form.reset({
      email: initial.email,
      token: initial.token,
      password: "",
      confirmPassword: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-seed when URL/session context changes
  }, [initial.email, initial.token]);

  useEffect(() => {
    return () => {
      dispatch(clearResetState());
    };
  }, [dispatch]);

  const password = form.watch("password");
  const checks = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(password), label: "Contains a letter" },
    { ok: /[0-9]/.test(password), label: "Contains a number" },
  ];

  const submitting = form.formState.isSubmitting || reset.status === "loading";
  const done = reset.status === "succeeded";
  const emailLocked = Boolean(initial.email);
  const tokenLocked = Boolean(initial.token);
  const missingRequiredToken = requireTokenFromUrl && !initial.token;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await resetPassword({
      email: values.email,
      token: values.token,
      password: values.password,
      passwordConfirmation: values.confirmPassword,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
  });

  if (done) {
    return (
      <AuthShell
        title={successTitle}
        description={reset.message || successDescription}
        footer={
          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={() => setLocation("/login")}
          >
            Back to sign in
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-primary">
            <CheckCircle2 className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">{successDescription}</p>
        </div>
      </AuthShell>
    );
  }

  if (missingRequiredToken) {
    return (
      <AuthShell
        title={title}
        description="This invite link is missing a reset token."
        footer={
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        }
      >
        <div className="rounded-md border border-error/40 bg-error/10 px-4 py-6 text-sm text-error">
          Open the link from your invitation email. It should include a{" "}
          <code className="text-xs">token</code> query parameter.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={title}
      description={description({ email: initial.email || null })}
      footer={
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {!emailLocked && (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@josephmews.com"
              disabled={submitting}
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-error" role="alert">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
        )}
        {emailLocked && <input type="hidden" {...form.register("email")} />}

        {!tokenLocked && (
          <div className="space-y-2">
            <Label htmlFor="token">Reset token</Label>
            <Input
              id="token"
              type="text"
              autoComplete="off"
              placeholder="Paste the token from your email"
              disabled={submitting}
              aria-invalid={!!form.formState.errors.token}
              {...form.register("token")}
            />
            {form.formState.errors.token && (
              <p className="text-xs text-error" role="alert">
                {form.formState.errors.token.message}
              </p>
            )}
          </div>
        )}
        {tokenLocked && <input type="hidden" {...form.register("token")} />}

        {showForgotPasswordTip && !initial.token && !initial.email && (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            Tip: start from{" "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Forgot password
            </Link>{" "}
            so we can fill your email and token automatically.
          </p>
        )}

        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          register={form.register}
          disabled={submitting}
        />

        <ul className="space-y-1.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          {checks.map((check) => (
            <li
              key={check.label}
              className={
                check.ok ? "text-xs text-primary" : "text-xs text-muted-foreground"
              }
            >
              {check.ok ? "✓" : "○"} {check.label}
            </li>
          ))}
        </ul>

        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          error={form.formState.errors.confirmPassword?.message}
          register={form.register}
          disabled={submitting}
        />

        {reset.error && (
          <p
            className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error"
            role="alert"
          >
            {reset.error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={submitting || !form.formState.isValid}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
