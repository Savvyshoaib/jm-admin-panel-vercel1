import { ResetPasswordFlow } from "@/pages/ResetPasswordFlow";

/** Investor invite acceptance — sets password via reset-password API. */
export function InvestorInviteResetPasswordPage() {
  return (
    <ResetPasswordFlow
      title="Complete your invite"
      description={({ email }) =>
        email
          ? `Choose a password for your investor account (${email}).`
          : "Choose a password for your Joseph Mews investor account."
      }
      successTitle="You're all set"
      successDescription="Your password is ready. Sign in to open your investor account."
      submitLabel="Set password"
      urlOnlyContext
      requireTokenFromUrl
    />
  );
}
