// Password strength rules (BR-10). Shared by the change-password endpoint, the
// user-management initial-password validation, and the client rule checklist.

export const BCRYPT_COST = 12; // BR-09: bcrypt, cost factor 12
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export interface PasswordRuleState {
  minLength: boolean;
  maxLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  differsFromCurrent: boolean;
}

// Per-rule boolean state (UNIT-01). When `currentPassword` is omitted the
// differs-from-current rule is treated as satisfied.
export function passwordRuleState(
  newPassword: string,
  currentPassword?: string
): PasswordRuleState {
  return {
    minLength: newPassword.length >= PASSWORD_MIN_LENGTH,
    maxLength: newPassword.length <= PASSWORD_MAX_LENGTH,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasDigit: /[0-9]/.test(newPassword),
    hasSpecial: /[^A-Za-z0-9]/.test(newPassword),
    differsFromCurrent:
      currentPassword === undefined || newPassword !== currentPassword,
  };
}

export function passwordRuleViolations(
  newPassword: string,
  currentPassword?: string
): string[] {
  const state = passwordRuleState(newPassword, currentPassword);
  const violations: string[] = [];
  if (!state.minLength) {
    violations.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }
  if (!state.maxLength) {
    violations.push(`Password must be at most ${PASSWORD_MAX_LENGTH} characters long`);
  }
  if (!state.hasUppercase) {
    violations.push("Password must contain at least one uppercase letter");
  }
  if (!state.hasLowercase) {
    violations.push("Password must contain at least one lowercase letter");
  }
  if (!state.hasDigit) {
    violations.push("Password must contain at least one digit");
  }
  if (!state.hasSpecial) {
    violations.push("Password must contain at least one special character");
  }
  if (!state.differsFromCurrent) {
    violations.push("New password must be different from the current password");
  }
  return violations;
}

export function isValidNewPassword(
  newPassword: string,
  currentPassword?: string
): boolean {
  return passwordRuleViolations(newPassword, currentPassword).length === 0;
}