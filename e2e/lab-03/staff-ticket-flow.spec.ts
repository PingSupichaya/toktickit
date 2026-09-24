import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// IT Staff ticket workflow (docs/lab-03/tests.md)
//   E2E-04: queue search/filter → open detail → claim → set IT Priority →
//           status change → Public Comment → Internal Note
//           (AC-08/09/11/12/14, FR-14–20; screenshots staff-queue/ and
//           staff-ticket-detail/ per ui-spec §12)
//   E2E-05: visibility + resolution indicator (AC-04/13/15, BR-04)
//   E2E-06: responsive queue + detail (UI-13, §8 Responsive)
//   E2E-07: authorization from the browser (AC-23, AC-22)
// ---------------------------------------------------------------------------
// Data: two seeded tickets, reset by server/prisma/e2e-staff-flow-fixtures.ts
// (before + after). Every comment/note created here is prefixed "E2E-STAFF:"
// so the reset removes only this suite's rows and never seeded samples.
// Note on E2E-07: the app uses view-state navigation (no URL router), so a
// literal deep "Ticket URL" cannot exist. Coverage is: the requester UI shows
// only own tickets (confinement), and the same browser session's direct API
// calls prove 404 for another user's ticket and 403 for admin endpoints.
// ---------------------------------------------------------------------------

const SHOTS_QUEUE = path.join(
  process.cwd(),
  "artifacts",
  "lab-03",
  "screenshots",
  "staff-queue"
);
const SHOTS_DETAIL = path.join(
  process.cwd(),
  "artifacts",
  "lab-03",
  "screenshots",
  "staff-ticket-detail"
);
const SERVER_DIR = path.join(__dirname, "..", "..", "server");
const API = "http://localhost:3000";
const ORIGIN_5174 = "http://localhost:5174";

// Seeded ready-to-use demo accounts (seed.ts: DEMO_PASSWORD).
const STAFF = {
  email: "frank.ngu@mail.kmutt.ac.th",
  password: "Password123!",
  name: "Frank Nguyen",
};
const REQUESTER = {
  email: "alice.john@mail.kmutt.ac.th",
  password: "Password123!",
  name: "Alice Johnson",
};

// Seeded tickets used by the suite (see the reset fixture).
const CLAIM_TICKET = "TKT-000001"; // NEW, unassigned, submitted by Alice
const CLAIM_SEARCH = "campus email";
const FLOW_TICKET = "TKT-000009"; // NEW, owned by Omar, submitted by Alice
const FLOW_SEARCH = "Keyboard key";
const FLOW_SUMMARY = "Keyboard key not responding";
const OTHER_SUMMARY = "Laptop battery drains quickly"; // Bob's TKT-000002

const MARKER = "E2E-STAFF:";
const COMMENT_CLAIM = `${MARKER} Queue flow verified — email sign-in checked.`;
const NOTE_CLAIM = `${MARKER} Internal note on the email sign-in ticket.`;
const COMMENT_FLOW = `${MARKER} Staff update — investigating the keyboard issue.`;
const NOTE_FLOW = `${MARKER} Internal diagnosis — likely a driver fault.`;

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-staff-flow-fixtures.ts"],
    { cwd: SERVER_DIR, stdio: "inherit" }
  );
});

test.afterAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-staff-flow-fixtures.ts"],
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

async function shot(dir: string, page: Page, rel: string) {
  const target = path.join(dir, rel);
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
  await expect(page.locator(".app-header__user-name")).toHaveText(name);
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await gotoLogin(page);
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

// The queue table row opens the staff detail view for the given ticket.
async function openQueueTicket(page: Page, ticketNumber: string) {
  await page.locator(`tr[aria-label="Open ticket ${ticketNumber}"]`).click();
  await expect(page.locator('[data-testid="operational-panel"]')).toBeVisible();
}

// Requester "My Tickets" card link (same pattern as requester-regression).
async function openMyTicket(page: Page, summary: string) {
  const card = page.locator(".ticket-card").filter({ hasText: summary }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.locator(".ticket-card__link").click();
  await expect(
    page.locator('[data-testid="ticket-detail-number"]')
  ).toBeVisible({ timeout: 15000 });
}

async function expectNoOverflow(page: Page) {
  const ok = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(ok, "no horizontal overflow").toBe(true);
}

async function saveOperational(page: Page) {
  await page.locator('[data-testid="save-ticket-btn"]').click();
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({
    timeout: 20000,
  });
}

test("E2E-04 staff ticket workflow: queue → claim → priority → status → comment → note", async ({
  page,
}) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  await gotoLogin(page);
  await submitLogin(page, STAFF.email, STAFF.password);
  await expectShell(page, STAFF.name);
  await expect(page.locator('[data-testid="role-badge"]')).toHaveAttribute(
    "data-value",
    "IT_STAFF"
  );
  await expect(page.locator('[data-testid="queue-table"]')).toBeVisible();
  await shot(SHOTS_QUEUE, page, "desktop-queue.png");

  // Queue search (debounced) + single status filter combine.
  await page.locator('[data-testid="queue-search-input"]').fill(CLAIM_SEARCH);
  const claimRow = page.locator(
    `tr[aria-label="Open ticket ${CLAIM_TICKET}"]`
  );
  await expect(claimRow).toBeVisible({ timeout: 10000 });
  await pickFromSelect(page, "queue-filter-status", "NEW");
  await expect(claimRow).toBeVisible({ timeout: 10000 });
  await shot(SHOTS_QUEUE, page, "desktop-queue-filters.png");

  // No-results state with Clear Filters.
  await page
    .locator('[data-testid="queue-search-input"]')
    .fill("zzz-no-such-ticket-999");
  await expect(page.getByText("No Results")).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="queue-table"]')).toHaveCount(0);
  await shot(SHOTS_QUEUE, page, "desktop-queue-no-results.png");
  await page.locator('[data-testid="queue-clear-filters-btn"]').click();
  await expect(page.locator('[data-testid="queue-table"]')).toBeVisible();

  // Open the NEW, unassigned ticket.
  await page.locator('[data-testid="queue-search-input"]').fill(CLAIM_SEARCH);
  await expect(claimRow).toBeVisible({ timeout: 10000 });
  await openQueueTicket(page, CLAIM_TICKET);
  await expect(page.locator('[data-testid="owner-unassigned"]')).toBeVisible();
  await expect(page.locator('[data-testid="claim-btn"]')).toBeVisible();
  await shot(SHOTS_DETAIL, page, "desktop-detail-operational.png");

  // Claim assigns the caller immediately (no save step).
  await page.locator('[data-testid="claim-btn"]').click();
  await expect(page.locator('[data-testid="save-success"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator('[data-testid="claim-btn"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="owner-select"]')).toContainText(
    STAFF.name
  );

  // Set the IT Priority and save.
  await pickFromSelect(page, "it-priority-select", "LOW");
  await saveOperational(page);

  // Status select offers only permitted transitions (NEW → OPEN here).
  await pickFromSelect(page, "status-select", "OPEN");
  await saveOperational(page);
  await expect(page.locator('[data-testid="status-badge"]')).toHaveAttribute(
    "data-value",
    "OPEN"
  );

  // Post a Public Comment (comments tab is active by default).
  await page.locator('[data-testid="comment-textarea"]').fill(COMMENT_CLAIM);
  await page.locator('[data-testid="post-comment-btn"]').click();
  await expect(page.locator('[data-testid="public-comments"]')).toContainText(
    COMMENT_CLAIM,
    { timeout: 20000 }
  );
  await shot(SHOTS_DETAIL, page, "desktop-detail-tabs-comments.png");

  // Write an Internal Note (notes tab carries the internal-only hint).
  await page.getByRole("tab", { name: "Internal Notes" }).click();
  await expect(page.locator('[data-testid="notes-internal-hint"]')).toBeVisible();
  await page.locator('[data-testid="note-textarea"]').fill(NOTE_CLAIM);
  await page.locator('[data-testid="post-note-btn"]').click();
  const notes = page.locator('[data-testid="internal-notes"]');
  await expect(notes).toContainText(NOTE_CLAIM, { timeout: 20000 });
  await expect(notes).toContainText("Internal");
  await shot(SHOTS_DETAIL, page, "desktop-detail-tabs-notes.png");

  expect(errs).toEqual([]);
});

test("E2E-05 visibility and resolution indicator", async ({ page }) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // The requester sees Public Comments but never Internal Notes.
  await gotoLogin(page);
  await submitLogin(page, REQUESTER.email, REQUESTER.password);
  await expectShell(page, REQUESTER.name);
  await openMyTicket(page, FLOW_SUMMARY);
  await expect(page.locator('[data-testid="public-comments"]')).toBeVisible();
  await expect(page.locator('[data-testid="tab-notes"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="internal-notes"]')).toHaveCount(0);

  // "Problem Appears Resolved" records an automatic comment, status unchanged.
  await page.locator('[data-testid="indicate-resolved-btn"]').click();
  await expect(page.getByRole("dialog", { name: "Problem Appears Resolved" }))
    .toBeVisible();
  await page.locator('[data-testid="confirm-indicate-resolved-btn"]').click();
  await expect(page.locator('[data-testid="public-comments"]')).toContainText(
    "The Requester indicated the problem appears resolved.",
    { timeout: 20000 }
  );
  await expect(page.locator('[data-testid="status-badge"]')).toHaveAttribute(
    "data-value",
    "NEW"
  );
  await clearSession(page);

  // Staff adds a Public Comment + Internal Note, then walks to RESOLVED.
  await submitLogin(page, STAFF.email, STAFF.password);
  await expectShell(page, STAFF.name);
  await page.locator('[data-testid="queue-search-input"]').fill(FLOW_SEARCH);
  await expect(
    page.locator(`tr[aria-label="Open ticket ${FLOW_TICKET}"]`)
  ).toBeVisible({ timeout: 10000 });
  await openQueueTicket(page, FLOW_TICKET);
  await page.locator('[data-testid="comment-textarea"]').fill(COMMENT_FLOW);
  await page.locator('[data-testid="post-comment-btn"]').click();
  await expect(page.locator('[data-testid="public-comments"]')).toContainText(
    COMMENT_FLOW,
    { timeout: 20000 }
  );
  await page.getByRole("tab", { name: "Internal Notes" }).click();
  await page.locator('[data-testid="note-textarea"]').fill(NOTE_FLOW);
  await page.locator('[data-testid="post-note-btn"]').click();
  await expect(page.locator('[data-testid="internal-notes"]')).toContainText(
    NOTE_FLOW,
    { timeout: 20000 }
  );
  for (const next of ["OPEN", "IN_PROGRESS", "RESOLVED"]) {
    await pickFromSelect(page, "status-select", next);
    await saveOperational(page);
    await expect(page.locator('[data-testid="status-badge"]')).toHaveAttribute(
      "data-value",
      next
    );
  }
  await page.locator('[data-testid="logout-btn"]').first().click();
  await expect(page.locator('[data-testid="login-email"]')).toBeVisible();

  // The requester sees the staff comment but never the internal note.
  await submitLogin(page, REQUESTER.email, REQUESTER.password);
  await expectShell(page, REQUESTER.name);
  await openMyTicket(page, FLOW_SUMMARY);
  await expect(page.locator('[data-testid="public-comments"]')).toContainText(
    COMMENT_FLOW
  );
  await expect(page.getByText(NOTE_FLOW)).toHaveCount(0);
  await expect(page.locator('[data-testid="internal-notes"]')).toHaveCount(0);
  await clearSession(page);

  // Staff formally closes the ticket.
  await submitLogin(page, STAFF.email, STAFF.password);
  await expectShell(page, STAFF.name);
  await page.locator('[data-testid="queue-search-input"]').fill(FLOW_SEARCH);
  await expect(
    page.locator(`tr[aria-label="Open ticket ${FLOW_TICKET}"]`)
  ).toBeVisible({ timeout: 10000 });
  await openQueueTicket(page, FLOW_TICKET);
  await pickFromSelect(page, "status-select", "CLOSED");
  await saveOperational(page);
  await expect(page.locator('[data-testid="status-badge"]')).toHaveAttribute(
    "data-value",
    "CLOSED"
  );

  expect(errs).toEqual([]);
});

test("E2E-06 responsive queue and detail", async ({ page }) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  await gotoLogin(page);
  await submitLogin(page, STAFF.email, STAFF.password);
  await expectShell(page, STAFF.name);
  await expect(page.locator('[data-testid="queue-table"]')).toBeVisible();

  // Tablet: cards replace the table.
  await page.setViewportSize({ width: 800, height: 1000 });
  await expect(page.locator(".queue-card").first()).toBeVisible();
  await expect(page.locator('[data-testid="queue-table"]')).toBeHidden();
  await shot(SHOTS_QUEUE, page, "tablet-queue.png");

  // Mobile 375px: cards, no horizontal scroll.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(".queue-card").first()).toBeVisible();
  await expectNoOverflow(page);
  await shot(SHOTS_QUEUE, page, "mobile-queue.png");

  // Mobile detail: tabs stack, no horizontal scroll.
  await page.locator('[data-testid="queue-search-input"]').fill(CLAIM_SEARCH);
  const claimCard = page.locator(
    `button[aria-label="Open ticket ${CLAIM_TICKET}"]`
  );
  await expect(claimCard).toBeVisible({ timeout: 10000 });
  await claimCard.click();
  await expect(page.locator('[data-testid="operational-panel"]')).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Ticket sections" })
  ).toBeVisible();
  await expectNoOverflow(page);
  await shot(SHOTS_DETAIL, page, "mobile-detail.png");

  expect(errs).toEqual([]);
});

test("E2E-07 authorization from the browser", async ({ page }) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Staff can see another requester's ticket through the queue API…
  await gotoLogin(page);
  await submitLogin(page, STAFF.email, STAFF.password);
  await expectShell(page, STAFF.name);
  const found = await page.request.get(
    `${API}/api/tickets/queue?search=${encodeURIComponent(OTHER_SUMMARY)}`
  );
  expect(found.status()).toBe(200);
  const body = (await found.json()) as {
    data: Array<{ id: number; ticketNumber: string }>;
  };
  expect(body.data.length).toBeGreaterThan(0);
  const otherId = body.data[0].id;
  await clearSession(page);

  // …but the requester UI confines her to her own tickets.
  await submitLogin(page, REQUESTER.email, REQUESTER.password);
  await expectShell(page, REQUESTER.name);
  const ownCard = page
    .locator(".ticket-card")
    .filter({ hasText: "Cannot sign in to campus email" })
    .first();
  await expect(ownCard).toBeVisible({ timeout: 15000 });
  await expect(
    page.locator(".ticket-card").filter({ hasText: OTHER_SUMMARY })
  ).toHaveCount(0);
  const nav = page.locator(".app-header__nav");
  await expect(nav.getByText("Ticket Queue")).toHaveCount(0);
  await expect(nav.getByText("User Management")).toHaveCount(0);
  await shot(SHOTS_DETAIL, page, "forbidden-or-notfound.png");

  // …and the same session gets 404 for the other ticket, 403 for users.
  const cross = await page.request.get(`${API}/api/tickets/${otherId}`);
  expect(cross.status()).toBe(404);
  expect(((await cross.json()) as { error: { code: string } }).error.code).toBe(
    "TICKET_NOT_FOUND"
  );
  const crossComment = await page.request.post(
    `${API}/api/tickets/${otherId}/comments`,
    {
      headers: { Origin: ORIGIN_5174 },
      data: { content: `${MARKER} this must never be saved` },
    }
  );
  expect(crossComment.status()).toBe(404);
  const users = await page.request.get(`${API}/api/users`);
  expect(users.status()).toBe(403);

  expect(errs).toEqual([]);
});