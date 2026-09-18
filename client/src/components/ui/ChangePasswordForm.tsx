import { FormEvent, useState } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { Alert } from "./Alert.js";
import { Button } from "./Button.js";
import { Input } from "./Input.js";
import { PasswordStrengthList, PasswordRuleState } from "./PasswordStrengthList.js";

function buildRules(
  currentPassword: string,
  newPassword: string
): PasswordRuleState[] {
  return [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "At least one lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "At least one digit", met: /\d/.test(newPassword) },
    { label: "At least one special character", met: /[^A-Za-z0-9]/.test(newPassword) },
    {
      label: "Different from the current password",
      met: newPassword.length > 0 && newPassword !== currentPassword,
    },
  ];
}

interface FieldErrors {
  current?: string;
  newPassword?: string;
  confirm?: string;
}

export function ChangePasswordForm() {
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const rules = buildRules(currentPassword, newPassword);
  const allRulesMet = rules.every((rule) => rule.met);
  const confirmMatches = confirmPassword.length > 0 && confirmPassword === newPassword;

  const canSubmit =
    currentPassword.length > 0 && allRulesMet && confirmMatches && !busy;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    setSuccess(false);

    const nextErrors: FieldErrors = {};
    if (!rules.every((rule) => rule.met)) {
      nextErrors.newPassword = "Password does not meet the requirements";
    }
    if (!confirmMatches) {
      nextErrors.confirm = "Passwords do not match";
    }
    setFieldErrors(nextErrors);
    if (nextErrors.newPassword || nextErrors.confirm) return;

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess(true);
    } catch (err) {
      const { status, code, message } = err as {
        status?: number;
        code?: string;
        message?: string;
      };
      if (status === 401 && code === "INVALID_CURRENT_PASSWORD") {
        setFieldErrors((prev) => ({
          ...prev,
          current: message ?? "Current password is incorrect.",
        }));
      } else {
        setFailure(
          status === 400
            ? (message ?? "Password could not be updated.")
            : "Unable to update your password. Please try again."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <h1 className="auth-brand">Change Your Password</h1>
      <p className="auth-subtitle">
        You must choose a new password before continuing.
      </p>

      {failure && (
        <Alert variant="error" className="auth-banner" role="alert" data-testid="change-password-error">
          {failure}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="auth-banner" role="status" data-testid="change-password-success">
          Password updated
        </Alert>
      )}

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <Input
          label="Current Password"
          required
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          data-testid="current-password"
          error={fieldErrors.current}
          errorTestId="error-current-password"
          disabled={busy}
          onChange={(e) => {
            setCurrentPassword(e.target.value);
            setFailure(null);
            setFieldErrors((prev) => ({ ...prev, current: undefined }));
          }}
        />

        <Input
          label="New Password"
          required
          type="password"
          autoComplete="new-password"
          value={newPassword}
          data-testid="new-password"
          error={fieldErrors.newPassword}
          errorTestId="error-new-password"
          disabled={busy}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setFailure(null);
            setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
          }}
        >
          <PasswordStrengthList rules={rules} />
        </Input>

        <Input
          label="Confirm New Password"
          required
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          data-testid="confirm-password"
          error={fieldErrors.confirm}
          errorTestId="error-confirm-password"
          disabled={busy}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            setFailure(null);
            setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
          }}
        />

        <Button
          type="submit"
          variant="primary"
          block
          busy={busy}
          busyLabel="Updating…"
          disabled={!canSubmit}
          data-testid="change-password-btn"
        >
          Change Password and Continue
        </Button>
      </form>

      <div className="auth-logout">
        <Button variant="ghost" data-testid="change-password-logout" onClick={() => logout()}>
          Logout
        </Button>
      </div>
    </div>
  );
}