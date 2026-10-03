import { test, expect, type Browser, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Ticket workflow end-to-end (docs/lab-04/tests.md)
//   E2E-02 resolution gate: blocked with no actions (hint visible) → qualify
//          with an Action Taken → resolve succeeds (AC-03, AC-04, AC-05)
//   E2E-03 concurrent edit: two sessions, second submit shows the conflict
//          banner and overwrites nothing (AC-07)
// Screenshots: artifacts/lab-04/screenshots/actions-taken/ per ui-spec §12.
// ---------------------------------------------------------------------------
// Data: seeded TKT-000010 (OPEN, unassigned) for E2E-02 and TKT-000016
// (IN_PROGRESS) for E2E-03 — reset by
// server/prisma/e2e-workflow-fixtures.ts (before + after). Actions created
// here use "E2E-WF:"-prefixed descriptions. Staff acts as a non-owner (BR-02).
// Note: after adding the qualifying action the detail view is reopened so it
// reloads the refreshed `canResolve` flag, exactly as a user would.
// ---------------------------------------------------------------------------

const SHOTS = path.join(
  process.cwd(),
  "artifacts",
  "lab-04",
  "screenshots",
  "actions-taken"
);
const SERVER_DIR = path.join(__dirname, "..", "..", "server");
const API = "http://localhost:3000";
const ORIGIN = "http://localhost:5174";

const STAFF = { email: "frank.ngu@mail.kmutt.ac.th", password: "Password123!" };
const GATE_TICKET_SEARCH = "Guests cannot";
const GATE_TICKET_NUMBER = "TKT-000010";
const CONFLICT_TICKET_SEARCH = "Export button";
const CONFLICT_TICKET_NUMBER = "TKT-000016";

const MARKER = "E2E-WF:";
const QUALIFYING_DESC = `${MARKER} Guest portal certificate renewed and tested.`;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-workflow-fixtures.ts"],
    { cwd: SERVER_DIR, stdio: "inherit" }
  );
});

test.afterAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-workflow-fixtures.ts"],
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

async function openQueueTicket(page: Page, search: string, ticketNumber: string) {
  await page.locator('[data-testid="queue-search-input"]').fill(search);
  const row = page.locator(`tr[aria-label="Open ticket ${ticketNumber}"]`);
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.click();
  await expect(page.locator('[data-testid="operational-panel"]')).toBeVisible();
}

async function backToQueue(page: Page) {
  await page.locator('[data-testid="cancel-btn"]').click();
  await expect(page.locator('[data-testid="queue-table"]')).toBeVisible();
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

test("E2E-02 resolution gate blocks, then resolves once qualified", async ({
  page,
}) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, STAFF.email, STAFF.password);
  await openQueueTicket(page, GATE_TICKET_SEARCH, GATE_TICKET_NUMBER);

  // Blocked: RESOLVED is listed (matrix-legal from OPEN) but disabled with
  // the inline reason while no Action Taken exists.
  await expect(page.locator('[data-testid="resolution-gate-hint"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="resolution-gate-hint"]')
  ).toContainText("before resolving");
  await page.locator('[data-testid="status-select"]').first().click();
  const resolvedOption = page
    .locator(".select-control__item")
    .filter({ hasText: "RESOLVED" })
    .first();
  await expect(resolvedOption).toBeDisabled();
  await shot(page, "desktop-resolution-blocked.png");
  await page.keyboard.press("Escape");

  // Qualify the ticket with an Action Taken via the API (same session
  // cookies). Form-level creation is covered by E2E-01 on the UI track; this
  // spec owns the gate behavior, not the form.
  const queueRes = await page.request.get(`${API}/api/tickets/queue`, {
    params: { search: GATE_TICKET_SEARCH },
  });
  const queueBody = await queueRes.json();
  const gateTicket = queueBody.data.find(
    (t: { ticketNumber: string }) => t.ticketNumber === GATE_TICKET_NUMBER
  );
  const actionRes = await page.request.post(
    `${API}/api/tickets/${gateTicket.id}/actions`,
    {
      headers: { Origin: ORIGIN },
      data: {
        actionAt: "2026-09-20T09:15:00.000Z",
        description: QUALIFYING_DESC,
        result: "Portal loads without warnings on retest.",
        followUpRequired: false,
      },
    }
  );
  expect(actionRes.status()).toBe(201);

  // Reopen so the detail reloads the refreshed gate flag, then resolve.
  await backToQueue(page);
  await openQueueTicket(page, GATE_TICKET_SEARCH, GATE_TICKET_NUMBER);
  await expect(page.locator('[data-testid="resolution-gate-hint"]')).toHaveCount(0);
  await pickFromSelect(page, "status-select", "RESOLVED");
  await page.locator('[data-testid="save-ticket-btn"]').click();
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('[data-testid="status-badge"]')).toHaveAttribute(
    "data-value",
    "RESOLVED"
  );

  expect(errs, `console/page errors: ${errs.join("; ")}`).toEqual([]);
});

test("E2E-03 concurrent edit shows the conflict banner, no overwrite", async ({
  page,
  browser,
}: {
  page: Page;
  browser: Browser;
}) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page, STAFF.email, STAFF.password);
  await openQueueTicket(page, CONFLICT_TICKET_SEARCH, CONFLICT_TICKET_NUMBER);

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  const errs2 = watch(page2);
  await page2.setViewportSize({ width: 1280, height: 800 });
  await login(page2, STAFF.email, STAFF.password);
  await openQueueTicket(page2, CONFLICT_TICKET_SEARCH, CONFLICT_TICKET_NUMBER);

  // First session saves cleanly (version V → V+1).
  await pickFromSelect(page, "it-priority-select", "HIGH");
  await page.locator('[data-testid="save-ticket-btn"]').click();
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({
    timeout: 20000,
  });

  // Second session still holds version V: stale write → conflict banner, and
  // the controls refresh to the server's current values (HIGH kept, MEDIUM
  // never overwrote it).
  await pickFromSelect(page2, "it-priority-select", "MEDIUM");
  await page2.locator('[data-testid="save-ticket-btn"]').click();
  const banner = page2.locator('[data-testid="action-conflict-banner"]');
  await expect(banner).toBeVisible({ timeout: 20000 });
  await expect(banner).toContainText("updated by someone else");
  await expect(
    page2.locator('[data-testid="it-priority-select"]')
  ).toContainText("HIGH");
  await shot(page2, "desktop-stale-conflict.png");

  expect(errs, `console/page errors: ${errs.join("; ")}`).toEqual([]);
  expect(errs2, `console/page errors: ${errs2.join("; ")}`).toEqual([]);
  await ctx2.close();
});
