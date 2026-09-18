import { describe, it, expect } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordRuleState,
  passwordRuleViolations,
} from "../../src/passwordRules.js";

// UNIT-01 — BR-10: each password rule returns correct pass/fail.
describe("passwordRuleState", () => {
  it("passes on length, upper, lower, digit, special, and differs-from-current", () => {
    const state = passwordRuleState("NewSecurePass1!", "OldPass1!");
    expect(state).toEqual({
      minLength: true,
      maxLength: true,
      hasUppercase: true,
      hasLowercase: true,
      hasDigit: true,
      hasSpecial: true,
      differsFromCurrent: true,
    });
  });

  it("flags a password shorter than the minimum length", () => {
    const state = passwordRuleState("Short1!", "OldPass1!");
    expect(state.minLength).toBe(false);
    expect(passwordRuleViolations("Short1!", "OldPass1!")).toContain(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`
    );
  });

  it("flags a password longer than the maximum length", () => {
    const long = "A".repeat(65) + "b1!";
    expect(passwordRuleState(long, "OldPass1!").maxLength).toBe(false);
    expect(passwordRuleViolations(long, "OldPass1!")).toContain(
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters long`
    );
  });

  it("flags missing uppercase letters", () => {
    expect(passwordRuleState("lowercase1!", "OldPass1!").hasUppercase).toBe(false);
    expect(passwordRuleViolations("lowercase1!", "OldPass1!")).toContain(
      "Password must contain at least one uppercase letter"
    );
  });

  it("flags missing lowercase letters", () => {
    expect(passwordRuleState("UPPERCASE1!", "OldPass1!").hasLowercase).toBe(false);
    expect(passwordRuleViolations("UPPERCASE1!", "OldPass1!")).toContain(
      "Password must contain at least one lowercase letter"
    );
  });

  it("flags missing digits", () => {
    expect(passwordRuleState("NoDigitsHere!", "OldPass1!").hasDigit).toBe(false);
    expect(passwordRuleViolations("NoDigitsHere!", "OldPass1!")).toContain(
      "Password must contain at least one digit"
    );
  });

  it("flags missing special characters", () => {
    expect(passwordRuleState("NoSpecial1", "OldPass1!").hasSpecial).toBe(false);
    expect(passwordRuleViolations("NoSpecial1", "OldPass1!")).toContain(
      "Password must contain at least one special character"
    );
  });

  it("flags a new password equal to the current password", () => {
    expect(passwordRuleState("SamePass1!", "SamePass1!").differsFromCurrent).toBe(false);
    expect(passwordRuleViolations("SamePass1!", "SamePass1!")).toContain(
      "New password must be different from the current password"
    );
  });

  it("treats differs-from-current as satisfied when no current password is supplied", () => {
    expect(passwordRuleState("Anything1!").differsFromCurrent).toBe(true);
  });

  it("exposes all violations at once", () => {
    const violations = passwordRuleViolations("short", "short");
    expect(violations).toEqual([
      "Password must be at least 8 characters long",
      "Password must contain at least one uppercase letter",
      "Password must contain at least one digit",
      "Password must contain at least one special character",
      "New password must be different from the current password",
    ]);
  });
});