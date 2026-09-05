import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const SHOTS = path.join(process.cwd(), "artifacts", "lab-02", "screenshots");
const WORK = path.join(process.cwd(), "test-results");
const PNG_PATH = path.join(WORK, "e2e-proof.png");

const CAROL = {
  id: 3,
  name: "Carol Martinez",
  email: "carol.mart@mail.kmutt.co.th",
};
const DAVID = { id: 4, name: "David Lee", email: "david.lee1@mail.kmutt.co.th" };

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
} as const;

const created = {
  summary: `E2E Ticket ${Date.now()}`,
  number: "",
};

const COLORS = {
  primary: "rgb(0, 107, 60)",
  bgPage: "rgb(245, 247, 246)",
  paleGreen: "rgb(234, 246, 239)",
  error: "rgb(196, 30, 58)",
  focus: "rgb(11, 122, 70)",
};

test.describe.configure({ mode: "serial" });

function mkWork() {
  if (!fs.existsSync(WORK)) fs.mkdirSync(WORK, { recursive: true });
  if (!fs.existsSync(PNG_PATH)) {
    fs.writeFileSync(PNG_PATH, Buffer.from(proofPng(), "base64"));
  }
}

test.beforeAll(() => {
  mkWork();
});

function proofPng(): string {
  return (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
  );
}

async function setRequester(page: Page, r: { id: number; name: string; email: string }) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([key, id, name, email]) => {
      localStorage.setItem(key, JSON.stringify({ id, name, email }));
    },
    ["toktickit.requester", r.id, r.name, r.email] as const,
  );
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function setViewport(page: Page, key: keyof typeof VIEWPORTS) {
  await page.setViewportSize(VIEWPORTS[key]);
}

async function shot(page: Page, rel: string) {
  const target = path.join(SHOTS, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: false });
}

async function pickCustom(page: Page, testId: string, label: string) {
  await page.locator(`[data-testid="${testId}"]`).first().click();
  const option = page.locator(".select-control__item").filter({ hasText: label }).first();
  await expect(option).toBeVisible();
  await option.click();
}

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

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(0);
}

async function openCreatedTicket(page: Page) {
  await page.locator('[data-testid="search-input"]').fill(created.summary);
  const card = page.locator(".ticket-card").filter({ hasText: created.summary }).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.locator(".ticket-card__link").click();
  await expect(page.locator(".ticket-detail").last()).toBeVisible({ timeout: 15000 });
}

test("requester selection + create ticket across viewports (T-023)", async ({ page }) => {
  const errs = watch(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="requester-select"]')).toBeVisible();

  await setViewport(page, "desktop");
  await shot(page, "requester-selection/desktop.png");
  await setViewport(page, "tablet");
  await shot(page, "requester-selection/tablet.png");
  await setViewport(page, "mobile");
  await shot(page, "requester-selection/mobile.png");

  await setViewport(page, "desktop");
  await pickCustom(page, "requester-select", CAROL.name);
  await page.locator('[data-testid="continue-btn"]').click();

  await page.locator('[data-testid="create-ticket-btn"]').click();
  await expect(page.locator('[data-testid="category-select"]')).toBeVisible();
  await expect(page.locator('[data-testid="related-system-select"]')).toBeVisible();
  await shot(page, "create-ticket/desktop-initial.png");

  await page.locator('[data-testid="summary-input"]').click();
  await page.locator('[data-testid="summary-input"]').fill("xy");
  await page.locator('[data-testid="summary-input"]').blur();
  await page.locator('[data-testid="description-input"]').click();
  await page.locator('[data-testid="description-input"]').fill("x");
  await page.locator('[data-testid="description-input"]').blur();
  await expect(page.locator('[data-testid="error-summary"]')).toBeVisible();
  await expect(page.locator('[data-testid="error-description"]')).toBeVisible();
  await shot(page, "create-ticket/desktop-validation.png");
  await expect(page.locator('[data-testid="submit-btn"]')).toBeDisabled();

  await page.locator('[data-testid="summary-input"]').fill(created.summary);
  await page.locator('[data-testid="description-input"]').fill(
    "Playwright end-to-end proof: a ticket created through the real UI in a headless browser with a long enough description to satisfy validation.",
  );
  await pickCustom(page, "category-select", "Hardware");
  await pickCustom(page, "related-system-select", "Printer");
  await page.locator('input[type="radio"][value="HIGH"]').check();

  await page.route("**/api/tickets", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((r) => setTimeout(r, 2500));
    }
    await route.continue();
  });
  await page.locator('[data-testid="submit-btn"]').click();
  await expect(page.locator('[data-testid="submit-btn-busy"]')).toBeVisible();
  await shot(page, "create-ticket/desktop-submitting.png");
  await expect(page.locator('[data-testid="success-banner"]')).toBeVisible({
    timeout: 20000,
  });
  await page.unroute("**/api/tickets");
  const banner = await page.locator('[data-testid="success-banner"]').innerText();
  const m = banner.match(/TKT-\d{6}/);
  created.number = m?.[0] ?? "";
  await shot(page, "create-ticket/desktop-success.png");

  await setViewport(page, "tablet");
  await page
    .locator(".app-header__nav .app-header__nav-link")
    .filter({ hasText: "Create Ticket" })
    .click();
  await expect(page.locator('[data-testid="category-select"]')).toBeVisible();
  await shot(page, "create-ticket/tablet-initial.png");

  await setViewport(page, "mobile");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator(".app-header__overlay")).toBeVisible();
  await page
    .locator(".app-header__overlay .app-header__overlay-link")
    .filter({ hasText: "Create Ticket" })
    .click();
  await expect(page.locator('[data-testid="category-select"]')).toBeVisible();
  await shot(page, "create-ticket/mobile-initial.png");

  expect(created.number, "ticket number parsed").not.toBe("");
  expect(errs).toEqual([]);
});

test("my tickets responsive, search, empty states (T-023, AC-08)", async ({ page }) => {
  const errs = watch(page);

  await setRequester(page, CAROL);
  await setViewport(page, "desktop");
  await expect(page.locator('[data-testid="ticket-list"]')).toBeVisible();
  await expect(page.locator(".ticket-card").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, "my-tickets/desktop-with-tickets.png");

  await setViewport(page, "tablet");
  await expect(page.locator('[data-testid="ticket-list"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, "my-tickets/tablet-with-tickets.png");

  await setViewport(page, "mobile");
  await expect(page.locator('[data-testid="ticket-list"]')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, "my-tickets/mobile-with-tickets.png");

  await setViewport(page, "desktop");
  await page.locator('[data-testid="search-input"]').click();
  await page.locator('[data-testid="search-input"]').fill(created.summary);
  await page.waitForTimeout(400);
  const card = page.locator(".ticket-card").filter({ hasText: created.summary }).first();
  await expect(card).toBeVisible({ timeout: 10000 });
  await shot(page, "my-tickets/desktop-search-active.png");

  await page.locator('[data-testid="search-input"]').fill("zzz-no-results-probe-qqq");
  await expect(page.locator('[data-testid="empty-clear-btn"]')).toBeVisible({
    timeout: 10000,
  });
  await shot(page, "my-tickets/desktop-no-results.png");
  await page.locator('[data-testid="empty-clear-btn"]').click();
  await expect(page.locator('[data-testid="ticket-list"]')).toBeVisible();

  await setRequester(page, DAVID);
  await expect(page.getByText("No Tickets Yet")).toBeVisible({ timeout: 10000 });
  await shot(page, "my-tickets/desktop-empty-state.png");

  await setRequester(page, CAROL);
  await expect(page.locator('[data-testid="ticket-list"]')).toBeVisible();
  expect(errs).toEqual([]);
});

test("ticket detail + attachment lifecycle (T-023/T-024, AC-06/07)", async ({
  page,
}) => {
  const errs = watch(page);

  await setRequester(page, CAROL);
  await setViewport(page, "desktop");
  await openCreatedTicket(page);
  await shot(page, "ticket-detail/desktop-full.png");

  await page.locator('[data-testid="attachment-input"]').setInputFiles(PNG_PATH);
  await expect(
    page.locator('.attachment-row').first(),
  ).toBeVisible({ timeout: 15000 });
  await page.locator(".attachments-section").scrollIntoViewIfNeeded();
  await shot(page, "ticket-detail/desktop-attachments-active.png");

  await setViewport(page, "tablet");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".ticket-detail").last()).toBeVisible();
  await shot(page, "ticket-detail/tablet-full.png");

  await setViewport(page, "mobile");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".ticket-detail").last()).toBeVisible();
  await shot(page, "ticket-detail/mobile-full.png");

  await setViewport(page, "desktop");
  await page.locator(".attachments-section").scrollIntoViewIfNeeded();
  await page.locator('[data-testid="remove-attachment-btn"]').first().click();
  await expect(page.locator(".modal")).toBeVisible();
  const box = await page.locator(".modal").boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(Math.abs(box.x + box.width / 2 - VIEWPORTS.desktop.width / 2)).toBeLessThan(8);
  }
  await shot(page, "ticket-detail/remove-confirmation-modal.png");

  await page.locator('[data-testid="removal-reason"]').fill(
    "E2E verification of the soft-removal flow",
  );
  await page.locator('[data-testid="confirm-remove-btn"]').click();
  await expect(page.locator(".attachment-row--removed").first()).toBeVisible({
    timeout: 15000,
  });
  await shot(page, "ticket-detail/desktop-attachments-removed.png");
  await expectNoHorizontalOverflow(page);

  expect(errs).toEqual([]);
});

test("ownership block on another requester (T-025, AC-03)", async ({ page }) => {
  const errs = watch(page);

  await setRequester(page, CAROL);
  await setViewport(page, "desktop");
  await openCreatedTicket(page);

  await page.getByRole("button", { name: "Switch Requester" }).first().click();
  await expect(page.locator('[data-testid="requester-select"]')).toBeVisible();
  await pickCustom(page, "requester-select", DAVID.name);
  await page.locator('[data-testid="continue-btn"]').click();

  await expect(page.locator(".state--error")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Back to My Tickets" })).toBeVisible();
  await shot(page, "ticket-detail/ownership-error.png");

  expect(errs).toEqual([]);
});

test("visual inspection: Zen Green theme + responsiveness (CHECKLIST §17)", async ({
  page,
}) => {
  const errs = watch(page);

  await setRequester(page, CAROL);
  await setViewport(page, "desktop");
  await expect(page.locator('[data-testid="ticket-list"]')).toBeVisible();

  expect(
    await page.locator(".app-header").evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe(COLORS.primary);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    COLORS.bgPage,
  );
  await expect(page.locator("[data-testid='status-badge']").first()).toHaveCSS(
    "background-color",
    COLORS.paleGreen,
  );
  const highBadge = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="priority-badge"][data-value="HIGH"]');
    return el ? getComputedStyle(el).color : null;
  });
  expect(highBadge).toBe(COLORS.error);

  expect(
    await page.locator(".app-header__hamburger").evaluate((el) => getComputedStyle(el).display),
  ).toBe("none");
  expect(
    await page.locator(".app-header__nav").evaluate((el) => getComputedStyle(el).display),
  ).toBe("flex");

  await setViewport(page, "mobile");
  await expect(page.locator(".app-header__hamburger")).toBeVisible();
  expect(
    await page.locator(".app-header__nav").evaluate((el) => getComputedStyle(el).display),
  ).toBe("none");
  await page.locator(".app-header__hamburger").click();
  await expect(page.locator(".app-header__overlay")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".app-header__overlay")).toHaveCount(0);

  await page.locator(".app-header__hamburger").click();
  await expect(page.locator(".app-header__overlay")).toBeVisible();
  await page.locator(".app-header__overlay").click({ position: { x: 5, y: 70 } });
  await expect(page.locator(".app-header__overlay")).toHaveCount(0);

  await openCreatedTicket(page);
  const gridColsMobile = await page
    .locator(".ticket-detail__grid")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(gridColsMobile).toBe(1);

  await setViewport(page, "desktop");
  const gridColsDesktop = await page
    .locator(".ticket-detail__grid")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(gridColsDesktop).toBe(2);

  await page
    .locator(".app-header__nav .app-header__nav-link")
    .filter({ hasText: "Create Ticket" })
    .click();
  await expect(page.locator('[data-testid="category-select"]')).toBeVisible({ timeout: 10000 });
  const actionsDesktop = await page
    .locator(".create-ticket__actions")
    .evaluate((el) => getComputedStyle(el).flexDirection);
  expect(actionsDesktop).toBe("row");

  await setViewport(page, "mobile");
  const actionsMobile = await page
    .locator(".create-ticket__actions")
    .evaluate((el) => getComputedStyle(el).flexDirection);
  expect(actionsMobile).toBe("column");

  await page.locator(".create-ticket__actions").click();
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    return {
      outline: getComputedStyle(el).outline,
      color: getComputedStyle(el).outlineColor,
    };
  });
  expect(focus).not.toBeNull();
  expect(focus?.color).toBe(COLORS.focus);

  expect(errs).toEqual([]);
});