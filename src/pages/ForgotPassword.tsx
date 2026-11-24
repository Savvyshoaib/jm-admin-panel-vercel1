import { useEffect } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/admin/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearForgotState } from "@/store/slices/authSlice";

const forgotSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const dispatch = useAppDispatch();
  const forgot = useAppSelector((s) => s.auth.forgot);

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    return () => {
      dispatch(clearForgotState());
    };
  }, [dispatch]);

  const submitting = form.formState.isSubmitting || forgot.status === "loading";
  const sentTo = forgot.status === "succeeded" ? forgot.lastEmail : null;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await requestPasswordReset(values.email);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
  });

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        description={
          forgot.message ||
          `If an account exists for ${sentTo}, you’ll receive a link to set a new password.`
        }
        footer={
          <div className="flex w-full flex-col gap-3">
            {/* <Button asChild className="w-full" size="lg">
              <Link href="/reset-password">Continue to new password</Link>
            </Button> */}
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to sign in
            </Link>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-gold-soft text-primary">
            <MailCheck className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            Follow the link in your email to choose a new password.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot password"
      description="Enter the email linked to your admin account and we’ll send a reset link."
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

        {forgot.error && (
          <p
            className="rounded-md border border-error/40 bg-error/10 px-3 py-2 text-sm text-error"
            role="alert"
          >
            {forgot.error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending link…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
