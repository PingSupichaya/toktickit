import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Role dashboards end-to-end (docs/lab-04/tests.md)
//   E2E-04 dashboards for Requester, Staff, and Admin: metric cards, recent
//          Tickets, drill-down navigation; Admin additionally shows the
//          userCounts strip, Staff omits it (AC-02, AC-10, AC-11, AC-14)
//   E2E-06 responsive grids + ui-spec §9–§10/§12 checklist: breakpoints,
//          no horizontal overflow at 375px, visible focus, AA contrast,
//          Zen Green token values (no new colors)
// Screenshots: artifacts/lab-04/screenshots/{staff,requester}-dashboard/
// ---------------------------------------------------------------------------
// Non-zero dashboards use seeded accounts + seeded tickets (Alice/Frank/Omar)
// so every count is real. Empty states use the dedicated zero-activity
// fixture users from server/prisma/e2e-dashboards-fixtures.ts (beforeAll).
// ---------------------------------------------------------------------------

const SHOTS_STAFF = path.join(
  process.cwd(),
  "artifacts",
  "lab-04",
  "screenshots",
  "staff-dashboard"
);
const SHOTS_REQ = path.join(
  process.cwd(),
  "artifacts",
  "lab-04",
  "screenshots",
  "requester-dashboard"
);
const SERVER_DIR = path.join(__dirname, "..", "..", "server");

const REQUESTER = { email: "alice.john@mail.kmutt.ac.th", password: "Password123!" };
const STAFF = { email: "frank.ngu@mail.kmutt.ac.th", password: "Password123!" };
const ADMIN = { email: "omar.far@mail.kmutt.ac.th", password: "Password123!" };
const ZERO_REQ = { email: "e2e.dash.zero@mail.kmutt.ac.th", password: "E2ePassw0rd!" };
const ZERO_STAFF = { email: "e2e.dash.zerostaff@mail.kmutt.ac.th", password: "E2ePassw0rd!" };

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "prisma/e2e-dashboards-fixtures.ts"],
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

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="login-email"]').fill(email);
  await page.locator('[data-testid="login-password"]').fill(password);
  await page.locator('[data-testid="login-submit-btn"]').click();
  await expect(page.locator('[data-testid="logout-btn"]').first()).toBeVisible();
}

async function gotoNav(page: Page, label: string) {
  await page
    .locator(".app-header__nav .app-header__nav-link")
    .filter({ hasText: label })
    .click();
}

async function expectNoOverflow(page: Page) {
  const ok = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );
  expect(ok, "no horizontal overflow").toBe(true);
}

test("E2E-04 dashboards for Requester, Staff, and Admin with drill-down", async ({
  page,
}) => {
  const errs = watch(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Requester: four cards, recent list, quick actions, drill-down to My Tickets.
  await login(page, REQUESTER.email, REQUESTER.password);
  await expect(page.locator('[data-testid="requester-metric-cards"]')).toBeVisible();
  await expect(page.locator('[data-testid="requester-recent-tickets"]')).toBeVisible();
  await expect(page.locator('[data-testid="requester-quick-actions"]')).toBeVisible();
  await shot(SHOTS_REQ, page, "desktop-dashboard.png");

  const reqLinks = page.locator(
    '[data-testid="requester-metric-cards"] [data-testid="metric-card-link"]'
  );
  await expect(reqLinks).toHaveCount(4);
  await reqLinks.first().click();
  await expect(page.locator('[data-testid="ticket-count"]')).toBeVisible();
  await expect(page.locator('[data-testid="dashboard-filter-chip"]')).toContainText("NEW");
  await gotoNav(page, "Dashboard");
  await expect(page.locator('[data-testid="requester-metric-cards"]')).toBeVisible();

  // Empty Requester: zero cards with the empty state.
  await login(page, ZERO_REQ.email, ZERO_REQ.password);
  await expect(page.locator('[data-testid="requester-metric-cards"]')).toBeVisible();
  await expect(page.getByText("No tickets submitted yet.")).toBeVisible();
  await shot(SHOTS_REQ, page, "desktop-dashboard-empty.png");

  // Staff: six cards, priority strip, recent list — and no user strip.
  await login(page, STAFF.email, STAFF.password);
  await expect(page.locator('[data-testid="staff-metric-cards"]')).toBeVisible();
  const staffLinks = page.locator(
    '[data-testid="staff-metric-cards"] [data-testid="metric-card-link"]'
  );
  await expect(staffLinks).toHaveCount(6);
  await expect(page.locator('[data-testid="staff-priority-breakdown"]')).toBeVisible();
  await expect(page.locator('[data-testid="staff-user-counts"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="staff-recent-tickets"]')).toBeVisible();
  await shot(SHOTS_STAFF, page, "desktop-dashboard.png");

  // One status drill-down lands on the pre-filtered queue.
  await staffLinks.first().click();
  await expect(page.locator('[data-testid="queue-table"]')).toBeVisible();
  await expect(page.locator('[data-testid="queue-filter-status"]')).toContainText("NEW");
  await gotoNav(page, "Dashboard");
  await expect(page.locator('[data-testid="staff-metric-cards"]')).toBeVisible();

  // Empty Staff: zero cards with the empty state.
  await login(page, ZERO_STAFF.email, ZERO_STAFF.password);
  await expect(page.locator('[data-testid="staff-metric-cards"]')).toBeVisible();
  await expect(page.getByText("No assigned Tickets yet.")).toBeVisible();
  await shot(SHOTS_STAFF, page, "desktop-dashboard-empty.png");

  // Admin: identical queue metrics plus the user-counts strip with drill-down.
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page.locator('[data-testid="staff-metric-cards"]')).toBeVisible();
  const userStrip = page.locator('[data-testid="staff-user-counts"]');
  await expect(userStrip).toBeVisible();
  await expect(userStrip).toContainText("Requesters");
  await userStrip.locator(".metric-card__link").first().click();
  await expect(page.locator('[data-testid="users-table"]')).toBeVisible();

  expect(errs, `console/page errors: ${errs.join("; ")}`).toEqual([]);
});

test("E2E-06 responsive grids and ui-spec §9–§10/§12 checklist", async ({ page }) => {
  const errs = watch(page);

  for (const [dir, user, cardsTestId] of [
    [SHOTS_REQ, REQUESTER, "requester-metric-cards"],
    [SHOTS_STAFF, STAFF, "staff-metric-cards"],
  ] as const) {
    await login(page, user.email, user.password);

    // Tablet: grid holds multiple columns.
    await page.setViewportSize({ width: 800, height: 1000 });
    await expect(page.locator(`[data-testid="${cardsTestId}"]`)).toBeVisible();
    await expectNoOverflow(page);
    await shot(dir, page, "tablet-dashboard.png");

    // Mobile 375px: single column, no horizontal scroll.
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator(`[data-testid="${cardsTestId}"]`)).toBeVisible();
    await expectNoOverflow(page);
    await shot(dir, page, "mobile-dashboard.png");
    await page.setViewportSize({ width: 1280, height: 800 });
  }

  // Visible focus (ui-spec §10): Tab until a drill-down link is focused, then
  // its focus-visible ring must be rendered.
  await login(page, REQUESTER.email, REQUESTER.password);
  await page.locator('[data-testid="requester-metric-cards"]').waitFor();
  await page.keyboard.press("Tab");
  for (let i = 0; i < 30; i++) {
    const testId = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid")
    );
    if (testId === "metric-card-link") break;
    await page.keyboard.press("Tab");
  }
  const focusedTestId = await page.evaluate(
    () => document.activeElement?.getAttribute("data-testid")
  );
  expect(focusedTestId).toBe("metric-card-link");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? getComputedStyle(el).outlineWidth : "0px";
  });
  expect(outline, "focus ring on keyboard focus").toBe("2px");

  // AA contrast + Zen Green tokens (ui-spec §10/§12): no new colors — the
  // value, link, and surface compute to the documented token values, and both
  // text pairs clear 4.5:1.
  const palette = await page.evaluate(() => {
    const value = document.querySelector(".metric-card__value");
    const link = document.querySelector(".metric-card__link");
    const card = document.querySelector(".metric-card");
    const css = (el: Element | null, prop: string) =>
      el ? getComputedStyle(el).getPropertyValue(prop) : "";
    return {
      valueColor: css(value, "color"),
      linkColor: css(link, "color"),
      cardBg: css(card, "background-color"),
    };
  });
  expect(palette.valueColor, "value uses --color-text-primary").toBe("rgb(26, 58, 46)");
  expect(palette.linkColor, "link uses --color-primary").toBe("rgb(0, 107, 60)");
  expect(palette.cardBg, "card uses --color-bg-surface").toBe("rgb(255, 255, 255)");

  const ratios = await page.evaluate(() => {
    const luminance = (rgb: string): number => {
      const channels = rgb
        .replace(/[^\d,]/g, "")
        .split(",")
        .map(Number)
        .slice(0, 3)
        .map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const ratio = (fg: string, bg: string): number => {
      const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    };
    const value = document.querySelector(".metric-card__value");
    const link = document.querySelector(".metric-card__link");
    const card = document.querySelector(".metric-card");
    const css = (el: Element | null, prop: string) =>
      el ? getComputedStyle(el).getPropertyValue(prop) : "";
    const bg = css(card, "background-color");
    return {
      value: ratio(css(value, "color"), bg),
      link: ratio(css(link, "color"), bg),
    };
  });
  expect(ratios.value, "value contrast ≥ 4.5").toBeGreaterThanOrEqual(4.5);
  expect(ratios.link, "link contrast ≥ 4.5").toBeGreaterThanOrEqual(4.5);

  expect(errs, `console/page errors: ${errs.join("; ")}`).toEqual([]);
});
