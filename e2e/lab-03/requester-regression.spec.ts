import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Requester regression in-browser (docs/lab-03/tests.md)
//   E2E-11: Authenticated Requester creates a Ticket, uploads/removes an
//   attachment, posts a comment; behavior matches Lab 2 (selector gone).
// ---------------------------------------------------------------------------

const SHOTS = path.join(
  process.cwd(),
  "artifacts",
  "lab-03",
  "screenshots",
  "requester-regression"
);
const SERVER_DIR = path.join(__dirname, "..", "..", "server");
const WORK = path.join(process.cwd(), "test-results");
const PNG_PATH = path.join(WORK, "e2e-proof.png");

const REQUESTER = {
  email: "e2e.auth.pass@mail.kmutt.ac.th",
  password: "E2ePassw0rd!",
  name: "E2E Auth Pass",
};

const created = {
  summary: "",
  description:
    "Playwright regression proof: a real ticket with a valid 20+ character description created through the authenticated UI.",
};

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  // Dedicated fixture accounts seeded by server/prisma/e2e-auth-fixtures.ts.
  execFileSync(process.execPath, ["--import", "tsx", "prisma/e2e-auth-fixtures.ts"], {
    cwd: SERVER_DIR,
    stdio: "inherit",
  });
  if (!fs.existsSync(WORK)) fs.mkdirSync(WORK, { recursive: true });
  if (!fs.existsSync(PNG_PATH)) {
    fs.writeFileSync(
      PNG_PATH,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      )
    );
  }
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

async function pickCustom(page: Page, testId: string, label: string) {
  await page.locator(`[data-testid="${testId}"]`).first().click();
  const option = page.locator(".select-control__item").filter({ hasText: label }).first();
  await expect(option).toBeVisible();
  await option.click();
}

async function openCreatedTicket(page: Page, summary: string) {
  await page.locator(".app-header__nav .app-header__nav-link").filter({ hasText: "My Tickets" }).click();
  await page.locator('[data-testid="search-input"]').fill(summary);
  const card = page.locator(".ticket-card").filter({ hasText: summary }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.locator(".ticket-card__link").click();
  await expect(page.locator(".ticket-detail").last()).toBeVisible({ timeout: 15000 });
}

test("E2E-11 authenticated requester creates a ticket, manages an attachment, and posts a comment", async ({
  page,
}) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Sign in as the active automated Requester (no requester selector).
  await gotoLogin(page);
  await submitLogin(page, REQUESTER.email, REQUESTER.password);
  await expect(page.locator('[data-testid="logout-btn"]')).toBeVisible();
  await expect(page.getByText(REQUESTER.name)).toBeVisible();
  await expect(page.locator('[data-testid="role-badge"]')).toHaveAttribute(
    "data-value",
    "REQUESTER"
  );

  // The Lab 2 development-mode Requester selector is gone.
  await expect(page.getByText("Switch Requester")).toHaveCount(0);
  await expect(page.getByText("DEVELOPMENT MODE")).toHaveCount(0);

  // Create a Ticket through the real form.
  await page.locator('[data-testid="create-ticket-btn"]').click();
  await expect(page.locator('[data-testid="category-select"]')).toBeVisible();
  await page.locator('[data-testid="summary-input"]').fill("E2E-11 regression ticket — authenticated create");
  await page.locator('[data-testid="description-input"]').fill(created.description);
  await pickCustom(page, "category-select", "Hardware");
  await pickCustom(page, "related-system-select", "Campus Wi-Fi");
  await page.locator('input[type="radio"][value="HIGH"]').check();

  await page.locator('[data-testid="submit-btn"]').click();
  await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({
    timeout: 20000,
  });
  const banner = await page.locator('[data-testid="success-banner"]').innerText();
  const m = banner.match(/TKT-\d{6}/);
  created.summary = "E2E-11 regression ticket — authenticated create";
  expect(m?.[0], "ticket number parsed from success banner").toBeTruthy();
  await shot(page, "created-ticket-success.png");

  // Open it from My Tickets and post a Public Comment.
  await openCreatedTicket(page, created.summary);
  await expect(
    page.locator('[data-testid="public-comments"]')
  ).toBeVisible();
  const comment = `Public comment from E2E-11 at ${Date.now()}`;
  await page.locator('[data-testid="comment-textarea"]').fill(comment);
  await page.locator('[data-testid="post-comment-btn"]').click();
  await expect(page.locator('[data-testid="public-comments"]')).toContainText(
    comment
  );
  await expect(page.getByText("Public Comments (1)")).toBeVisible();
  await shot(page, "detail-with-comment.png");

  // Upload an attachment, then soft-remove it (Lab 2 behavior unchanged).
  await page.locator(".ticket-detail").last().scrollIntoViewIfNeeded();
  await page.locator('[data-testid="attachments-section"]').scrollIntoViewIfNeeded();
  await page.locator('[data-testid="attachment-input"]').setInputFiles(PNG_PATH);
  await expect(
    page.locator(".attachments-section .attachment-row").first()
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="attachment-count"]')).toHaveText(
    "Attachments (1 active)"
  );
  await shot(page, "detail-with-attachment.png");

  await page.locator('[data-testid="remove-attachment-btn"]').first().click();
  await expect(page.locator(".modal")).toBeVisible();
  await page.locator('[data-testid="removal-reason"]').fill(
    "E2E-11 verification of the soft-removal flow"
  );
  await page.locator('[data-testid="confirm-remove-btn"]').click();
  await expect(page.locator(".attachment-row--removed").first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('[data-testid="attachment-count"]')).toHaveText(
    "Attachments (0 active)"
  );
  await shot(page, "detail-attachment-removed.png");

  expect(errs).toEqual([]);
});