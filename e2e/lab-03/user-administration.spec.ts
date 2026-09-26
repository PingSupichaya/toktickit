import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Administrator User Management (docs/lab-03/tests.md)
//   E2E-09: create with initial password → first login forces change; edit
//           name/email/role; deactivate (inactive login fails); own-account
//           Active toggle disabled; reset initial password → next login forces
//           change (AC-16 / AC-18 / AC-19 / FR-22..25)
//   E2E-10: search + single role filter; create/edit panel screenshots; mobile
//           card layout (FR-21 / FR-24)
// ---------------------------------------------------------------------------

const SHOTS = path.join(
  process.cwd(),
  "artifacts",
  "lab-03",
  "screenshots",
  "user-management"
);
const SERVER_DIR = path.join(__dirname, "..", "..", "server");

// Seeded ready-to-use demo Administrator (seed.ts: DEMO_PASSWORD). We drive the
// suite with this existing account rather than adding a third active ADMIN
// fixture, so the API-40 last-active-Administrator probe sees exactly the
// seeded baseline it already expects.
const ADMIN = {
  email: "omar.far@mail.kmutt.ac.th",
  password: "Password123!",
  name: "Omar Farouk",
};

// Stable working account for the suite; reset by server/prisma/e2e-usermgmt-fixtures.ts.
const TARGET = {
  name: "E2E Usermgmt Created",
  editedName: "E2E Usermgmt Edited",
  email: "e2e.um.created@mail.kmutt.ac.th",
  editedEmail: "e2e.um.edited@mail.kmutt.ac.th",
  initial: "E2eInitial1!",
  reset: "E2eReset123!",
};

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-usermgmt-fixtures.ts"],
    { cwd: SERVER_DIR, stdio: "inherit" }
  );
});

test.afterAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-usermgmt-fixtures.ts"],
    { cwd: SERVER_DIR, stdio: "inherit" }
  );
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
  await expect(page.locator('[data-testid="logout-btn"]').first()).toBeVisible();
  await expect(page.locator(".app-header__user-label")).toHaveText(
    "Logged in as:"
  );
  await expect(page.locator(".app-header__user-name")).toHaveText(name);
}

// Returns to the Login screen regardless of the current session state.
async function clearSession(page: Page) {
  await page.context().clearCookies();
  await gotoLogin(page);
}

async function openUserManagement(page: Page) {
  await page
    .locator(".app-header__nav .app-header__nav-link")
    .filter({ hasText: "User Management" })
    .click();
  await expect(page.locator('[data-testid="user-search-input"]')).toBeVisible();
  await expect(page.locator('[data-testid="users-table"]')).toBeVisible();
}

function userRow(page: Page, email: string) {
  return page.getByRole("row").filter({ hasText: email });
}

async function openEdit(page: Page, email: string) {
  await userRow(page, email)
    .locator('[data-testid="edit-user-btn"]')
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Edit User" })).toBeVisible();
}

async function pickFromSelect(page: Page, testId: string, label: string) {
  await page.locator(`[data-testid="${testId}"]`).first().click();
  const option = page
    .locator(".select-control__item")
    .filter({ hasText: label })
    .first();
  await expect(option).toBeVisible();
  await option.click();
}

async function expectChangePasswordGate(page: Page) {
  await expect(page.locator('[data-testid="current-password"]')).toBeVisible();
  await expect(page.getByText("Change Your Password")).toBeVisible();
  await expect(page.locator('[data-testid="logout-btn"]')).toHaveCount(0);
}

test("E2E-09 full user-administration workflow", async ({ page }) => {
  const errs = watch(page);
  await page.setViewportSize(VIEWPORTS.desktop);

  // --- Sign in as the seeded demo Administrator. ---------------------------
  await gotoLogin(page);
  await submitLogin(page, ADMIN.email, ADMIN.password);
  await expectShell(page, ADMIN.name);
  await expect(page.locator('[data-testid="role-badge"]')).toHaveAttribute(
    "data-value",
    "ADMIN"
  );
  await openUserManagement(page);

  // --- AC-18: own-account Active toggle is disabled with a hint. -----------
  await page.locator('[data-testid="user-search-input"]').fill(ADMIN.email);
  await expect(userRow(page, ADMIN.email)).toBeVisible();
  await openEdit(page, ADMIN.email);
  await expect(
    page.locator('[data-testid="user-active-toggle"]')
  ).toBeDisabled();
  await expect(
    page.getByText("You cannot deactivate your own account.")
  ).toBeVisible();
  await shot(page, "desktop-self-deactivation-disabled.png");
  await page.locator('[data-testid="side-panel-close"]').click();

  // --- AC-16: create a user with one role + initial password. --------------
  await page.locator('[data-testid="create-user-btn"]').click();
  await expect(page.getByRole("dialog", { name: "Create User" })).toBeVisible();
  await page.locator('[data-testid="user-name-input"]').fill(TARGET.name);
  await page.locator('[data-testid="user-email-input"]').fill(TARGET.email);
  await pickFromSelect(page, "user-role-select", "Requester");
  await page.locator('[data-testid="user-initial-password"]').fill(TARGET.initial);
  await page.locator('[data-testid="save-user-btn"]').click();
  const createdBanner = page.locator('[data-testid="users-success-banner"]');
  await expect(createdBanner).toBeVisible({ timeout: 20000 });
  await expect(createdBanner).toContainText(
    `User ${TARGET.name} was created.`
  );
  await shot(page, "created-success.png");

  // --- AC-19(a): first login with the initial password forces change. ------
  await page.locator('[data-testid="logout-btn"]').first().click();
  await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
  await submitLogin(page, TARGET.email, TARGET.initial);
  await expectChangePasswordGate(page);
  await shot(page, "first-login-gate.png");
  await clearSession(page);

  // --- AC-17: edit name / email / role as the Administrator. ---------------
  await submitLogin(page, ADMIN.email, ADMIN.password);
  await expectShell(page, ADMIN.name);
  await openUserManagement(page);
  await page.locator('[data-testid="user-search-input"]').fill(TARGET.email);
  await expect(userRow(page, TARGET.email)).toBeVisible();
  await openEdit(page, TARGET.email);
  await page.locator('[data-testid="user-name-input"]').fill(TARGET.editedName);
  await page.locator('[data-testid="user-email-input"]').fill(TARGET.editedEmail);
  await pickFromSelect(page, "user-role-select", "IT Staff");
  await page.locator('[data-testid="save-user-btn"]').click();
  await expect(
    page.locator('[data-testid="users-success-banner"]')
  ).toBeVisible({ timeout: 20000 });
  await page.locator('[data-testid="user-search-input"]').fill(TARGET.editedEmail);
  const editedRow = userRow(page, TARGET.editedEmail);
  await expect(editedRow).toBeVisible();
  await expect(editedRow).toContainText(TARGET.editedName);
  await expect(editedRow.locator('[data-testid="role-badge"]')).toHaveAttribute(
    "data-value",
    "IT_STAFF"
  );

  // --- AC-19(b): reset initial password -> next login forces change. -------
  await openEdit(page, TARGET.editedEmail);
  await page.locator('[data-testid="reset-password-btn"]').click();
  await page.locator('[data-testid="user-reset-password"]').fill(TARGET.reset);
  await page.locator('[data-testid="save-reset-password-btn"]').click();
  await expect(
    page.locator('[data-testid="reset-password-success"]')
  ).toBeVisible({ timeout: 20000 });
  await shot(page, "reset-initial-password.png");
  await page.locator('[data-testid="side-panel-close"]').click();

  await page.locator('[data-testid="logout-btn"]').first().click();
  await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
  await submitLogin(page, TARGET.editedEmail, TARGET.reset);
  await expectChangePasswordGate(page);
  await clearSession(page);

  // --- AC-18/FR-23: deactivate -> inactive login fails safely. --------------
  await submitLogin(page, ADMIN.email, ADMIN.password);
  await expectShell(page, ADMIN.name);
  await openUserManagement(page);
  await page.locator('[data-testid="user-search-input"]').fill(TARGET.editedEmail);
  await expect(userRow(page, TARGET.editedEmail)).toBeVisible();
  await openEdit(page, TARGET.editedEmail);
  await page.locator('[data-testid="user-active-toggle"]').click();
  await page.locator('[data-testid="save-user-btn"]').click();
  const deactivatedRow = userRow(page, TARGET.editedEmail);
  await expect(
    deactivatedRow.locator('[data-testid="user-status-badge"]')
  ).toHaveAttribute("data-value", "Inactive", { timeout: 20000 });

  await page.locator('[data-testid="logout-btn"]').first().click();
  await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
  await submitLogin(page, TARGET.editedEmail, TARGET.reset);
  await expect(page.locator('[data-testid="login-error"]')).toContainText(
    "Your account is not active. Contact your administrator.",
    { timeout: 10000 }
  );
  await shot(page, "inactive-login.png");
  await expect(page.locator('[data-testid="logout-btn"]')).toHaveCount(0);

  expect(errs).toEqual([]);
});

test("E2E-10 user list interactions and screenshots", async ({ page }) => {
  const errs = watch(page);
  await page.setViewportSize(VIEWPORTS.desktop);

  await gotoLogin(page);
  await submitLogin(page, ADMIN.email, ADMIN.password);
  await expectShell(page, ADMIN.name);
  await openUserManagement(page);
  await expect(userRow(page, ADMIN.email)).toBeVisible();
  await expect(userRow(page, "priya.nai@mail.kmutt.ac.th")).toBeVisible();
  await shot(page, "desktop-users-list.png");

  // Search by a name fragment (debounced).
  await page.locator('[data-testid="user-search-input"]').fill("priya");
  await expect(userRow(page, "priya.nai@mail.kmutt.ac.th")).toBeVisible();
  await expect(userRow(page, "alice.john@mail.kmutt.ac.th")).toHaveCount(0);
  await shot(page, "user-management-search.png");

  // Clear search, then filter by a single role.
  await page.locator('[data-testid="user-search-input"]').fill("");
  await pickFromSelect(page, "user-filter-role", "Administrator");
  await expect(userRow(page, ADMIN.email)).toBeVisible(
    { timeout: 10000 }
  );
  await expect(userRow(page, "priya.nai@mail.kmutt.ac.th")).toBeVisible();
  await expect(userRow(page, "alice.john@mail.kmutt.ac.th")).toHaveCount(0);
  await expect(userRow(page, "e2e.um.edited@mail.kmutt.ac.th")).toHaveCount(0);
  await shot(page, "user-management-filter-role.png");

  // Clear Filters restores the full list.
  await page.locator('[data-testid="user-clear-filters-btn"]').click();
  await expect(userRow(page, "alice.john@mail.kmutt.ac.th")).toBeVisible();

  // Create panel screenshot.
  await page.locator('[data-testid="create-user-btn"]').click();
  await expect(page.getByRole("dialog", { name: "Create User" })).toBeVisible();
  await shot(page, "desktop-create-user-panel.png");
  await page.locator('[data-testid="side-panel-close"]').click();

  // Edit panel screenshot.
  await openEdit(page, "priya.nai@mail.kmutt.ac.th");
  await shot(page, "desktop-edit-user-panel.png");
  await page.locator('[data-testid="side-panel-close"]').click();

  // Mobile: card list replaces the table.
  await page.setViewportSize(VIEWPORTS.mobile);
  await expect(page.locator('[data-testid="user-card"]')).toBeVisible();
  const cards = page.locator(".user-card");
  await expect(cards.first()).toBeVisible();
  await shot(page, "mobile-users.png");

  expect(errs).toEqual([]);
});