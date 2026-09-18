import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Authentication workflow (docs/lab-03/tests.md)
//   E2E-01 valid/invalid login, logout, screenshots
//   E2E-02 first-login change-password gate
//   E2E-03 inactive account handling
//   E2E-08 role-based navigation (Requester + IT_STAFF)
// ---------------------------------------------------------------------------

const SHOTS = path.join(process.cwd(), "artifacts", "lab-03", "screenshots", "authentication");
const SERVER_DIR = path.join(__dirname, "..", "..", "server");

// Dedicated fixture accounts seeded by server/prisma/e2e-auth-fixtures.ts.
const ACTIVE_REQUESTER = {
  email: "e2e.auth.pass@mail.kmutt.ac.th",
  password: "E2ePassw0rd!",
  name: "E2E Auth Pass",
};
const FIRST_LOGIN = {
  email: "e2e.auth.bob@mail.kmutt.ac.th",
  password: "ChangeMe123!",
  newPassword: "NewE2ePassword1!",
  name: "E2E Auth Bob",
};
const INACTIVE = {
  email: "eve.turn@mail.kmutt.ac.th",
  password: "ChangeMe123!",
};
const IT_STAFF = {
  email: "e2e.auth.grace@mail.kmutt.ac.th",
  password: "E2ePassw0rd!",
  name: "E2E Auth Grace",
};
const INVALID_EMAIL = "does-not-exist-e2e@mail.kmutt.ac.th";

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync(process.execPath, ["--import", "tsx", "prisma/e2e-auth-fixtures.ts"], {
    cwd: SERVER_DIR,
    stdio: "inherit",
  });
});

function watch(page: Page): string[] {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) {
      errs.push(`console: ${m.text()}`);
    }
  });
  return errs;
}

async function shot(page: Page, rel: string) {
  const target = path.join(SHOTS, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: false });
}

async function setViewport(page: Page, key: keyof typeof VIEWPORTS) {
  await page.setViewportSize(VIEWPORTS[key]);
}

async function gotoLogin(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
}

async function submitLogin(page: Page, email: string, password: string) {
  await page.locator('[data-testid="login-email"]').fill(email);
  await page.locator('[data-testid="login-password"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
}

async function expectShell(page: Page, name: string) {
  await expect(page.locator('[data-testid="logout-btn"]')).toBeVisible();
  await expect(page.getByText(`Logged in as:`)).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
}

test("E2E-01 authentication workflow: valid login, safe error, logout, screenshots", async ({
  page,
}) => {
  const errs = watch(page);
  await setViewport(page, "desktop");
  await gotoLogin(page);

  await shot(page, "login-desktop.png");
  await expect(page.locator('[data-testid="login-submit-btn"]')).toBeDisabled();
  await expect(page.getByRole("heading", { name: "TokTickIT" })).toBeVisible();

  // Validation state on blur.
  await page.locator('[data-testid="login-email"]').click();
  await page.locator('[data-testid="login-email"]').fill("not-an-email");
  await page.locator('[data-testid="login-email"]').blur();
  await expect(page.locator('[data-testid="error-email"]')).toContainText(
    "Enter a valid email address"
  );
  await shot(page, "login-validation.png");

  // Invalid credentials -> safe generic banner (never leaks account details).
  await submitLogin(page, INVALID_EMAIL, "wrong-password");
  await expect(page.locator('[data-testid="login-error"]')).toContainText(
    "Invalid email or password"
  );
  await shot(page, "login-error.png");
  await expect(page.locator('[data-testid="logout-btn"]')).toHaveCount(0);

  // Valid login -> shell with name and role badge.
  await submitLogin(page, ACTIVE_REQUESTER.email, ACTIVE_REQUESTER.password);
  await expectShell(page, ACTIVE_REQUESTER.name);
  await expect(page.locator('[data-testid="role-badge"]')).toHaveAttribute(
    "data-value",
    "REQUESTER"
  );
  await shot(page, "shell-desktop.png");

  // Logout returns to the Login screen.
  await page.locator('[data-testid="logout-btn"]').click();
  await expect(page.locator('[data-testid="login-email"]')).toBeVisible();

  expect(errs).toEqual([]);
});

test("E2E-02 first-login password change gates the app", async ({ page }) => {
  const errs = watch(page);
  await setViewport(page, "desktop");
  await gotoLogin(page);

  await submitLogin(page, FIRST_LOGIN.email, FIRST_LOGIN.password);
  await expect(page.locator('[data-testid="current-password"]')).toBeVisible();
  await expect(page.locator('[data-testid="logout-btn"]')).toHaveCount(0);
  await expect(page.getByText("Change Your Password")).toBeVisible();

  // Rule violations keep the submit disabled.
  await page.locator('[data-testid="current-password"]').fill(FIRST_LOGIN.password);
  await page.locator('[data-testid="new-password"]').fill("short");
  await expect(page.locator('[data-testid="password-rule-1"]')).not.toHaveClass(/is-met/);
  await shot(page, "change-password-desktop.png");
  await expect(page.locator('[data-testid="change-password-btn"]')).toBeDisabled();

  // Mobile capture of the same screen.
  await setViewport(page, "mobile");
  await shot(page, "change-password-mobile.png");
  await setViewport(page, "desktop");

  // A valid new password + matching confirmation opens the shell.
  await page.locator('[data-testid="new-password"]').fill(FIRST_LOGIN.newPassword);
  await page.locator('[data-testid="confirm-password"]').fill(FIRST_LOGIN.newPassword);
  await expect(page.locator('[data-testid="password-rule-1"]')).toHaveClass(/is-met/);
  await page.locator('[data-testid="change-password-btn"]').click();

  await expectShell(page, FIRST_LOGIN.name);

  // The session survives a reload (silent restore via /api/auth/me).
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectShell(page, FIRST_LOGIN.name);
  await shot(page, "shell-after-change.png");

  expect(errs).toEqual([]);
});

test("E2E-03 inactive account shows the safe banner and nothing else", async ({ page }) => {
  const errs = watch(page);
  await setViewport(page, "desktop");
  await gotoLogin(page);

  await submitLogin(page, INACTIVE.email, INACTIVE.password);
  await expect(page.locator('[data-testid="login-error"]')).toContainText(
    "Your account is not active. Contact your administrator."
  );
  await shot(page, "login-inactive.png");
  await expect(page.locator('[data-testid="logout-btn"]')).toHaveCount(0);

  // Reload keeps the user on the Login screen (no session leaked).
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="login-email"]')).toBeVisible();

  expect(errs).toEqual([]);
});

test("E2E-08 role-based navigation hides unauthorized destinations", async ({ page }) => {
  const errs = watch(page);
  await setViewport(page, "desktop");

  // Requester: only My Tickets + Create Ticket; never Queue/User Management.
  await gotoLogin(page);
  await submitLogin(page, ACTIVE_REQUESTER.email, ACTIVE_REQUESTER.password);
  await expectShell(page, ACTIVE_REQUESTER.name);

  const requesterNav = page.locator(".app-header__nav");
  await expect(requesterNav.getByText("My Tickets")).toBeVisible();
  await expect(requesterNav.getByText("Create Ticket")).toBeVisible();
  await expect(requesterNav.getByText("Ticket Queue")).toHaveCount(0);
  await expect(requesterNav.getByText("User Management")).toHaveCount(0);

  // Logout, then sign in as IT Staff: only Ticket Queue, never user management.
  await page.locator('[data-testid="logout-btn"]').click();
  await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
  await submitLogin(page, IT_STAFF.email, IT_STAFF.password);
  await expectShell(page, IT_STAFF.name);
  await expect(page.locator('[data-testid="role-badge"]')).toHaveAttribute("data-value", "IT_STAFF");

  const staffNav = page.locator(".app-header__nav");
  await expect(staffNav.getByText("Ticket Queue")).toBeVisible();
  await expect(staffNav.getByText("My Tickets")).toHaveCount(0);
  await expect(staffNav.getByText("Create Ticket")).toHaveCount(0);
  await expect(staffNav.getByText("User Management")).toHaveCount(0);
  await shot(page, "shell-it-staff.png");

  expect(errs).toEqual([]);
});