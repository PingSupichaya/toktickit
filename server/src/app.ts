import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({ data: categories });
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch categories",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// ---------------------------------------------------------------------------
// Development Requester selector
// GET /api/requesters -> { data: [{ id, name, email }, ...] } ordered by id
// ascending. Only active requesters are returned (BR-05, FR-02).
// ---------------------------------------------------------------------------
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json({ data: requesters });
  } catch (err) {
    console.error("Failed to fetch requesters:", err);
    res.status(500).json({
      error: {
        message: "Failed to fetch requesters",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

export default app;
