import { ResetPasswordFlow } from "@/pages/ResetPasswordFlow";

/** Admin / staff invite acceptance — sets password via reset-password API. */
export function AcceptInviteResetPasswordPage() {
  return (
    <ResetPasswordFlow
      title="Accept invite"
      description={({ email }) =>
        email
          ? `Set a password to activate your account for ${email}.`
          : "Set a password to activate your Joseph Mews admin account."
      }
      successTitle="Invite accepted"
      successDescription="Your password is set. Sign in with your email and new password."
      submitLabel="Set password & continue"
      urlOnlyContext
      requireTokenFromUrl
    />
  );
}
