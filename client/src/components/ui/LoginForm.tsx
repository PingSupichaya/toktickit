import { FormEvent, useState } from "react";
import { useAuth } from "../../context/AuthContext.js";
import { Alert } from "./Alert.js";
import { Button } from "./Button.js";
import { Input } from "./Input.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ErrorKind = "invalid" | "inactive" | "rate" | "failure";

const BANNER_MESSAGES: Record<ErrorKind, string> = {
  invalid: "Invalid email or password",
  inactive: "Your account is not active. Contact your administrator.",
  rate: "Too many failed login attempts. Try again later.",
  failure: "Unable to sign in. Please try again.",
};

interface FieldErrors {
  email?: string;
  password?: string;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={
          hidden
            ? "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"
            : "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        }
      />
    </svg>
  );
}

export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [bannerKind, setBannerKind] = useState<ErrorKind | null>(null);
  const [busy, setBusy] = useState(false);

  const emailEmpty = email.trim().length === 0;
  const passwordEmpty = password.length === 0;

  function validateEmail(value: string): string | undefined {
    if (!value.trim()) return "Email is required";
    if (!EMAIL_RE.test(value.trim())) return "Enter a valid email address";
    return undefined;
  }

  function validatePassword(value: string): string | undefined {
    if (!value) return "Password is required";
    return undefined;
  }

  function handleEmailBlur() {
    const error = validateEmail(email);
    setFieldErrors((prev) => ({ ...prev, email: error }));
  }

  function handlePasswordBlur() {
    const error = validatePassword(password);
    setFieldErrors((prev) => ({ ...prev, password: error }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const nextErrors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) {
      setBannerKind(null);
      return;
    }

    setBannerKind(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const { status, code } = err as { status?: number; code?: string };
      let kind: ErrorKind;
      if (status === 429) {
        kind = "rate";
      } else if (status === 403 && code === "ACCOUNT_INACTIVE") {
        kind = "inactive";
      } else if (status === 401) {
        kind = "invalid";
      } else {
        kind = "failure";
      }
      setBannerKind(kind);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !emailEmpty && !passwordEmpty && !busy;

  return (
    <div className="auth">
      <h1 className="auth-brand">TokTickIT</h1>
      <p className="auth-subtitle">Sign in to your account</p>

      {bannerKind && (
        <Alert variant="error" className="auth-banner" role="alert" data-testid="login-error">
          {BANNER_MESSAGES[bannerKind]}
        </Alert>
      )}

      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <Input
          label="Email"
          required
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@mail.kmutt.ac.th"
          value={email}
          data-testid="login-email"
          error={fieldErrors.email}
          errorTestId="error-email"
          disabled={busy}
          onChange={(e) => {
            setEmail(e.target.value);
            setBannerKind(null);
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          onBlur={handleEmailBlur}
        />

        <Input
          label="Password"
          required
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          data-testid="login-password"
          error={fieldErrors.password}
          errorTestId="error-password"
          disabled={busy}
          onChange={(e) => {
            setPassword(e.target.value);
            setBannerKind(null);
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
          onBlur={handlePasswordBlur}
        >
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((v) => !v)}
            disabled={busy}
          >
            <EyeIcon hidden={!showPassword} />
          </button>
        </Input>

        <Button
          type="submit"
          variant="primary"
          block
          busy={busy}
          busyLabel="Signing In…"
          disabled={!canSubmit}
          data-testid="login-submit-btn"
        >
          Sign In
        </Button>
      </form>
    </div>
  );
}