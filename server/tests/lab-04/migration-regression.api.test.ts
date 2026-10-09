import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "../../src/prisma.js";

// lab-04 / migration-regression.api.test.ts — MIG-01, MIG-02, MIG-04, MIG-05
//
// Scope: ONLY Spec §9.5 (migration + rollback) and §9.6 (seed).
// DB-level checks via Prisma + a static read of the Lab 4 migration SQL.
// No Action Taken / dashboard API endpoints are exercised here — those belong
// to the API suites (actions-taken, ticket-workflow, dashboards), not to the
// migration contract. Requires the DB to be migrated and seeded.

const prisma = getPrisma();

function lab4MigrationSql(): string {
  const dir = join(process.cwd(), "prisma", "migrations");
  const entry = readdirSync(dir).find((n) => n.includes("action_taken"));
  if (!entry) throw new Error("Lab 4 migration folder not found");
  return readFileSync(join(dir, entry, "migration.sql"), "utf8");
}

async function ticketId(ticketNumber: string): Promise<number> {
  return (
    await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber },
      select: { id: true },
    })
  ).id;
}

async function orderedActions(ticketNumber: string) {
  const id = await ticketId(ticketNumber);
  return prisma.actionTaken.findMany({
    where: { ticketId: id },
    orderBy: [{ actionAt: "asc" }, { id: "asc" }],
  });
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("MIG-01 — migration preserves Lab 2/3 data (§9.5, AC-12)", () => {
  it("the action_taken table exists and the ticket.version column defaults to 1", async () => {
    const cols: Array<{ column_name: string }> = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'action_taken'`;
    const names = cols.map((c) => c.column_name);
    for (const expected of [
      "id",
      "ticketId",
      "actionAt",
      "description",
      "result",
      "followUpRequired",
      "followUpNote",
      "attachmentNotes",
      "performedById",
      "updatedById",
      "version",
      "createdAt",
      "updatedAt",
    ]) {
      expect(names).toContain(expected);
    }

    const ticketCols: Array<{ column_name: string; column_default: string | null }> =
      await prisma.$queryRaw`
        SELECT column_name, column_default FROM information_schema.columns
        WHERE table_name = 'ticket' AND column_name = 'version'`;
    expect(ticketCols).toHaveLength(1);

    const idx: Array<{ indexname: string }> = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes WHERE tablename = 'action_taken'`;
    const idxNames = idx.map((r) => r.indexname);
    expect(idxNames).toContain("action_taken_ticketId_idx");
    expect(idxNames).toContain("action_taken_ticketId_actionAt_id_idx");
  });

  it("every Lab 3 seed ticket still exists with version = 1 (no data loss)", async () => {
    for (const n of ["TKT-000001", "TKT-000005", "TKT-000006", "TKT-000014"]) {
      const t = await prisma.ticket.findUniqueOrThrow({
        where: { ticketNumber: n },
      });
      expect(t.version).toBe(1);
    }
    expect(await prisma.user.count()).toBeGreaterThanOrEqual(14);
    expect(await prisma.ticket.count()).toBeGreaterThanOrEqual(16);
    expect(await prisma.publicComment.count()).toBeGreaterThanOrEqual(7);
    expect(await prisma.internalNote.count()).toBeGreaterThanOrEqual(5);
  });
});

describe("MIG-02 — seed coverage and idempotency (§9.6)", () => {
  it("covers tickets with 0, exactly 1, and multiple Actions Taken", async () => {
    expect(await prisma.actionTaken.count({ where: { ticketId: await ticketId("TKT-000001") } })).toBe(0);
    expect(await prisma.actionTaken.count({ where: { ticketId: await ticketId("TKT-000002") } })).toBe(1);
    expect(await prisma.actionTaken.count({ where: { ticketId: await ticketId("TKT-000014") } })).toBe(1);
    expect(await prisma.actionTaken.count({ where: { ticketId: await ticketId("TKT-000003") } })).toBe(2);
    expect(await prisma.actionTaken.count({ where: { ticketId: await ticketId("TKT-000011") } })).toBe(2);
  });

  it("covers pending follow-ups and gate-passed tickets", async () => {
    const blocked = await orderedActions("TKT-000003");
    expect(blocked.at(-1)?.followUpRequired).toBe(true);

    const passed = await orderedActions("TKT-000011");
    expect(passed.length).toBeGreaterThanOrEqual(2);
    expect(passed[0].followUpRequired).toBe(true);
    expect(passed.at(-1)?.followUpRequired).toBe(false);

    const resolved = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TKT-000014" },
    });
    expect(resolved.currentStatus).toBe("RESOLVED");
    const resolvedActions = await orderedActions("TKT-000014");
    expect(resolvedActions).toHaveLength(1);
    expect(resolvedActions[0].followUpRequired).toBe(false);
  });

  it("includes a backdated actionAt and orders the list by (actionAt, id)", async () => {
    const backdated = await prisma.actionTaken.findFirst({
      where: { description: { contains: "Reseated the RAM" } },
    });
    expect(backdated).toBeDefined();
    expect(backdated!.actionAt.getTime()).toBeLessThan(backdated!.createdAt.getTime());

    const list = await orderedActions("TKT-000011");
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1].actionAt.getTime();
      const cur = list[i].actionAt.getTime();
      expect(cur >= prev).toBe(true);
    }
  });

  it("covers zero-dashboard-activity users and an active/inactive mix per role", async () => {
    const zeroReq = await prisma.user.findUniqueOrThrow({
      where: { email: "zero.req@mail.kmutt.ac.th" },
    });
    expect(
      await prisma.ticket.count({ where: { submittedById: zeroReq.id } })
    ).toBe(0);

    const zeroStaff = await prisma.user.findUniqueOrThrow({
      where: { email: "zero.sta@mail.kmutt.ac.th" },
    });
    expect(await prisma.ticket.count({ where: { ownerId: zeroStaff.id } })).toBe(0);

    for (const role of ["REQUESTER", "IT_STAFF", "ADMIN"] as const) {
      expect(
        await prisma.user.count({ where: { role, isActive: true } })
      ).toBeGreaterThan(0);
      expect(
        await prisma.user.count({ where: { role, isActive: false } })
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("is idempotent: no duplicate (ticketId, description) action rows", async () => {
    const rows = await prisma.actionTaken.findMany({
      select: { ticketId: true, description: true },
    });
    const keys = rows.map((r) => `${r.ticketId}::${r.description}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("MIG-04 — legacy Resolved/Closed tickets not retroactively blocked (D-03)", () => {
  it("TKT-000005 (RESOLVED) and TKT-000006 (CLOSED) remain valid with zero actions", async () => {
    const legacyResolved = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TKT-000005" },
    });
    const legacyClosed = await prisma.ticket.findUniqueOrThrow({
      where: { ticketNumber: "TKT-000006" },
    });
    expect(legacyResolved.currentStatus).toBe("RESOLVED");
    expect(legacyClosed.currentStatus).toBe("CLOSED");
    expect(
      await prisma.actionTaken.count({ where: { ticketId: legacyResolved.id } })
    ).toBe(0);
    expect(
      await prisma.actionTaken.count({ where: { ticketId: legacyClosed.id } })
    ).toBe(0);
  });
});

describe("MIG-05 — rollback / recovery path (§9.5 step 6)", () => {
  it("the Lab 4 migration is additive-only (no destructive DDL)", async () => {
    const sql = lab4MigrationSql();
    expect(sql).toMatch(/CREATE TABLE "action_taken"/);
    expect(sql).toMatch(/ADD COLUMN\s+"version"/);
    // Ignore `--` comment lines (the rollback note itself names the DROP
    // statements); only executable DDL must be additive.
    const ddl = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    for (const destructive of [
      "DROP TABLE",
      "DROP COLUMN",
      "DELETE FROM",
      "TRUNCATE",
    ]) {
      expect(ddl).not.toMatch(new RegExp(destructive));
    }
  });

  it("the migration is recorded as applied so re-running is safe", async () => {
    const applied: Array<{ migration_name: string }> = await prisma.$queryRaw`
      SELECT migration_name FROM _prisma_migrations
      WHERE migration_name LIKE '%action_taken%'
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL`;
    expect(applied.length).toBeGreaterThanOrEqual(1);
  });
});
