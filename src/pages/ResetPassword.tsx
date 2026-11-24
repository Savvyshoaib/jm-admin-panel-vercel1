import { ResetPasswordFlow } from "@/pages/ResetPasswordFlow";

export function ResetPasswordPage() {
  return (
    <ResetPasswordFlow
      title="New password"
      description={({ email }) =>
        email
          ? `Choose a new password for ${email}.`
          : "Choose a new password for your admin account."
      }
      successTitle="Password updated"
      successDescription="You can now sign in with your updated credentials."
      submitLabel="Save new password"
      showForgotPasswordTip
    />
  );
}

