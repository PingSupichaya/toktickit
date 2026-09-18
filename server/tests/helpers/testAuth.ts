import bcrypt from "bcryptjs";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient, UserRole } from "@prisma/client";

// Shared test-auth helpers. Lab 1/2 API tests now run against the Lab 3 auth
// model: suites create dedicated active users (mustChangePassword: false) and
// drive the API with a cooked supertest agent instead of relying on seeded
// accounts. All created users and their sessions are removed in afterAll so the
// suites are repeatable.

export const PASSWORD = "ChangeMe123!";
export const TRUSTED_ORIGIN = "http://localhost:5173";

export type TestUserExtra = {
  name?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
};

export async function createTestUser(
  prisma: PrismaClient,
  email: string,
  role: UserRole,
  extra: TestUserExtra = {}
) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.create({
    data: {
      name: extra.name ?? `Test ${role}`,
      email,
      role,
      isActive: extra.isActive ?? true,
      mustChangePassword: extra.mustChangePassword ?? false,
      passwordHash,
    },
  });
}

export async function loginAgent(app: Express, email: string, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Test login failed for ${email} with status ${res.status}`);
  }
  return agent;
}

export async function deleteTestUsers(prisma: PrismaClient, emails: string[]) {
  if (emails.length === 0) return;
  await prisma.session.deleteMany({
    where: { user: { email: { in: emails } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: emails } },
  });
}