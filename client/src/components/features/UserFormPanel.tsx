import { FormEvent, useState } from "react";
import type {
  AdminUser,
  CreateUserInput,
  UpdateUserInput,
  UserRole,
} from "../../api.js";
import { Alert } from "../ui/Alert.js";
import { Button } from "../ui/Button.js";
import { Input } from "../ui/Input.js";
import {
  PasswordStrengthList,
  PasswordRuleState,
} from "../ui/PasswordStrengthList.js";
import { Select } from "../ui/Select.js";
import { SidePanel } from "../ui/SidePanel.js";
import { Toggle } from "../ui/Toggle.js";

const ROLE_CHOICES: { value: UserRole; label: string }[] = [
  { value: "REQUESTER", label: "Requester" },
  { value: "IT_STAFF", label: "IT Staff" },
  { value: "ADMIN", label: "Administrator" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_KEYS = [
  "name",
  "email",
  "role",
  "isActive",
  "initialPassword",
  "newPassword",
] as const;

interface FieldErrors {
  name?: string;
  email?: string;
  role?: string;
  isActive?: string;
  initialPassword?: string;
  newPassword?: string;
}

function buildRules(value: string): PasswordRuleState[] {
  return [
    { label: "At least 8 characters", met: value.length >= 8 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(value) },
    { label: "At least one lowercase letter", met: /[a-z]/.test(value) },
    { label: "At least one digit", met: /\d/.test(value) },
    { label: "At least one special character", met: /[^A-Za-z0-9]/.test(value) },
  ];
}

// Maps a server error to per-field messages. Known conflicts produce an
// inline field error (duplicate email, validation details); anything else is
// surfaced as a general banner by the caller.
function toFieldErrors(err: unknown): FieldErrors {
  const e = err as {
    code?: string;
    message?: string;
    details?: Record<string, string>;
  };
  if (e.code === "EMAIL_ALREADY_EXISTS") {
    return { email: e.message ?? "This email is already in use." };
  }
  if (e.code === "VALIDATION_ERROR" && e.details) {
    const result: FieldErrors = {};
    for (const [key, value] of Object.entries(e.details)) {
      if ((FIELD_KEYS as readonly string[]).includes(key)) {
        (result as Record<string, string>)[key] = value;
      }
    }
    return result;
  }
  return {};
}

interface UserFormPanelProps {
  open: boolean;
  mode: "create" | "edit";
  user: AdminUser | null;
  currentUserId: number;
  activeAdminCount: number;
  onSubmitCreate: (input: CreateUserInput) => Promise<void>;
  onSubmitUpdate: (userId: number, input: UpdateUserInput) => Promise<void>;
  onResetPassword: (userId: number, newPassword: string) => Promise<void>;
  onClose: () => void;
}

export function UserFormPanel({
  open,
  mode,
  user,
  currentUserId,
  activeAdminCount,
  onSubmitCreate,
  onSubmitUpdate,
  onResetPassword,
  onClose,
}: UserFormPanelProps) {
  const editing = mode === "edit" ? user : null;
  const isSelf = editing !== null && editing.id === currentUserId;

  const [name, setName] = useState(editing?.name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [role, setRole] = useState<UserRole>(editing?.role ?? "REQUESTER");
  const [isActive, setIsActive] = useState(editing ? editing.isActive : true);
  const [initialPassword, setInitialPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetErrors, setResetErrors] = useState<{ newPassword?: string }>({});

  const initialRules = buildRules(initialPassword);
  const initialValid = initialRules.every((rule) => rule.met);
  const resetRules = buildRules(resetPassword);
  const resetValid = resetRules.every((rule) => rule.met);

  // ui-spec 6.4 — safety hint when a change would remove the last active
  // Administrator. The server is authoritative (409 LAST_ACTIVE_ADMIN).
  const editedWasActiveAdmin =
    editing !== null && editing.role === "ADMIN" && editing.isActive;
  const otherActiveAdmins = activeAdminCount - (editedWasActiveAdmin ? 1 : 0);
  const wouldRemoveLastAdmin =
    editedWasActiveAdmin &&
    otherActiveAdmins === 0 &&
    (role !== "ADMIN" || !isActive);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    setFieldErrors({});

    const next: FieldErrors = {};
    if (name.trim().length === 0) next.name = "Name is required.";
    if (!EMAIL_RE.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (mode === "create" && !initialValid) {
      next.initialPassword = "Password does not meet the requirements";
    }
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      if (mode === "create") {
        await onSubmitCreate({
          name: name.trim(),
          email: email.trim(),
          role,
          isActive,
          initialPassword,
        });
      } else if (editing) {
        await onSubmitUpdate(editing.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          isActive,
        });
      }
    } catch (err) {
      const mapped = toFieldErrors(err);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors((prev) => ({ ...prev, ...mapped }));
      } else {
        const e = err as { message?: string };
        setFailure(e.message ?? "Unable to save the user. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setResetErrors({});
    setResetSuccess(false);
    if (!resetValid) {
      setResetErrors({ newPassword: "Password does not meet the requirements" });
      return;
    }
    if (!editing) return;

    setResetBusy(true);
    try {
      await onResetPassword(editing.id, resetPassword);
      setResetSuccess(true);
      setResetPassword("");
    } catch (err) {
      const mapped = toFieldErrors(err);
      const e = err as { message?: string };
      setResetErrors({
        newPassword: mapped.newPassword ?? e.message ?? "Unable to set the initial password.",
      });
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <SidePanel
      open={open}
      title={mode === "edit" ? "Edit User" : "Create User"}
      onClose={onClose}
    >
      {failure && (
        <Alert
          variant="error"
          role="alert"
          data-testid="user-panel-error"
          className="user-panel__banner"
        >
          {failure}
        </Alert>
      )}
      {wouldRemoveLastAdmin && (
        <Alert
          variant="warning"
          data-testid="last-admin-hint"
          className="user-panel__banner"
        >
          This change would leave the system without an active Administrator. The
          server will reject it.
        </Alert>
      )}

      <form className="user-panel__form" noValidate onSubmit={handleSubmit}>
        <Input
          label="Full Name"
          required
          maxLength={200}
          value={name}
          data-testid="user-name-input"
          error={fieldErrors.name}
          errorTestId="error-user-name"
          disabled={busy}
          onChange={(event) => {
            setName(event.target.value);
            setFieldErrors((prev) => ({ ...prev, name: undefined }));
          }}
        />
        <Input
          label="Email"
          required
          type="email"
          maxLength={254}
          value={email}
          data-testid="user-email-input"
          error={fieldErrors.email}
          errorTestId="error-user-email"
          disabled={busy}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />
        <Select
          label="Role"
          data-testid="user-role-select"
          value={role}
          options={ROLE_CHOICES}
          onChange={setRole}
          disabled={busy}
        />
        <Toggle
          checked={isActive}
          onChange={setIsActive}
          label="Active"
          disabled={isSelf}
          hint={
            isSelf ? "You cannot deactivate your own account." : undefined
          }
          data-testid="user-active-toggle"
        />

        {mode === "create" && (
          <Input
            label="Initial Password"
            required
            type="password"
            value={initialPassword}
            data-testid="user-initial-password"
            error={fieldErrors.initialPassword}
            errorTestId="error-initial-password"
            hint="The user must change this at first sign-in."
            disabled={busy}
            onChange={(event) => {
              setInitialPassword(event.target.value);
              setFailure(null);
              setFieldErrors((prev) => ({ ...prev, initialPassword: undefined }));
            }}
          >
            <PasswordStrengthList rules={initialRules} />
          </Input>
        )}

        <div className="user-panel__actions">
          <Button
            type="submit"
            variant="primary"
            busy={busy}
            busyLabel="Saving…"
            data-testid="save-user-btn"
          >
            {mode === "create" ? "Create User" : "Save User"}
          </Button>
          <Button variant="secondary" data-testid="cancel-btn" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>

      {mode === "edit" && editing && (
        <div className="user-panel__reset">
          <div className="user-panel__reset-head">
            <h3 className="user-panel__reset-title">Set New Initial Password</h3>
            {!showReset && (
              <Button
                variant="secondary"
                data-testid="reset-password-btn"
                onClick={() => setShowReset(true)}
              >
                Set New Initial Password
              </Button>
            )}
          </div>
          {showReset && (
            <form noValidate onSubmit={handleResetPassword}>
              <div className="user-panel__reset-fields">
                {resetSuccess && (
                  <Alert
                    variant="success"
                    role="status"
                    data-testid="reset-password-success"
                    className="user-panel__banner"
                  >
                    Initial password set. This user must change it at their next
                    sign-in.
                  </Alert>
                )}
                <Input
                  label="New Initial Password"
                  required
                  type="password"
                  value={resetPassword}
                  data-testid="user-reset-password"
                  error={resetErrors.newPassword}
                  errorTestId="error-reset-password"
                  hint="This user must change this password at their next sign-in."
                  disabled={resetBusy}
                  onChange={(event) => {
                    setResetPassword(event.target.value);
                    setResetErrors({});
                    setResetSuccess(false);
                  }}
                >
                  <PasswordStrengthList rules={resetRules} />
                </Input>
                <div className="user-panel__reset-actions">
                  <Button
                    type="submit"
                    variant="primary"
                    busy={resetBusy}
                    busyLabel="Setting…"
                    data-testid="save-reset-password-btn"
                  >
                    Set Password
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowReset(false);
                      setResetPassword("");
                      setResetSuccess(false);
                      setResetErrors({});
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </SidePanel>
  );
}