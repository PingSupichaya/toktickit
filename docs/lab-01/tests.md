# Lab 1 — Test Plan and Evidence
# Lab 1 — Test Plan and Evidence

All test files live under server/tests/lab-01/ and client/tests/lab-01/.

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Supertest | GET /api/health returns 200, status=ok | Health returns 200 when server is online |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | Categories return the corrected four seeds |
| 3 | Vitest | Heading renders | TokTickIT heading rendered |
| 4 | Vitest | Success state shows Online + category list | Can show online state and display all categories |
| 5 | Vitest | Error state shows Offline + message | show an error message and display offline state |

Paste your passing terminal output / screenshot below.
**Client test**
 RUN  v2.1.9 D:/Works_KMUTT/CPE334/toktickit/client

 ✓ tests/lab-01/App.test.tsx (3)
   ✓ App (3)
     ✓ renders the TokTickIT heading
     ↓ shows Online and the seeded categories on success [skipped]
     ↓ shows an Offline error message when the API is unavailable [skipped]

 Test Files  1 passed (1)
      Tests  1 passed | 2 todo (3)
   Start at  12:49:24
   Duration  28.58s (transform 216ms, setup 4.29s, collect 5.03s, tests 32ms, environment 17.54s, prepare 995ms)

**Server test**
 RUN  v2.1.9 D:/Works_KMUTT/CPE334/toktickit/server

 ✓ tests/lab-01/categories.test.ts (1)
 ✓ tests/lab-01/health.test.ts (1)

 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  22:05:24
   Duration  979ms (transform 148ms, setup 0ms, collect 665ms, tests 152ms, environment 0ms, prepare 460ms)