import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Actions Taken UI flow (docs/lab-04/tests.md)
//   E2E-01 staff adds + edits an Action Taken, list in actionAt order
//          (AC-01, AC-05, AC-13 / FR-01–05)
//   E2E-05 Requester sees the read-only list with zero write controls in the
//          DOM (AC-08, AC-09)
// Screenshots: artifacts/lab-04/screenshots/actions-taken/ per ui-spec §12.
// ---------------------------------------------------------------------------
// Data: seeded TKT-000005 (RESOLVED legacy, zero actions, submitted by
// Alice) — reset by server/prisma/e2e-actions-fixtures.ts (before + after).
// Every action created here uses an "E2E-ACT:"-prefixed description so the
// reset removes only this suite's rows. Staff acts as a non-owner (Frank on
// Hannah's ticket, BR-02).
// ---------------------------------------------------------------------------

const SHOTS = path.join(
  process.cwd(),
  "artifacts",
  "lab-04",
  "screenshots",
  "actions-taken"
);
const SERVER_DIR = path.join(__dirname, "..", "..", "server");

const STAFF = { email: "frank.ngu@mail.kmutt.ac.th", password: "Password123!" };
const REQUESTER = {
  email: "alice.john@mail.kmutt.ac.th",
  password: "Password123!",
};
const TICKET_SEARCH = "re-install";
const TICKET_NUMBER = "TKT-000005";

const MARKER = "E2E-ACT:";
const DESC_ONE = `${MARKER} VPN profile re-registered and tested.`;
const DESC_TWO = `${MARKER} Earlier backdated check of the VPN profile.`;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-actions-fixtures.ts"],
    { cwd: SERVER_DIR, stdio: "inherit" }
  );
});

test.afterAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-actions-fixtures.ts"],
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

async function login(page: Page, email: string, password: string) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="login-email"]').fill(email);
  await page.locator('[data-testid="login-password"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await expect(page.locator('[data-testid="logout-btn"]').first()).toBeVisible();
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
}

// Lab 4: successful logins land on /dashboard for every role — step through
// the header nav before touching view-specific controls.
async function gotoQueue(page: Page) {
  await page.locator(".app-header__nav .app-header__nav-link").filter({ hasText: "Ticket Queue" }).click();
  await expect(page.locator('[data-testid="queue-table"]')).toBeVisible();
}

async function gotoMyTickets(page: Page) {
  await page.locator(".app-header__nav .app-header__nav-link").filter({ hasText: "My Tickets" }).click();
}

async function openStaffTicket(page: Page) {
  await gotoQueue(page);
  await page.locator('[data-testid="queue-search-input"]').fill(TICKET_SEARCH);
  const row = page.locator(`tr[aria-label="Open ticket ${TICKET_NUMBER}"]`);
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.click();
  await expect(page.locator('[data-testid="operational-panel"]')).toBeVisible();
  await page.locator('[data-testid="tab-actions"]').click();
  await expect(page.locator('[data-testid="actions-taken-panel"]')).toBeVisible();
}

async function fillActionForm(
  page: Page,
  opts: { at: string; desc: string; result: string; followUpNote?: string }
) {
  await page.locator('[data-testid="action-datetime-input"]').fill(opts.at);
  await page.locator('[data-testid="action-description-input"]').fill(opts.desc);
  await page.locator('[data-testid="action-result-input"]').fill(opts.result);
  if (opts.followUpNote !== undefined) {
    await page.locator('[data-testid="action-followup-toggle"]').click();
    await page.locator('[data-testid="action-followup-note-input"]').fill(opts.followUpNote);
  }
}

test("E2E-01 staff adds + edits Actions Taken, list in actionAt order", async ({
  page,
}) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, STAFF.email, STAFF.password);
  await openStaffTicket(page);

  // Empty state with the Add button (zero actions on a legacy ticket).
  await expect(page.locator('[data-testid="actions-taken-empty"]')).toBeVisible();

  // Create form with the follow-up section engaged.
  await page.locator('[data-testid="add-action-btn"]').click();
  await expect(page.locator('[data-testid="save-action-btn"]')).toBeVisible();
  await shot(page, "desktop-create-form.png");
  await fillActionForm(page, {
    at: "2026-09-20T09:15",
    desc: DESC_ONE,
    result: "Connection verified from the lab network.",
    followUpNote: "Confirm with the user after the weekend.",
  });
  await shot(page, "desktop-followup-required.png");
  await page.locator('[data-testid="save-action-btn"]').click();
  await expect(page.locator('[data-testid="actions-taken-list"]')).toBeVisible();
  await expect(page.getByText(DESC_ONE)).toBeVisible();

  // Future dates are blocked client-side with an inline error.
  await page.locator('[data-testid="add-action-btn"]').click();
  await expect(page.locator('[data-testid="save-action-btn"]')).toBeVisible();
  await fillActionForm(page, {
    at: "2099-01-01T00:00",
    desc: `${MARKER} future attempt`,
    result: "Should never be saved.",
  });
  await page.locator('[data-testid="save-action-btn"]').click();
  await expect(page.locator('[data-testid="action-datetime-error"]')).toHaveText(
    "Date cannot be in the future"
  );
  await page.locator('[data-testid="cancel-action-btn"]').click();

  // A backdated second action sorts before the first (actionAt order).
  await page.locator('[data-testid="add-action-btn"]').click();
  await expect(page.locator('[data-testid="save-action-btn"]')).toBeVisible();
  await fillActionForm(page, {
    at: "2026-09-18T14:00",
    desc: DESC_TWO,
    result: "Profile was already valid; no change needed.",
  });
  await page.locator('[data-testid="save-action-btn"]').click();
  const rows = page.locator('[data-testid="actions-taken-list"] > li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText(DESC_TWO);
  await shot(page, "desktop-list.png");

  // Edit the first action's result in place.
  await rows
    .first()
    .locator('[data-testid="edit-action-btn"]')
    .click();
  await expect(page.locator('[data-testid="save-action-btn"]')).toBeVisible();
  await expect(page.locator('[data-testid="action-performer-static"]')).toBeVisible();
  await page
    .locator('[data-testid="action-result-input"]')
    .fill("Profile already valid; confirmed with a test login.");
  await page.locator('[data-testid="save-action-btn"]').click();
  await expect(page.getByText("confirmed with a test login.")).toBeVisible();

  // Mobile rendering without horizontal overflow.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-testid="actions-taken-list"]')).toBeVisible();
  const ok = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(ok, "no horizontal overflow").toBe(true);
  await shot(page, "mobile-list.png");

  expect(errs, `console/page errors: ${errs.join("; ")}`).toEqual([]);
});

test("E2E-05 Requester sees Actions Taken read-only, zero write controls", async ({
  page,
}) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, REQUESTER.email, REQUESTER.password);
  await gotoMyTickets(page);

  const card = page.locator(".ticket-card").filter({ hasText: "VPN profile" }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.locator(".ticket-card__link").click();
  await expect(page.locator('[data-testid="ticket-detail-number"]')).toBeVisible({
    timeout: 15000,
  });

  const readonly = page.locator('[data-testid="actions-taken-readonly"]');
  await expect(readonly).toBeVisible();
  // Seeded + E2E actions are visible read-only…
  await expect(readonly.getByText(DESC_ONE)).toBeVisible();
  // …but no write control exists anywhere in the DOM (not merely disabled).
  await expect(page.locator('[data-testid="add-action-btn"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="edit-action-btn"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="save-action-btn"]')).toHaveCount(0);
  await shot(page, "requester-readonly-view.png");

  expect(errs, `console/page errors: ${errs.join("; ")}`).toEqual([]);
  await clearSession(page);
});
