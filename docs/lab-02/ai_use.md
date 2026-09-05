# Lab 2 — AI Use and Reflection

**LLM/agent used:** Claude Sonnet 5 High (opencode, big-pickle)

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | The attachment "Remove" button is not working; the modal looks like a green screen — diagnose why the modal is not visible. | Reviewed `client/src/main.tsx`; found the Bootstrap CSS import overriding our `.modal` (position:fixed; display:none), removed the import; bundle dropped 258 kB → 27 kB and the modal became visible. |
| 2 | Make the attachment removal reason required before it is removed. | Updated `AttachmentSection` to mark the reason required, show "Reason is required before removing" and skip the API call when empty; added a passing client unit test (client suite now 45 pass). |
| 3 | Review the DOM structure of the custom `Select` and `Input` UI components so I can target them reliably in Playwright. | Confirmed `Select` is a custom listbox (click trigger + click `.select-control__item`), while `Input` passes `data-testid` through to the real `<input>`; built the E2E helpers accordingly. |
| 4 | Write a Playwright end-to-end spec covering create ticket → my tickets → ticket detail → attachment upload/remove → ownership block, and save screenshots per the ui-spec §17 tree. | Produced `e2e/lab-02/requester-ticket-flow.spec.ts` (5 tests, serial) and iterated: fixed localStorage SecurityError (goto before evaluate), fixed setInputFiles path, verified no console errors and no horizontal overflow. |
| 5 | Wire Playwright into the repo root (package.json scripts + playwright.config.ts) with a webServer that starts client and reuses the running API. | Confirmed `testDir e2e/lab-02`, `workers 1`, baseURL 5173, and added `test:e2e*` npm scripts; all 5 E2E tests pass headless. |
| 6 | Update `docs/lab-02/tests.md` to reflect the real E2E implementation, screenshot list, commands, and final results; create `reviewer.md` + `ai_use.md` from the lab-01 templates. | Recorded actual E2E file mapping (T-023/024/025 = Pass), checked the visual checklist, totals 27/27, and documented peer reviews and this AI usage. |

## Reflection
Two or three sentences: what made your prompts better, and one place you had to
correct or reject what the agent produced.  
Giving the agent the exact selector/`data-testid` names and the ui-spec §17 screenshot tree up front made the E2E spec land almost correctly on the first run, so detailed, framework-aware prompts saved many iterations. I had to correct the agent twice during E2E work: the `setRequester` helper originally wrote the wrong requester id into localStorage, and the upload assertion targeted a `data-testid` that carries the attachment id rather than the ticket number — I resolved both by reading the real component code before re-running.
